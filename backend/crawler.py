import logging
import asyncio
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from database import SessionLocal
from models import Source, Article, CrawlEvent, generate_uuid, SystemConfig, User
from playwright.async_api import async_playwright
import trafilatura
from bs4 import BeautifulSoup
import httpx
from ai_service import AIService, normalize_metadata
from zoneinfo import ZoneInfo
from urllib.parse import urlparse
from logger_config import setup_logger
import time

DEFAULT_PDF_CRAWL_PROMPT = """
You are a specialized news extraction engine. Analyze this web page snapshot.
Current Date/Time (UTC): {current_time}

Extract ALL news items, articles, updates, or headlines found in the visual layout.
Treat short news snippets or list items as valid articles.

For each item, output a JSON object with:
- headline: The main title or first sentence of the news.
- content: A comprehensive summary or the full text of the item.
- published_at: The best inferred ISO 8601 UTC timestamp. If relative time (e.g. '25 mins ago') is present, calculate it.
- relevance_score: A number from 0 to 100 indicating how relevant it is to Macroeconomics, Politics, or Trade.

Return ONLY a JSON list of these objects.
"""

# Configure logging
logger = setup_logger(__name__)

class CrawlerService:
    def __init__(self, db: Session):
        self.db = db
        self.ai = AIService()
        
        # Load System Config
        self.sys_config = self.db.query(SystemConfig).first()
        if not self.sys_config:
            self.sys_config = SystemConfig(id=1) # Use defaults
            
    def _get_config(self, source: Source, key: str, default):
        # Priority: Source Config > System Config > Default
        if source.config and key in source.config:
            return source.config[key]
        
        # System Config Mapping
        sys_map = {
            'min_length': 'min_text_length',
            'max_articles': 'max_articles_to_scrape',
            'timeout': 'page_load_timeout_seconds',
            'min_relevance': 'min_relevance_score',
            'lookback': 'first_crawl_lookback_hours'
        }
        
        if key in sys_map:
             sys_val = getattr(self.sys_config, sys_map[key], None)
             if sys_val is not None: return sys_val
             
        return default

    async def crawl_source_async(self, source_id: str, on_progress=None):
        source = self.db.query(Source).filter(Source.id == source_id).first()
        if not source:
            logger.error(f"Source {source_id} not found")
            return

        # Update status to crawling
        source.status = 'crawling'
        self.db.commit()
        
        if on_progress: await on_progress(f"Starting async crawl for: {source.url}")
        logger.info(f"Starting async crawl for: {source.url}")

        # --- MULTI-TENANCY: LOAD OWNER CONFIG ---
        user_config = self.db.query(SystemConfig).filter(SystemConfig.user_id == source.user_id).first()
        if user_config:
            self.sys_config = user_config
            
        # 2. Get User's API Key
        user = self.db.query(User).filter(User.id == source.user_id).first()
        user_api_key = user.google_api_key if user else None
        
        # 3. Initialize AI Service with User's Key
        self.ai = AIService(api_key=user_api_key)
        # ----------------------------------------
        
        # Store source for use in helper methods
        self.current_source = source
        self.current_source_config = source.config if source.config else {}
        
        # Log Topic Focus
        topic_focus = self.sys_config.content_topic_focus if self.sys_config else "Economics, Trade, Politics, or Finance"
        if on_progress: await on_progress(f"AI Topic Focus: {topic_focus}")
        
        stats = {"status": "error", "articles": 0}

        try:
            if source.crawl_method == 'pdf':
                if on_progress: await on_progress("Starting Visual AI (PDF) crawl...")
                stats = await self._crawl_dynamic_pdf(source, on_progress=on_progress)
            elif source.type == 'rss':
                if on_progress: await on_progress("Starting RSS feed crawl...")
                stats = await self._crawl_rss(source, on_progress=on_progress)
            else:
                if on_progress: await on_progress("Starting Smart HTML crawl...")
                stats = await self._crawl_html_async(source, on_progress=on_progress)
            
            # Success
            source.last_crawled_at = datetime.now()
            source.status = 'active'
            
            # Log Event
            log = CrawlEvent(
                id=generate_uuid(),
                source_id=source.id,
                status='success',
                articles_count=stats['articles']
            )
            self.db.add(log)
            self.db.commit()
            
        except Exception as e:
            logger.error(f"Crawl failed for {source.url}: {e}")
            source.status = 'error'
            source.last_crawled_at = datetime.now() # Update time to prevent immediate retry loop
            
            # Log Failure
            log = CrawlEvent(
                id=generate_uuid(),
                source_id=source.id,
                status='error',
                articles_count=0
            )
            self.db.add(log)
            self.db.commit()

    def _is_valid_article(self, title: str, text: str, date: datetime, last_crawled_at: datetime = None) -> tuple[bool, str]:
        # 1. Date Filter
        if date:
            d_aware = date
            if d_aware.tzinfo is None: 
                d_aware = d_aware.replace(tzinfo=timezone.utc)
            
            now_utc = datetime.now(timezone.utc)

            if last_crawled_at:
                l_aware = last_crawled_at
                if l_aware.tzinfo is None: 
                    l_aware = l_aware.replace(tzinfo=timezone.utc)
                
                if d_aware < l_aware:
                    return False, f"Older than last crawl ({d_aware.strftime('%Y-%m-%d %H:%M')})"
            else:
                lookback = self._get_config(self.current_source, 'lookback', 24)
                cutoff = now_utc - timedelta(hours=lookback)
                if d_aware < cutoff:
                    return False, f"Older than {lookback}h lookback ({d_aware.strftime('%Y-%m-%d %H:%M')})"
        else:
            return False, "No publication date found"

        # 2. Length Filter
        min_length = self._get_config(self.current_source, 'min_length', 200)
        curr_len = len(text) if text else 0
        if curr_len < min_length:
            return False, f"Content too short ({curr_len} < {min_length} chars)"
            
        return True, "Valid"
    async def _crawl_rss(self, source: Source, on_progress=None):
        import feedparser
        logger.info(f"Crawling RSS: {source.url}")
        
        # Use httpx to fetch potential redirects/headers
        async with httpx.AsyncClient(follow_redirects=True) as client:
            resp = await client.get(source.url, headers={"User-Agent": "Mozilla/5.0"})
            resp.raise_for_status()
            content = resp.content
            
        feed = feedparser.parse(content)
        if on_progress: await on_progress(f"Parsed RSS feed. Found {len(feed.entries)} entries.")
        logger.info(f"Found {len(feed.entries)} RSS entries")
        
        valid_count = 0
        max_items = self._get_config(source, 'max_articles', 100)
        
        for entry in feed.entries[:max_items]:
            url = entry.link
            
            # Check DB (Per Source Isolation)
            existing = self.db.query(Article).filter(
                Article.url == url,
                Article.source_id == source.id
            ).first()
            
            if existing: 
                logger.info(f"[DECISION] DISCARDED: '{entry.title}' | Reason: Duplicate URL for this source")
                if on_progress: await on_progress(f"Skipping duplicate: {entry.title}", {"status": "warning"})
                continue
            
            logger.info(f"Processing RSS entry: {url}")
            
            summary = ""
            try:
                downloaded = trafilatura.fetch_url(url)
                if downloaded:
                     result = trafilatura.extract(downloaded, output_format='json', with_metadata=True)
                     if result:
                         import json
                         data = json.loads(result)
                         if data.get('text'):
                             summary = data.get('text')[:1000] + "..." if len(data.get('text')) > 1000 else data.get('text')
            except:
                pass
            
            if not summary and hasattr(entry, 'summary'):
                summary = entry.summary
                
            published_at = datetime.now(timezone.utc)
            if hasattr(entry, 'published_parsed') and entry.published_parsed:
                 # published_parsed is a time.struct_time in UTC usually.
                 # datetime(*tuple) creates a naive datetime. We must attach UTC.
                 published_at = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)

            # VALIDATION
            is_valid, reason = self._is_valid_article(entry.title, summary, published_at, source.last_crawled_at)
            if not is_valid:
                logger.info(f"Skipping article: {entry.title} | Reason: {reason}")
                if on_progress: await on_progress(f"Skipping ({reason}): {entry.title}", {"status": "warning"})
                continue
            
            logger.info(f"Valid Article Found: {entry.title}. Sending to AI...")
            if on_progress: await on_progress(f"Analyzing article: {entry.title}")

            # AI ENRICHMENT (Post-Validation) - Global only as requested
            topic_focus = self.sys_config.content_topic_focus if self.sys_config else "Economics, Trade, Politics, or Finance"
            analysis_model = self.sys_config.analysis_model if self.sys_config else "gemini-2.0-flash-lite"
            analysis_prompt = self.sys_config.analysis_prompt if self.sys_config else None
            
            ai_data = await self.ai.analyze_article(
                entry.title, 
                summary, 
                topic_focus,
                model_name=analysis_model,
                custom_prompt=analysis_prompt
            )
            # Relevance Check
            is_relevant = ai_data.get('is_relevant', True)
            score = ai_data.get('relevance_score', 0)
            
            min_relevance = self._get_config(source, 'min_relevance', 50)
            if is_relevant is False or score < min_relevance:
                logger.info(f"[DECISION] DISCARDED: '{entry.title}' | Reason: AI Relevance (Relevant={is_relevant}, Score={score}, Required={min_relevance})")
                if on_progress: await on_progress(f"Skipping (Low relevance: {score}): {entry.title}", {"status": "warning"})
                continue

            article = Article(
                id=generate_uuid(),
                source_id=source.id,
                url=url,
                raw_title=entry.title,
                generated_summary=summary, 
                published_at=published_at,
                # AI Fields
                language=ai_data.get('language', 'en'),
                
                # Content - Prefer cleaned AI text
                content_snippet=ai_data.get('cleaned_text_original') if ai_data.get('cleaned_text_original') else (summary or entry.summary),

                translated_title=ai_data.get('translated_title'),
                translated_content_snippet=ai_data.get('translated_text'), 
                translated_generated_summary=ai_data.get('ai_summary_en'),

                relevance_score=ai_data.get('relevance_score', 0),
                
                tags=normalize_metadata(ai_data.get('tags_en')),
                tags_original=normalize_metadata(ai_data.get('tags_original')),
                
                entities=normalize_metadata(ai_data.get('entities_en')),
                entities_original=normalize_metadata(ai_data.get('entities_original')),
                
                sentiment=ai_data.get('sentiment'),
                
                ai_summary=ai_data.get('ai_summary_en'),
                ai_summary_original=ai_data.get('ai_summary_original')
            )
            try:
                self.db.add(article)
                self.db.commit()
                valid_count += 1
                if on_progress: await on_progress(f"Success! Acquired: {entry.title}", {"status": "success"})
            except IntegrityError:
                self.db.rollback()
                logger.info(f"Article already exists: {url}")
                if on_progress: await on_progress(f"Skipping (DB Duplicate): {entry.title}", {"status": "warning"})
                continue
            except Exception as e:
                self.db.rollback()
                logger.error(f"Failed to save article: {e}")
                if on_progress: await on_progress(f"Error saving: {entry.title} ({str(e)})", {"status": "error"})
                continue
            
        return {"status": "success", "articles": valid_count}

    async def _crawl_html_async(self, source: Source, on_progress=None):
        # 1. Fetch HTML
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(source.url, headers={
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                })
                response.raise_for_status()
                html_content = response.text
                logger.info(f"Fetched HTML: {len(html_content)} bytes")
                if on_progress: await on_progress(f"Downloaded HTML ({len(html_content)} bytes). Starting AI extraction...")
        except Exception as e:
            logger.error(f"Failed to fetch {source.url}: {e}")
            return {"status": "error", "message": str(e)}

        # 2. Clean HTML for AI (Keep tags but remove bloat)
        soup = BeautifulSoup(html_content, 'lxml')
        for tag in soup(['script', 'style', 'svg', 'path', 'iframe', 'footer', 'nav']):
            tag.decompose()
        
        # Convert back to string but limit size to avoid extreme token usage
        # 50k chars is usually plenty for an index page structure
        html_snapshot = str(soup)[:50000] 
        logger.info(f"HTML Snapshot for AI: {len(html_snapshot)} chars")
        
        # 3. AI Extraction
        extraction_model = self.sys_config.analysis_model if self.sys_config else "gemini-2.0-flash-lite"
        extraction_prompt = f"""
Find and extract all news articles from the following HTML source.
Return a valid JSON array of objects. Each object MUST have:
- "headline": The title of the news.
- "url": The FULL absolute URL of the news article. If the URL in the HTML is relative (e.g. "/news/123"), you MUST prepend the base domain: {source.url}
- "snippet": A brief summary or opening text if visible in the HTML.
- "date": The publication date in ISO format (if found).

HTML Content:
---
{html_snapshot}
"""
        
        try:
            # We use analyze_article but with a custom one-shot extraction prompt
            # For simplicity, we'll use ai.call directly if available, or analyze_article with override
            # Actually, ai_service has call() for generic tasks.
            json_str = await self.ai.call(extraction_prompt, model_name=extraction_model, response_mime_type="application/json")
            
            if not json_str:
                logger.error("AI returned empty response for extraction")
                return {"status": "error", "message": "AI returned empty response"}
                
            import json
            try:
                items = json.loads(json_str)
            except json.JSONDecodeError as je:
                logger.error(f"AI returned invalid JSON: {json_str[:500]}...")
                return {"status": "error", "message": "AI returned invalid JSON"}

            if isinstance(items, dict):
                items = items.get('articles', []) or items.get('items', [])
            
            if on_progress: await on_progress(f"AI extracted {len(items)} possible news items.")
            
            if not isinstance(items, list):
                logger.error(f"AI returned unexpected format: {type(items)}")
                return {"status": "error", "message": "Unexpected AI output format"}
        except Exception as e:
            logger.error(f"AI Extraction failed: {e}")
            return {"status": "error", "message": "AI parsing failed"}

        max_articles = self._get_config(source, 'max_articles', 100)
        count = 0
        
        for item in items[:max_articles]:
            headline = item.get('headline')
            url = item.get('url')
            snippet = item.get('snippet')
            
            if not headline or not url: continue
            
            # Deduplicate
            existing = self.db.query(Article).filter(
                Article.source_id == source.id,
                Article.url == url
            ).first()
            
            if existing: 
                if on_progress: await on_progress(f"Skipping duplicate: {headline}", {"status": "warning"})
                continue
            
            logger.info(f" - [SMART AI] Found Article: {headline}")
            if on_progress: await on_progress(f"Analyzing article: {headline}")
            
            # 4. Full AI Enrichment (Global strategy)
            topic_focus = self.sys_config.content_topic_focus if self.sys_config else "Economics, Trade, Politics, or Finance"
            analysis_model = self.sys_config.analysis_model if self.sys_config else "gemini-2.0-flash-lite"
            analysis_prompt = self.sys_config.analysis_prompt if self.sys_config else None
            
            try:
                ai_data = await self.ai.analyze_article(
                    headline, 
                    snippet, 
                    topic_focus,
                    model_name=analysis_model,
                    custom_prompt=analysis_prompt
                )
            except Exception as ai_err:
                logger.error(f"AI Analysis failed for {headline}: {ai_err}")
                if on_progress: await on_progress(f"AI Failed: {ai_err}", {"status": "error"})
                ai_data = {}
            
            # Relevance Check
            min_relevance = self._get_config(source, 'min_relevance', 50)
            if ai_data.get('is_relevant', True) is False or ai_data.get('relevance_score', 0) < min_relevance:
                if on_progress: await on_progress(f"Skipping (Low relevance): {headline}", {"status": "warning"})
                continue

            # Save
            article = Article(
                id=generate_uuid(),
                source_id=source.id,
                url=url,
                raw_title=headline,
                generated_summary=ai_data.get('ai_summary_en') or snippet,
                content_snippet=ai_data.get('cleaned_text_original') or snippet,
                published_at=datetime.now(timezone.utc), # Date parsing from AI could be improved
                language=ai_data.get('language', 'en'),
                translated_title=ai_data.get('translated_title'),
                relevance_score=ai_data.get('relevance_score', 0),
                tags=normalize_metadata(ai_data.get('tags_en')),
                tags_original=normalize_metadata(ai_data.get('tags_original')),
                entities=normalize_metadata(ai_data.get('entities_en')),
                entities_original=normalize_metadata(ai_data.get('entities_original')),
                sentiment=ai_data.get('sentiment'),
                ai_summary=ai_data.get('ai_summary_en')
            )
            try:
                self.db.add(article)
                self.db.commit()
                count += 1
                if on_progress: await on_progress(f"Success! Acquired: {headline}", {"status": "success"})
            except IntegrityError:
                self.db.rollback()
                logger.info(f"Article already exists: {url}")
                if on_progress: await on_progress(f"Skipping (DB Duplicate): {headline}", {"status": "warning"})
                continue
            except Exception as e:
                self.db.rollback()
                logger.error(f"Failed to save SMART AI article: {e}")
                if on_progress: await on_progress(f"Error saving: {headline} ({str(e)})", {"status": "error"})
                continue
            
        return {"status": "success", "articles": count}

    async def _crawl_dynamic_pdf(self, source: Source, on_progress=None):
        if on_progress: await on_progress(f"Launching headless browser for: {source.url}")
        logger.info(f"Starting Dynamic PDF Crawl: {source.url}")
        import os
        import tempfile
        
        # 1. Capture PDF
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            # Use a standard Chrome User Agent
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            page = await context.new_page()
            
            # Configure viewport for better visual capture
            await page.set_viewport_size({"width": 1280, "height": 1080}) 
            
            try:
                # Load page with generous timeout for JS
                timeout_sec = self._get_config(source, 'timeout', 60) * 1000
                await page.goto(source.url, wait_until="networkidle", timeout=timeout_sec)
                
                # Optional: Scroll to bottom to trigger lazy loading? 
                # For now, just capture what's visible/rendered.
                
                # Create Temp File
                # DEBUG: Save to local file for inspection
                tmp_path = "debug_capture.pdf" 
                
                await page.pdf(path=tmp_path)
                logger.info(f"PDF Snapshot captured: {tmp_path}")
                if on_progress: await on_progress(f"Visual snapshot captured. Sending to Vision AI...")
                
            except Exception as e:
                logger.error(f"Failed to capture PDF for {source.url}: {e}")
                await browser.close()
                return {"status": "error", "articles": 0}
                
            await browser.close()
            
        # 2. AI Analysis
        try:
            current_time = datetime.now(timezone.utc).isoformat()
            
            # Get Global Configured Prompt & Model
            model = self.sys_config.pdf_crawl_model if self.sys_config else 'gemini-2.5-flash-lite'
            raw_prompt = self.sys_config.pdf_crawl_prompt if (self.sys_config and self.sys_config.pdf_crawl_prompt) else DEFAULT_PDF_CRAWL_PROMPT
            
            # Inject variables
            full_prompt = raw_prompt.replace('{current_time}', current_time)
                
            results = await self.ai.analyze_image_or_pdf(tmp_path, full_prompt, model_name=model)
            
            # Cleanup Temp File
            try:
                os.remove(tmp_path)
            except: pass
            
            if not results or not isinstance(results, list):
                logger.warning(f"AI returned invalid format or empty list for {source.url}")
                logger.warning(f"Raw Results: {results}")
                return {"status": "success", "articles": 0}
                
            logger.info(f"AI Extracted {len(results)} items from PDF")
            
            max_items = self._get_config(source, 'max_articles', 100)
            count = 0
            for item in results[:max_items]:
                headline = item.get('headline')
                content = item.get('content')
                pub_date_str = item.get('published_at')
                
                if not headline or not content: continue
                
                # Deduplication: Search by Headline + Source since URL is generic
                existing = self.db.query(Article).filter(
                    Article.source_id == source.id,
                    Article.raw_title == headline
                ).first()
                
                if existing:
                    logger.info(f" - [SKIP] Duplicate: {headline}")
                    continue
                    
                # Parse Date
                published_at = datetime.now(timezone.utc)
                if pub_date_str:
                    try:
                        dt = datetime.fromisoformat(pub_date_str.replace('Z', '+00:00'))
                        if dt.tzinfo is None: dt = dt.replace(tzinfo=timezone.utc)
                        published_at = dt
                    except: pass
                
                # --- Step 4: Validation ---
                if not self._is_valid_article(headline, content, published_at, source.last_crawled_at):
                    logger.info(f" - [SKIP] Invalid (Date/Length): {headline}")
                    continue

                # --- Step 5: Full AI Enrichment --- Global only as requested
                topic_focus = self.sys_config.content_topic_focus if self.sys_config else "Economics, Trade, Politics, or Finance"
                analysis_model = self.sys_config.analysis_model if self.sys_config else "gemini-2.5-flash-lite"
                analysis_prompt = self.sys_config.analysis_prompt if self.sys_config else None

                if on_progress: await on_progress(f"V-AI Analyzing: {headline}")
                ai_data = await self.ai.analyze_article(
                    headline, 
                    content, 
                    topic_focus,
                    model_name=analysis_model,
                    custom_prompt=analysis_prompt
                )
                
                # Check Relevance (Score from full analysis)
                min_relevance = self._get_config(source, 'min_relevance', 50)
                is_relevant = ai_data.get('is_relevant', True)
                score = ai_data.get('relevance_score', 0)
                
                if not is_relevant or score < min_relevance:
                    logger.info(f" - [SKIP] Low Relevance ({score}, Min: {min_relevance}): {headline}")
                    if on_progress: await on_progress(f"Skipping (Low relevance: {score}): {headline}", {"status": "warning"})
                    continue
                # Setup Article
                import re
                slug = re.sub(r'[^a-z0-9]+', '-', headline.lower()).strip('-')
                synthetic_url = f"{source.url}#{slug}"
                
                logger.info(f" - [SAVE] Score: {score} | {headline}")

                article = Article(
                    id=generate_uuid(),
                    source_id=source.id,
                    url=synthetic_url, 
                    raw_title=headline,
                    generated_summary=ai_data.get('ai_summary_en') or content[:1000],
                    content_snippet=ai_data.get('cleaned_text_original') or content,
                    
                    # Language & Translation
                    language=ai_data.get('language', 'en'),
                    translated_title=ai_data.get('translated_title'),
                    translated_content_snippet=ai_data.get('translated_text'),
                    translated_generated_summary=ai_data.get('ai_summary_en'),
                    
                    # Enrichment
                    published_at=published_at,
                    relevance_score=score,
                    tags=normalize_metadata(ai_data.get('tags_en')),
                    tags_original=normalize_metadata(ai_data.get('tags_original')),
                    entities=normalize_metadata(ai_data.get('entities_en')),
                    entities_original=normalize_metadata(ai_data.get('entities_original')),
                    sentiment=ai_data.get('sentiment'),
                    ai_summary=ai_data.get('ai_summary_en'),
                    ai_summary_original=ai_data.get('ai_summary_original')
                )
                
                try:
                    self.db.add(article)
                    self.db.commit()
                    count += 1
                    if on_progress: await on_progress(f"Success! Acquired: {headline}", {"status": "success"})
                except IntegrityError:
                    self.db.rollback()
                    logger.info(f"PDF Article already exists: {synthetic_url}")
                    if on_progress: await on_progress(f"Skipping (DB Duplicate): {headline}", {"status": "warning"})
                    continue
                except Exception as e:
                    self.db.rollback()
                    logger.error(f"Failed to save PDF article: {e}")
                    if on_progress: await on_progress(f"Error saving: {headline} ({str(e)})", {"status": "error"})
                    continue
                
            logger.info(f"Finished PDF scan. Acquired {count} new items.")
            return {"status": "success", "articles": count}
            
        except Exception as e:
            logger.error(f"Error processing PDF crawl results: {e}")
            return {"status": "error", "articles": 0}

def run_crawler(source_id: str):
    # Wrapper to run async code synchronously
    # Create new loop if needed
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
    loop.run_until_complete(_run_async(source_id))

async def _run_async(source_id: str):
    db: Session = SessionLocal()
    try:
        crawler = CrawlerService(db)
        await crawler.crawl_source_async(source_id)
    finally:
        db.close()
