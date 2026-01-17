from database import SessionLocal
from models import Source
from crawler import Crawler
import logging

logging.basicConfig(level=logging.INFO)

def populate():
    db = SessionLocal()
    try:
        # Create a test RSS source
        source_url = "http://feeds.bbci.co.uk/news/rss.xml"
        source = db.query(Source).filter(Source.url == source_url).first()
        
        if not source:
            source = Source(
                url=source_url,
                type="rss"
            )
            db.add(source)
            db.commit()
            print(f"Created source: {source.id}")
        else:
            print(f"Using existing source: {source.id}")
        
        # Run crawler
        crawler = Crawler(db)
        crawler.crawl_source(source.id)
        print("Crawl complete.")
            
    finally:
        db.close()

if __name__ == "__main__":
    populate()
