from typing import List, Optional, Dict
from datetime import datetime, timezone
from fastapi import FastAPI, Depends, HTTPException, Query, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, func, asc, or_
import re
import logging
import asyncio
from logger_config import setup_logger
from dotenv import load_dotenv

import os

# Load environment variables
load_dotenv()

logger = setup_logger(__name__)

from database import SessionLocal, engine, get_db
from models import Source, Article, CrawlEvent, generate_uuid, SystemConfig, User, Report, Base, Story
from schemas import (
    SourceCreate, ArticleResponse, SystemConfigUpdate, PaginatedArticleResponse,
    SourceResponse, SourceUpdate, StoryResponse, SettingsSchema, SettingsUpdate,
    UserProfile, UserUpdate, ReportCreate, ReportResponse, EmailRequest,
    PaginatedStoryResponse
)
from auth import get_current_user
from crawler import run_crawler, CrawlerService
from clustering import analyze_clusters
from report_generator import ReportGenerator
from pdf_service import generate_pdf
from email_service import send_report_email
import pipeline_endpoints

from contextlib import asynccontextmanager
from scheduler_service import SchedulerService

# Global Scheduler
scheduler_service = SchedulerService()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    Base.metadata.create_all(bind=engine)
    # scheduler_service.start() # No longer used, moved to Celery
    yield
    # Shutdown
    # scheduler_service.stop()

app = FastAPI(title="News Aggregator API", version="0.1.0", lifespan=lifespan)
app.include_router(pipeline_endpoints.router)
import template_endpoints
app.include_router(template_endpoints.router)

# --- Helper to get references for a report ---
def get_report_references(report: Report, db: Session):
    # Extract IDs
    ids = set()
    # Matches [[CITATION:ID]] or [[CITE_GROUP:ID1,ID2]] or [ID] or href="#ref-ID"
    # Unified regex for various citation formats (raw and rendered)
    # Permissive ID: allow dots, underscores, and spaces (stripped later)
    patterns = [
        r'\[{1,2}(?:CITATION:|REF:|CITE:|CITE_GROUP:)?\s*([a-zA-Z0-9\-\._\s]+)\s*\]{1,2}',
        r'href="#ref-([a-zA-Z0-9\-\._\s]+)"',
        r'CITE_GROUP:([a-zA-Z0-9\-\._\s]+(?:,[a-zA-Z0-9\-\._\s]+)*)'
    ]
    for p in patterns:
        for match in re.finditer(p, report.content or ""):
            # Handle comma separated IDs in CITE_GROUP
            content = match.group(1)
            for aid in content.split(','):
                aid_stripped = aid.strip()
                if len(aid_stripped) >= 10:
                    ids.add(aid_stripped)
    
    if not ids:
        return []

    articles = db.query(Article).filter(Article.id.in_(list(ids))).all()
    # Populate sources
    for a in articles:
        if a.source_id and not a.source:
             a.source = db.query(Source).filter(Source.id == a.source_id).first()
             
    # Sort by appearance in text? The frontend maps them dynamically.
    # For backend consistency, passing them as a list is fine, the service creates the map.
    # Actually, we should sort them by ID or something stable? 
    # Or rely on the service to map ID -> Number based on text appearance.
    # The service logic I wrote does exactly that (re-scans text).
    return articles

@app.post("/reports/{report_id}/export/pdf")
def export_report_pdf(report_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    report = db.query(Report).filter(Report.id == report_id, Report.user_id == current_user.id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    references = get_report_references(report, db)
    try:
        pdf_bytes = generate_pdf(report, references)
    except ImportError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"PDF Generation Error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during PDF generation")

    return Response(content=pdf_bytes, media_type="application/pdf", headers={
        "Content-Disposition": f"attachment; filename=report_{report_id}.pdf"
    })

@app.post("/reports/{report_id}/email")
def email_report(report_id: str, req: EmailRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    report = db.query(Report).filter(Report.id == report_id, Report.user_id == current_user.id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    references = get_report_references(report, db)
    
    # Fetch User Config for SMTP settings
    config_model = db.query(SystemConfig).filter(SystemConfig.user_id == current_user.id).first()
    config_dict = {}
    if config_model:
        # Convert model to dict for simpler consumption
        config_dict = {
            "smtp_host": config_model.smtp_host,
            "smtp_port": config_model.smtp_port,
            "smtp_user": config_model.smtp_user,
            "smtp_password": config_model.smtp_password,
            "smtp_from_email": config_model.smtp_from_email,
            "smtp_sender_name": config_model.smtp_sender_name,
            "smtp_reply_to": config_model.smtp_reply_to
        }
        
    result = send_report_email(req.email, report, references, config=config_dict)
    return result

# Manual CORS Middleware to guarantee permission
@app.middleware("http")
async def cors_middleware(request: Request, call_next):
    from fastapi.responses import JSONResponse
    import logging
    logger = logging.getLogger("backend_middleware")
    try:
        if request.method == "OPTIONS":
            # Handle preflight directly
            response = JSONResponse(content={})
        else:
            response = await call_next(request)
    except Exception as e:
        import traceback
        logger.error(f"Middleware Caught Error: {e}")
        logger.error(traceback.format_exc())
        response = JSONResponse(content={"detail": str(e), "type": type(e).__name__}, status_code=500)
        
    origin = request.headers.get("origin")
    allowed_origin = os.getenv("FRONTEND_URL", "*") 
    
    # If FRONTEND_URL is set, strict check. If *, allow all (dev mode fallback)
    if allowed_origin == "*" or origin == allowed_origin:
        response.headers["Access-Control-Allow-Origin"] = origin if origin else "*"
    else:
        # If strict mode and origin doesn't match, technically we should block or not set header.
        # But for debugging, let's log it.
        logger.warning(f"CORS Mismatch: Origin={origin} vs Allowed={allowed_origin}")
        # We won't set the header, which blocks the browser.
        
    response.headers["Access-Control-Allow-Methods"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_credentials=False, # Disable credentials to allow wildcard origins securely (we use Bearer tokens)
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

@app.get("/")
def read_root():
    return {"status": "ok", "service": "News Aggregator Intelligence Layer"}

@app.get("/users/me")
def read_users_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email, 
        "full_name": current_user.full_name,
        "has_api_key": bool(current_user.google_api_key)
    }

from pydantic import BaseModel
class UserUpdate(BaseModel):
    google_api_key: Optional[str] = None
    full_name: Optional[str] = None

@app.patch("/users/me")
def update_user_me(user_update: UserUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if user_update.google_api_key is not None:
        # Allow clearing or setting key
        current_user.google_api_key = user_update.google_api_key if user_update.google_api_key else None
        
    if user_update.full_name is not None:
        current_user.full_name = user_update.full_name
        
    db.commit()
    return {"status": "success", "has_api_key": bool(current_user.google_api_key)}

from fastapi import BackgroundTasks
from crawler import run_crawler

@app.post("/crawl/{source_id}")
def trigger_crawl(source_id: str, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_crawler, source_id)
    return {"status": "accepted", "message": f"Crawl started for source {source_id}"}

@app.get("/sources/{source_id}/crawl-stream")
async def crawl_source_stream(source_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Experimental: Crawl a source and stream logs via SSE.
    """
    source = db.query(Source).filter(Source.id == source_id, Source.user_id == current_user.id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

    import json
    async def event_generator():
        # We need a separate session for the crawler to avoid conflicts with the request session
        # and to ensure it stays alive.
        from database import SessionLocal
        inner_db = SessionLocal()
        queue = asyncio.Queue()
        
        async def on_progress(msg, data=None):
            # Format: msg is string, data is optional dict
            payload = {"message": msg}
            if data: payload.update(data)
            await queue.put(payload)

        try:
            crawler = CrawlerService(inner_db)
            # Start crawl in background
            crawl_task = asyncio.create_task(crawler.crawl_source_async(source_id, on_progress=on_progress))
            
            while True:
                # If task is done, we might still have items in the queue
                if crawl_task.done() and queue.empty():
                    break
                
                try:
                    # Polling the queue
                    item = await asyncio.wait_for(queue.get(), timeout=0.5)
                    yield f"data: {json.dumps(item)}\n\n"
                except asyncio.TimeoutError:
                    # Just heartbeat/yield to check while True condition
                    # yield ": keep-alive\n\n"
                    pass
            
            # Final check for errors in the task itself
            if crawl_task.exception():
                err = str(crawl_task.exception())
                yield f"data: {json.dumps({'message': f'Internal Error: {err}', 'status': 'error'})}\n\n"

        finally:
            inner_db.close()
            yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/articles", response_model=PaginatedArticleResponse)
def read_articles(
    skip: int = 0, 
    limit: int = 20, 
    source_ids: Optional[List[str]] = Query(None),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    date_type: str = 'published', # 'published' or 'scraped'
    sort_by: str = 'published_at',
    order: str = 'desc',
    story_status: Optional[str] = None, # 'orphaned', 'connected', 'all'
    search: Optional[str] = None,
    sentiment: Optional[str] = None,
    tags: Optional[List[str]] = Query(None),
    entities: Optional[List[str]] = Query(None),
    min_relevance: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    with open("debug_log_2.txt", "a") as f:
        f.write(f"\n[read_articles] User: {current_user.email} ({current_user.id})\n")
        f.write(f"  Source IDs: {source_ids}\n")
        f.write(f"  Min Relevance: {min_relevance}\n")
    
    # Check if user has sources
    user_sources = db.query(Source).filter(Source.user_id == current_user.id).all()
    source_count = len(user_sources)
    with open("debug_log_2.txt", "a") as f:
        f.write(f"  User has {source_count} sources: {[s.name for s in user_sources]}\n")
    
    # Base Query: Join Source to ensure user ownership
    query = db.query(Article).join(Source).options(joinedload(Article.source)).filter(Source.user_id == current_user.id)
    
    # Filter by Sources
    if source_ids:
        query = query.filter(Article.source_id.in_(source_ids))
    
    # Filter by Story Status
    if story_status == 'orphaned':
        query = query.filter(Article.story_id == None)
    elif story_status == 'connected':
        query = query.filter(Article.story_id != None)
        
    # Filter by AI Attributes
    if sentiment:
        query = query.filter(Article.sentiment == sentiment)
    
    if min_relevance:
        query = query.filter(Article.relevance_score >= min_relevance)
        
    if search:
        search_filter = f"%{search}%"
        query = query.filter(or_(
            Article.raw_title.ilike(search_filter),
            Article.translated_title.ilike(search_filter),
            Article.ai_summary.ilike(search_filter),
            Article.content_snippet.ilike(search_filter)
        ))
        
    if tags:
        for tag in tags:
            # Use GLOB for strict case-sensitive matching
            query = query.filter(Article.tags.op('GLOB')(f"*{tag}*"))
            
    if entities:
        for ent in entities:
            query = query.filter(Article.entities.op('GLOB')(f"*{ent}*"))
        
    # Filter by Date
    date_column = Article.published_at if date_type == 'published' else Article.scraped_at
    
    if start_date:
        if start_date.tzinfo is None:
            start_date = start_date.replace(tzinfo=timezone.utc)
        query = query.filter(date_column >= start_date)
    
    if end_date:
        if end_date.tzinfo is None:
            end_date = end_date.replace(tzinfo=timezone.utc)
        query = query.filter(date_column <= end_date)
        
    # Count Total (Before Pagination)
    total_count = query.count()
    with open("debug_log_2.txt", "a") as f:
        f.write(f"  Found {total_count} articles matching filters\n")

    # Sorting
    if sort_by == 'source':
        if order == 'asc':
             query = query.order_by(asc(Source.name))
        else:
             query = query.order_by(desc(Source.name))
        # Secondary sort for stability
        query = query.order_by(desc(Article.published_at))
        
    elif sort_by == 'scraped_at':
        if order == 'asc':
            query = query.order_by(asc(Article.scraped_at))
        else:
            query = query.order_by(desc(Article.scraped_at))
            
    else: # default published_at
        if order == 'asc':
            query = query.order_by(asc(Article.published_at))
        else:
            query = query.order_by(desc(Article.published_at))

    try:
        articles = query.offset(skip).limit(limit).all()
        print(f"DEBUG: Found {len(articles)} articles")
        return {"items": articles, "total": total_count}
    except Exception as e:
        print(f"DEBUG: Error fetching articles: {e}")
        raise e

@app.delete("/articles")
def delete_all_articles(db: Session = Depends(get_db)):
    # Deletes all articles
    num_deleted = db.query(Article).delete()
    db.commit()
    return {"status": "success", "deleted_count": num_deleted}

@app.get("/articles/autocomplete")
def autocomplete_articles(q: str = Query(""), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if len(q) < 2: return []
    search_filter = f"%{q}%"
    results = db.query(Article.raw_title, Article.translated_title)\
        .join(Source)\
        .filter(Source.user_id == current_user.id)\
        .filter(or_(
            Article.raw_title.ilike(search_filter),
            Article.translated_title.ilike(search_filter)
        ))\
        .limit(10).all()
    titles = set()
    for raw, trans in results:
        titles.add(trans or raw)
    return sorted(list(titles))

@app.get("/tags/autocomplete")
def autocomplete_tags(q: str = Query(""), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    all_article_tags = db.query(Article.tags).join(Source).filter(Source.user_id == current_user.id).filter(Article.tags != None).all()
    all_story_tags = db.query(Story.tags).filter(Story.user_id == current_user.id).filter(Story.tags != None).all()
    
    found = set()
    ql = q.lower()
    for (tags,) in all_article_tags + all_story_tags:
        for t in tags:
            if ql in t.lower(): found.add(t)
            if len(found) > 50: break
    return sorted(list(found))[:20]

@app.get("/entities/autocomplete")
def autocomplete_entities(q: str = Query(""), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    all_article_ents = db.query(Article.entities).join(Source).filter(Source.user_id == current_user.id).filter(Article.entities != None).all()
    all_story_ents = db.query(Story.entities).filter(Story.user_id == current_user.id).filter(Story.entities != None).all()
    
    found = set()
    ql = q.lower()
    for (ents,) in all_article_ents + all_story_ents:
        for e in ents:
            if ql in e.lower(): found.add(e)
            if len(found) > 50: break
    return sorted(list(found))[:20]

@app.get("/articles/{article_id}", response_model=ArticleResponse)
def read_article(article_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Article -> Source -> User. Join Source to filter by user_id.
    article = db.query(Article).join(Source).filter(Article.id == article_id, Source.user_id == current_user.id).first()
    if article is None:
        raise HTTPException(status_code=404, detail="Article not found")
    
    # Manually fetch source to ensure it is populated without complex joins or lazy load issues
    if article.source_id:
        source = db.query(Source).filter(Source.id == article.source_id).first()
        article.source = source

    return article

@app.post("/articles/bulk", response_model=List[ArticleResponse])
def read_articles_bulk(article_ids: List[str], db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Fetch all articles in the list ensuring they belong to the user
    articles = db.query(Article).join(Source).filter(Article.id.in_(article_ids), Source.user_id == current_user.id).all()
    
    # Populate sources manually for safety
    for a in articles:
        if a.source_id:
            a.source = db.query(Source).filter(Source.id == a.source_id).first()
            
    return articles

@app.delete("/articles/{article_id}")
def delete_article(article_id: str, db: Session = Depends(get_db)):
    article = db.query(Article).filter(Article.id == article_id).first()
    if article is None:
        raise HTTPException(status_code=404, detail="Article not found")
    
    db.delete(article)
    db.commit()
    return {"status": "success"}

from pydantic import BaseModel
from models import Source, generate_uuid

from typing import List, Optional, Dict


@app.get("/sources", response_model=List[SourceResponse])
def read_sources(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    with open("debug_log_2.txt", "a") as f:
        f.write(f"\n[read_sources] User: {current_user.email} ({current_user.id})\n")
    # Filter by user_id to ensure isolation
    sources = db.query(Source).filter(Source.user_id == current_user.id).all()
    
    # Enrich with stats
    from datetime import datetime, timedelta
    cutoff = datetime.now() - timedelta(hours=24)
    from models import CrawlEvent
    
    results = []
    for s in sources:
        # Crawls in last 24h
        crawls_24h = db.query(CrawlEvent).filter(
            CrawlEvent.source_id == s.id, 
            CrawlEvent.created_at >= cutoff
        ).count()
        
        # Articles in last 24h
        articles_24h = db.query(CrawlEvent).with_entities(func.sum(CrawlEvent.articles_count)).filter(
            CrawlEvent.source_id == s.id,
            CrawlEvent.created_at >= cutoff
        ).scalar() or 0
        
        # Last Crawl Details
        last_crawl = db.query(CrawlEvent).filter(CrawlEvent.source_id == s.id).order_by(desc(CrawlEvent.created_at)).first()
        
        s_dict = {
            "id": s.id,
            "url": s.url,
            "name": s.name,
            "type": s.type,
            "status": s.status,
            "last_crawled_at": s.last_crawled_at,
            "crawl_interval": s.crawl_interval,
            "crawl_method": s.crawl_method,
            "config": s.config,
            "reference_name": s.reference_name,
            "crawls_24h": crawls_24h,
            "articles_24h": articles_24h,
            "last_crawl_status": last_crawl.status if last_crawl else None,
            "last_crawl_count": last_crawl.articles_count if last_crawl else None
        }
        results.append(s_dict)
        
    return results

@app.post("/sources", response_model=SourceResponse)
def create_source(source: SourceCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    logger.info(f"Creating/Updating source for user {current_user.id}: {source.url}")
    
    # Check if exists for THIS user
    existing = db.query(Source).filter(Source.url == source.url, Source.user_id == current_user.id).first()
    if existing:
        logger.info(f"Updating existing source: {existing.id}")
        # Update existing source with new details if provided
        if source.name:
            existing.name = source.name
        
        # Update method logic
        if source.crawl_method and source.crawl_method != "auto":
            existing.crawl_method = source.crawl_method
            existing.type = "rss" if source.crawl_method == "rss" else "html_generic"
        
        if source.crawl_interval:
            existing.crawl_interval = source.crawl_interval
        
        if source.reference_name is not None:
            existing.reference_name = source.reference_name
            
        db.commit()
        db.refresh(existing)
        return existing
    
    # Name: Use provided or infer from URL
    if source.name:
        name = source.name
    else:
        # Infer name from URL
        from urllib.parse import urlparse
        try:
            parsed = urlparse(source.url)
            domain = parsed.netloc.replace('www.', '')
            name = domain.split('.')[0].title()
        except:
            name = "Unknown Source"
        
    # Source Type & Method
    final_type = "html_generic"
    final_method = source.crawl_method or "auto"

    # If user explicitly chose RSS, trust them
    if final_method == 'rss' or source.type == 'rss':
        final_type = 'rss'
    # If user explicitly chose PDF, it's HTML but handled via PDF crawler
    elif final_method == 'pdf':
        final_type = 'html_generic'
    # Otherwise, if auto/html, try to detect RSS if ambiguous
    elif final_method == 'auto':
        final_type = "html_generic"
        try:
            if source.url.endswith('.xml') or source.url.endswith('.rss') or 'rss' in source.url:
                 final_type = "rss"
                 final_method = "rss" # Upgrade auto to rss
            else:
                 # Deep Inspection: Fetch content
                 import httpx
                 try:
                     # Fetch first 1KB to sniff content
                     resp = httpx.get(source.url, follow_redirects=True, timeout=5.0, headers={"User-Agent": "Mozilla/5.0"})
                     content_start = resp.text[:1000].lower()
                     
                     # Check for RSS/Atom signatures
                     if '<rss' in content_start or '<feed' in content_start or ('<?xml' in content_start and '<html' not in content_start):
                         final_type = "rss"
                         final_method = "rss"
                 except:
                     pass
        except:
            pass
    
    db_source = Source(
        id=generate_uuid(), 
        url=source.url, 
        name=name, 
        type=final_type,
        crawl_interval=source.crawl_interval,
        crawl_method=final_method,
        config=source.crawl_config or {},
        reference_name=source.reference_name,
        user_id=current_user.id # Assign to current user
    )
    
    db.add(db_source)
    db.commit()
    db.refresh(db_source)
    
    logger.info(f"New source created: {db_source.id}")
    
    # Trigger first crawl in background
    trigger_crawl(db_source.id, background_tasks=BackgroundTasks()) 
    
    return db_source

@app.delete("/sources/{source_id}")
def delete_source(source_id: str, delete_articles: bool = True, db: Session = Depends(get_db)):
    source = db.query(Source).filter(Source.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
        
    if not delete_articles:
        # Keep articles: Backup name and unlink
        articles = db.query(Article).filter(Article.source_id == source_id).all()
        for a in articles:
            a.source_name_backup = source.name
            a.source_id = None
        db.commit()
    
    # If delete_articles=True, cascade delete handles it
    db.delete(source)
    db.commit()
    return {"status": "success", "message": "Source deleted"}

# Removed redundant SourceUpdate local class to use schemas.SourceUpdate instead

@app.patch("/sources/{source_id}")
def update_source(source_id: str, source_update: SourceUpdate, db: Session = Depends(get_db)):
    db_source = db.query(Source).filter(Source.id == source_id).first()
    if not db_source:
        raise HTTPException(status_code=404, detail="Source not found")
    
    if source_update.name is not None:
        db_source.name = source_update.name
    if source_update.status is not None:
        db_source.status = source_update.status
    if source_update.crawl_interval is not None:
        db_source.crawl_interval = source_update.crawl_interval
    if source_update.crawl_config is not None:
        # Merge or replace? Let's replace for simplicity
        db_source.config = source_update.crawl_config
        
    if source_update.reference_name is not None:
        db_source.reference_name = source_update.reference_name
        
    db.commit()
    db.refresh(db_source) # Ensure we return fresh data
    return db_source

from models import SystemConfig

import os

@app.get("/settings")
def get_settings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    config = db.query(SystemConfig).filter(SystemConfig.user_id == current_user.id).first()
    if not config:
        # Auto-create if missing for this user
        config = SystemConfig(
            user_id=current_user.id,
            first_crawl_lookback_hours=24,
            min_text_length=200,
            default_crawl_interval_mins=15
        )
        db.add(config)
        db.commit()
        db.refresh(config)
    
    # Prefill with Environment Variables if not set in DB (for UI convenience)
    # The user might be running with ENV vars but hasn't saved them to DB yet.
    if not config.smtp_host and os.getenv("SMTP_HOST"):
        config.smtp_host = os.getenv("SMTP_HOST")
    if not config.smtp_port and os.getenv("SMTP_PORT"):
        try:
            config.smtp_port = int(os.getenv("SMTP_PORT"))
        except:
            pass
    if not config.smtp_user and os.getenv("SMTP_USER"):
        config.smtp_user = os.getenv("SMTP_USER")
    if not config.smtp_password and os.getenv("SMTP_PASS"):
        config.smtp_password = os.getenv("SMTP_PASS")
    if not config.smtp_from_email and os.getenv("SMTP_FROM"):
        config.smtp_from_email = os.getenv("SMTP_FROM")
    if not config.smtp_sender_name and os.getenv("SMTP_SENDER_NAME"):
        config.smtp_sender_name = os.getenv("SMTP_SENDER_NAME")
    if not config.smtp_reply_to and os.getenv("SMTP_REPLY_TO"):
        config.smtp_reply_to = os.getenv("SMTP_REPLY_TO")

    return config

import schemas

@app.patch("/settings")
async def update_settings(settings: schemas.SettingsUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        config = db.query(SystemConfig).filter(SystemConfig.user_id == current_user.id).first()
        if not config:
            config = SystemConfig(user_id=current_user.id)
            db.add(config)
        
        data = settings.dict(exclude_unset=True)
        with open("debug_log_2.txt", "a") as f:
            f.write(f"\n[update_settings] Updating with data: {data}\n")
            
        for key, value in data.items():
            if hasattr(config, key):
                setattr(config, key, value)
            else:
                with open("debug_log_2.txt", "a") as f:
                    f.write(f"  WARNING: Field {key} not found on SystemConfig model\n")
            
        db.commit()
        db.refresh(config)
        return schemas.SettingsSchema.model_validate(config)
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        with open("debug_log_2.txt", "a") as f:
            f.write(f"  ERROR updated_settings: {str(e)}\n{error_trace}\n")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/ai/models")
def list_ai_models(current_user: User = Depends(get_current_user)):
    if not current_user.google_api_key:
        return []
    
    try:
        from google import genai
        client = genai.Client(api_key=current_user.google_api_key)
        # Assuming list_models returns a pager or list of models
        # We need to check the attributes of the new model object
        models = client.models.list()
        
        supported_models = []
        for m in models:
             # The new SDK model object has different attributes. 
             # We look for models that support 'generateContent'.
             # Note: logic might differ slightly, but usually filter by capability.
             # For now, let's just grab gemini models.
             if "gemini" in m.name.lower() or "flash" in m.name.lower():
                 mid = m.name.replace("models/", "")
                 supported_models.append({
                     "id": mid,
                     "name": m.display_name or mid
                 })
                 
        return sorted(supported_models, key=lambda x: x['name'])
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Failed to list models: {e}")
        # Fallback to known stable models in correct format
        return [
            {"id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash (Fallback)"},
            {"id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro (Fallback)"},
            {"id": "gemini-2.0-flash-lite", "name": "Gemini 2.0 Flash Lite (Fallback)"}
        ]

@app.get("/api/ai/defaults")
def get_ai_defaults():
    from ai_service import DEFAULT_ANALYSIS_PROMPT
    from clustering import DEFAULT_CLUSTERING_PROMPT
    from report_generator import DEFAULT_REPORT_PROMPT
    from crawler import DEFAULT_PDF_CRAWL_PROMPT
    
    return {
        "analysis_prompt": DEFAULT_ANALYSIS_PROMPT.strip(),
        "clustering_prompt": DEFAULT_CLUSTERING_PROMPT.strip(),
        "report_prompt": DEFAULT_REPORT_PROMPT.strip(),
        "pdf_crawl_prompt": DEFAULT_PDF_CRAWL_PROMPT.strip(),
        "analysis_model": "gemini-2.5-flash-lite",
        "clustering_model": "gemini-2.5-flash-lite",
        "report_model": "gemini-2.5-flash-lite",
        "pdf_crawl_model": "gemini-2.5-flash-lite"
    }

# ==========================================
# STORIES / CLUSTERING ENDPOINTS
# ==========================================

@app.get("/clustering/status/{event_id}")
def get_clustering_status(event_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from models import ClusteringEvent
    event = db.query(ClusteringEvent).filter(ClusteringEvent.id == event_id, ClusteringEvent.user_id == current_user.id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    return {
        "id": event.id,
        "status": event.status,
        "input_stories": event.input_stories_count,
        "input_articles": event.input_articles_count,
        "new_stories": event.new_stories_created,
        "assignments": event.assignments_made,
        "unclustered": event.unclustered_articles_count,
        "error": event.error_message,
        "created_at": event.created_at,
        "completed_at": event.completed_at
    }

@app.post("/stories/generate")
def generate_stories(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Trigger AI analysis to group recent articles into stories.
    Runs in background to avoid timeout.
    """
    if not current_user.google_api_key:
        raise HTTPException(status_code=400, detail="Google API Key required for clustering.")
        
    from clustering import analyze_clusters
    from models import ClusteringEvent
    
    # Create Event Record
    event = ClusteringEvent(
        user_id=current_user.id,
        status="queued"
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    
    logger.info(f"Manual clustering triggered. Event ID: {event.id}")
    
    # Run in BACKGROUND
    background_tasks.add_task(run_clustering_background, event.id, current_user.id, current_user.google_api_key)
    
    return {"status": "queued", "event_id": event.id}

def run_clustering_background(event_id: str, user_id: str, api_key: str):
    """
    Wrapper to run clustering in background with its own DB session.
    """
    from database import SessionLocal
    from clustering import analyze_clusters
    from models import SystemConfig
    
    db = SessionLocal()
    try:
        analyze_clusters(db, user_id, api_key, event_id=event_id)
        
        # Update last_clustering_at
        config = db.query(SystemConfig).filter(SystemConfig.user_id == user_id).first()
        if config:
            config.last_clustering_at = datetime.now(timezone.utc)
            db.commit()
            
    except Exception as e:
        logger.error(f"Background Clustering Error: {e}", exc_info=True)
    finally:
        db.close()

@app.get("/stories", response_model=PaginatedStoryResponse)
def read_stories(
    skip: int = 0,
    limit: int = 20,
    min_strength: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    sentiment: Optional[str] = None,
    sort_by: str = 'updated_at',
    order: str = 'desc',
    search: Optional[str] = None,
    tags: Optional[List[str]] = Query(None),
    entities: Optional[List[str]] = Query(None),
    source_ids: Optional[List[str]] = Query(None),
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """
    Get all stories for a user with enhanced filtering and sorting.
    """
    from models import Story, Article
    from sqlalchemy import func
    
    subq = db.query(
        Article.story_id,
        func.count(Article.id).label('article_count'),
        func.max(Article.published_at).label('max_pub')
    ).group_by(Article.story_id).subquery()
    
    query = db.query(Story, subq.c.article_count).outerjoin(subq, Story.id == subq.c.story_id).filter(Story.user_id == current_user.id)
    
    if sentiment:
        query = query.filter(Story.sentiment == sentiment)

    # Filtering
    if min_strength:
        query = query.filter(subq.c.article_count >= min_strength)

    if search:
        search_filter = f"%{search}%"
        query = query.filter(or_(
            Story.headline.ilike(search_filter),
            Story.main_summary.ilike(search_filter)
        ))
        
    if tags:
        for tag in tags:
            query = query.filter(Story.tags.like(f"%{tag}%"))
            
    if entities:
        for ent in entities:
            query = query.filter(Story.entities.like(f"%{ent}%"))
            
    if source_ids:
        # Filter stories that have at least one article from these sources
        story_ids_with_sources = db.query(Article.story_id).filter(Article.source_id.in_(source_ids)).distinct().subquery()
        query = query.join(story_ids_with_sources, Story.id == story_ids_with_sources.c.story_id)
    
    if start_date or end_date:
        at_least_one_article = db.query(Article.story_id).filter(Article.story_id != None)
        if start_date:
            if start_date.tzinfo is None: start_date = start_date.replace(tzinfo=timezone.utc)
            at_least_one_article = at_least_one_article.filter(Article.published_at >= start_date)
        if end_date:
            if end_date.tzinfo is None: end_date = end_date.replace(tzinfo=timezone.utc)
            at_least_one_article = at_least_one_article.filter(Article.published_at <= end_date)
        
        valid_date_story_ids = at_least_one_article.distinct().subquery()
        query = query.join(valid_date_story_ids, Story.id == valid_date_story_ids.c.story_id)
        
    # Sorting
    if sort_by == 'strength' or sort_by == 'article_count':
        sort_col = subq.c.article_count
    else:
        sort_col = Story.updated_at
        
    if order == 'asc':
        query = query.order_by(asc(sort_col))
    else:
        query = query.order_by(desc(sort_col))
        
    total = query.count()
    results_raw = query.offset(skip).limit(limit).all()
    
    items = []
    for story, count in results_raw:
        # Re-fetch children with joined source to ensure Pydantic can serialize it
        children = db.query(Article)\
            .options(joinedload(Article.source))\
            .filter(Article.story_id == story.id)\
            .order_by(desc(Article.published_at))\
            .all()
            
        items.append({
            "id": story.id,
            "headline": story.headline,
            "main_summary": story.main_summary,
            "extended_account": story.extended_account,
            "updated_at": story.updated_at,
            "created_at": story.created_at,
            "articles": children,
            "article_count": count or 0,
            "sentiment": story.sentiment,
            "tags": story.tags,
            "entities": story.entities
        })
        
    return {"items": items, "total": total}

@app.get("/stories/{story_id}", response_model=StoryResponse)
def read_story(story_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Get full details for a single story including all articles.
    """
    from models import Story, Article
    story = db.query(Story).options(
        joinedload(Story.articles).joinedload(Article.source)
    ).filter(Story.id == story_id, Story.user_id == current_user.id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    
    # Manually attach count for the schema
    story.article_count = len(story.articles)
    return story

# --- REPORTS ---



@app.get("/reports")
def read_reports(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Report).filter(Report.user_id == current_user.id).order_by(desc(Report.created_at)).all()

@app.post("/reports/generate")
def generate_report(
    req: schemas.ReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    import google.generativeai as genai
    import time
    
    start_time = time.time()
    
    if not current_user.google_api_key:
        raise HTTPException(status_code=400, detail="Google API Key required. Please configure it in settings.")
        
    genai.configure(api_key=current_user.google_api_key)
    
    # DEBUG LOGGING (Temporary)
    try:
        with open("backend_debug_log.txt", "a") as f:
            f.write(f"Generating report: {req.title}\n")
    except: pass
    
    # 1. Fetch Articles based on filters or article_ids
    if req.article_ids:
        query = db.query(Article).join(Source).filter(
            Source.user_id == current_user.id,
            Article.id.in_(req.article_ids)
        )
    else:
        # Re-use filtering logic from read_articles
        query = db.query(Article).join(Source).filter(Source.user_id == current_user.id)
        
        try:
            if len(req.start_date) == 10: 
                start_dt = datetime.strptime(req.start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            else:
                start_dt = datetime.fromisoformat(req.start_date.replace("Z", "+00:00"))
                if start_dt.tzinfo is None: start_dt = start_dt.replace(tzinfo=timezone.utc)

            if len(req.end_date) == 10: 
                end_dt = datetime.strptime(req.end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
            else:
                end_dt = datetime.fromisoformat(req.end_date.replace("Z", "+00:00"))
                if end_dt.tzinfo is None: end_dt = end_dt.replace(tzinfo=timezone.utc)
        except ValueError:
             raise HTTPException(status_code=400, detail="Invalid date format")

        date_column = Article.published_at if req.date_type == 'published' else Article.scraped_at
        query = query.filter(date_column >= start_dt, date_column <= end_dt)

        if req.source_ids:
            query = query.filter(Article.source_id.in_(req.source_ids))
        
        if req.sentiment:
            query = query.filter(Article.sentiment == req.sentiment)
        
        if req.min_relevance:
            query = query.filter(Article.relevance_score >= req.min_relevance)
            
        if req.story_status == 'orphaned':
            query = query.filter(Article.story_id == None)
        elif req.story_status == 'connected':
            query = query.filter(Article.story_id != None)

        if req.search:
            search_filter = f"%{req.search}%"
            query = query.filter(or_(
                Article.raw_title.ilike(search_filter),
                Article.translated_title.ilike(search_filter),
                Article.ai_summary.ilike(search_filter),
                Article.content_snippet.ilike(search_filter)
            ))
            
        if req.tags:
            for tag in req.tags:
                query = query.filter(Article.tags.like(f"%{tag}%"))
                
        if req.entities:
            for ent in req.entities:
                query = query.filter(Article.entities.like(f"%{ent}%"))

    # Sorting and limit for context
    articles = query.order_by(desc(Article.published_at)).limit(200).all() # Safety limit reduced to 200 for better quality/conciseness
    
    if not articles:
        raise HTTPException(status_code=400, detail="No articles found matching the current filters.")

    # 2. Prepare Context
    context = ""
    for a in articles:
        context += f"ID: {a.id}\nTitle: {a.translated_title or a.raw_title}\nSource: {a.source.name if a.source else 'Unknown'}\nContent: {(a.translated_content_snippet or a.content_snippet or '')[:800]}\n\n"
        
    # Fetch User Config for Model Selection
    config_model = db.query(SystemConfig).filter(SystemConfig.user_id == current_user.id).first()
    selected_model = config_model.report_model if config_model and config_model.report_model else 'gemini-2.0-flash'
    
    # DEBUG LOGGING
    try:
        with open("backend_debug_log.txt", "a") as f:
            f.write(f"Using model: {selected_model}\n")
    except: pass
        
    model = genai.GenerativeModel(selected_model) 

    # Prepare Context Variables for Interpolation
    prompt_variables = {
        "title": req.title,
        "subtitle": req.subtitle or "",
        "author": req.author or "AI Analyst",
        "scope": req.scope,
        "headings": ", ".join(req.headings),
        "articles": context
    }
    
    # Use user-defined prompt if exists, otherwise default persona
    base_instruction = config_model.report_prompt if config_model and config_model.report_prompt else "You are an expert news analyst. Write a comprehensive report based ONLY on the provided articles."
    
    # Check for Template Override
    if req.template_id:
        from models import ReportTemplate
        template = db.query(ReportTemplate).filter(ReportTemplate.id == req.template_id, ReportTemplate.user_id == current_user.id).first()
        if template and template.prompt_override:
            # Use user-defined prompt override, supporting basic interpolation
            base_instruction = template.prompt_override
            try:
                base_instruction = base_instruction.format(**prompt_variables)
            except Exception as fmt_ex:
                logger.warning(f"Failed to format prompt override: {fmt_ex}")

    
    prompt = f"""
    {base_instruction}
    
    --- 
    # {req.title}
    {f"## {req.subtitle}" if req.subtitle else ""}
    {f"Author: {req.author}" if req.author else ""}

    ## Executive Summary
    (Synthesize the main themes)
    
    Then, for each of these headings, write a detailed section citing specific articles:
    {', '.join(req.headings)}
    
    Use a professional tone.
    IMPORTANT: Cite sources using this EXACT format: [[CITATION:ARTICLE_ID]]. 
    Do NOT group citations (e.g., [[ID, ID]] or [[ID], [ID]]). Cite each one individually.
    do NOT use markdown links, just this tag.
    
    REPORT SCOPE:
    {req.scope}

    ARTICLES:
    {context}
    """
    try:
        response = model.generate_content(prompt)
        content = response.text
        
        # Capture Diagnostics
        try:
            usage = getattr(response, 'usage_metadata', None)
            tokens_in = usage.prompt_token_count if usage else 0
            tokens_out = usage.candidates_token_count if usage else 0
        except Exception as meta_ex:
            print(f"Meta error: {meta_ex}")
            tokens_in = 0
            tokens_out = 0

        duration_ms = int((time.time() - start_time) * 1000)
        model_name = selected_model
        
        # DEBUG LOGGING
        try:
            with open("backend_debug_log.txt", "a") as f:
                f.write(f"Success! Dur: {duration_ms}ms, Tok: {tokens_in}/{tokens_out}\n")
        except: pass
        
    except Exception as e:
        # DEBUG LOGGING
        try:
            with open("backend_debug_log.txt", "a") as f:
                f.write(f"ERROR: {str(e)}\n")
        except: pass
        print(f"GenAI Error: {e}")
        raise HTTPException(status_code=500, detail=f"AI Generation Failed: {str(e)}")
        
    # 3. Post-Processing & Formatting (New Pipeline Logic)
    final_content = content
    formatting_params = {}
    citation_type = "numeric_superscript"
    
    # Try to find a formatting style if not explicitly provided
    active_fmt_id = req.formatting_id
    if not active_fmt_id:
        from models import FormattingLibrary
        # Try to find the "Manual" style or just use the first available
        fmt_lib = db.query(FormattingLibrary).filter(FormattingLibrary.name.ilike('%manual%')).first() or \
                  db.query(FormattingLibrary).first()
        if fmt_lib:
            active_fmt_id = fmt_lib.id
            
    if active_fmt_id:
        from models import FormattingLibrary
        from pipeline_service import PipelineExecutor
        
        fmt_lib = db.query(FormattingLibrary).filter(FormattingLibrary.id == active_fmt_id).first()
        if fmt_lib:
            executor = PipelineExecutor(db)
            citation_type = getattr(fmt_lib, "citation_type", "numeric_superscript") or "numeric_superscript"
            formatting_params = getattr(fmt_lib, "parameters", {}) or {}
            
            # LOGGING for debugging
            try:
                with open("backend_debug_log.txt", "a") as f:
                    import json
                    f.write(f"Refactor Manual Report Formatting! Style: {fmt_lib.name}, Params: {json.dumps(formatting_params)}\n")
            except: pass

            # Prepare AI Content object for processing
            ai_content_obj = {"body": content}
            
            # Reconcile references and format citations
            processed_ai_content = executor._post_process_report_content(
                ai_content_obj, 
                articles, 
                {}, # empty context
                citation_type=citation_type,
                formatting_params=formatting_params
            )
            
            # Execute Jinja2 formatting
            final_content = executor._execute_formatting(fmt_lib, processed_ai_content, {})
        
    # 4. Save Report
    report = Report(
        user_id=current_user.id,
        title=req.title,
        configuration=req.dict(),
        content=final_content,
        status="completed",
        meta_duration_ms=duration_ms,
        meta_model=model_name,
        meta_tokens_in=tokens_in,
        meta_tokens_out=tokens_out,
        meta_prompt=prompt
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    
    return report

@app.delete("/reports/{report_id}")
def delete_report(report_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    report = db.query(Report).filter(Report.id == report_id, Report.user_id == current_user.id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    db.delete(report)
    db.commit()
    return {"status": "success"}
