import asyncio
import os
import sys
from datetime import datetime, timezone

# Add backend to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from models import Source, Article, SystemConfig, User
from crawler import CrawlerService
from ai_service import AIService

async def test_crawl():
    print("Starting Unified Crawler Test...")
    db = SessionLocal()
    
    # 1. Get a user with an API Key
    users = db.query(User).all()
    print(f"Found {len(users)} users in total.")
    for u in users:
        key_masked = (u.google_api_key[:5] + "...") if u.google_api_key else "None"
        print(f" - {u.email}: key={key_masked}")

    user = db.query(User).filter(User.google_api_key != None).first()
    if not user:
        print("No user with API key found in DB.")
        # Try to find any user and update them if needed for test
        user = db.query(User).first()
        if not user:
            print("No users found at all.")
            return
    
    print(f"Using User: {user.email}")
    
    # 2. Ensure System Config exists
    sys_config = db.query(SystemConfig).filter(SystemConfig.user_id == user.id).first()
    if not sys_config:
        sys_config = SystemConfig(
            user_id=user.id,
            analysis_model="gemini-2.0-flash-lite",
            content_topic_focus="Economics, Trade, Politics, or Finance"
        )
        db.add(sys_config)
        db.commit()
    
    # Use the user's API key globally for the test
    os.environ['GOOGLE_API_KEY'] = user.google_api_key
    
    # 3. Setup Crawler
    crawler = CrawlerService(db)
    
    # 4. Create/Get a test source (Infobae is good for testing)
    test_url = "https://www.infobae.com/colombia/ultimas-noticias/"
    source = db.query(Source).filter(Source.url == test_url).first()
    if not source:
        source = Source(
            id="test-source-infobae",
            user_id=user.id,
            url=test_url,
            name="Infobae Colombia",
            crawl_method="html", # The unified one
            type="html_generic",
            config={"max_articles": 5, "min_relevance": 0} # Get 5 items regardless of topic for speed
        )
        db.add(source)
        db.commit()
    else:
        # Reset source for fresh crawl
        source.crawl_method = "html"
        db.commit()

    print(f"Crawling source: {source.url}")
    
    try:
        # Use the actual unified method
        stats = await crawler._crawl_html_async(source)
        print(f"Crawl Stats: {stats}")
        
        # Check articles
        articles = db.query(Article).filter(Article.source_id == source.id).order_by(Article.scraped_at.desc()).limit(5).all()
        print(f"Found {len(articles)} articles in DB.")
        for a in articles:
            print(f" - [{a.relevance_score}] {a.raw_title}")
            print(f"   URL: {a.url}")
            print(f"   Summary: {a.generated_summary[:100]}...")
            print("-" * 20)
            
    except Exception as e:
        print(f"Crawl Failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_crawl())
