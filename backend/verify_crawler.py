from database import SessionLocal
from models import Source, Article
from crawler import Crawler
import logging

logging.basicConfig(level=logging.INFO)

def verify():
    db = SessionLocal()
    try:
        # Create a test RSS source
        source = Source(
            url="http://feeds.bbci.co.uk/news/rss.xml",
            type="rss"
        )
        db.add(source)
        db.commit()
        
        print(f"Created source: {source.id}")
        
        # Run crawler
        crawler = Crawler(db)
        crawler.crawl_source(source.id)
        
        # Check articles
        articles = db.query(Article).filter(Article.source_id == source.id).all()
        print(f"Found {len(articles)} articles")
        for article in articles[:3]:
            print(f"- {article.raw_title} ({article.url})")
            print(f"  Summary: {article.generated_summary[:100]}...")
            
    finally:
        # Cleanup
        try:
            if 'source' in locals():
                db.query(Article).filter(Article.source_id == source.id).delete()
                db.query(Source).filter(Source.id == source.id).delete()
                db.commit()
        except Exception as e:
            print(f"Cleanup failed: {e}")
            db.rollback()
        db.close()

if __name__ == "__main__":
    verify()
