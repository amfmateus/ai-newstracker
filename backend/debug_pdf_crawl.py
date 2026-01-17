import asyncio
import os
from database import SessionLocal
from models import Source, SystemConfig
from crawler import CrawlerService, _run_async
from logger_config import setup_logger

logger = setup_logger(__name__)

# Mock Source for Testing
TEST_URL = "https://tradingeconomics.com/colombia/news" 
SOURCE_ID = "test_trading_economics"

def test_pdf_crawl():
    db = SessionLocal()
    try:
        # Ensure System Config has Gemini Key
        config = db.query(SystemConfig).first()
        if not config:
            print("Creating default config...")
            config = SystemConfig(id="1")
            db.add(config)
            db.commit()
            
        # Create or Update Test Source
        source = db.query(Source).filter(Source.id == SOURCE_ID).first()
        if not source:
            source = Source(
                id=SOURCE_ID,
                url=TEST_URL,
                type="dynamic_pdf",
                user_id=config.user_id if config.user_id else "user_2rhM8X45Y7z9Q2" # Fallback ID from earlier logs or first user
            )
            db.add(source)
            db.commit()
        else:
            source.type = "dynamic_pdf"
            source.url = TEST_URL
            db.commit()
            
        print(f"Starting PDF Crawl Test for {TEST_URL}...")
        
        # Run Crawler
        asyncio.run(_run_async(SOURCE_ID))
        
        print("Crawl finished. Checking results...")
        
        # Check Articles
        from models import Article
        # Search for the user's specific headline
        target = "Exports Contract"
        articles = db.query(Article).filter(
            Article.source_id == SOURCE_ID,
            Article.raw_title.ilike(f"%{target}%")
        ).all()
        
        if articles:
            print(f"FOUND target article:")
            for a in articles:
                print(f"- {a.raw_title}")
        else:
            print(f"Target article '{target}' NOT found. Listing all captured:")
            all_arts = db.query(Article).filter(Article.source_id == SOURCE_ID).limit(20).all()
            for a in all_arts:
                print(f"- {a.raw_title}")
            
    finally:
        db.close()

if __name__ == "__main__":
    test_pdf_crawl()
