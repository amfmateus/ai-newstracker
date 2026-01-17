from database import SessionLocal
from models import Source, Article
from crawler import Crawler
import logging

logging.basicConfig(level=logging.INFO)

def test_infobae():
    db = SessionLocal()
    try:
        url = "https://www.infobae.com/colombia/ultimas-noticias/"
        
        # Check if source exists, else create
        source = db.query(Source).filter(Source.url == url).first()
        if not source:
            source = Source(
                url=url,
                type="html_generic"
            )
            db.add(source)
            db.commit()
            print(f"Created source: {source.id}")
        else:
            print(f"Using existing source: {source.id}")
            
        # Run crawler
        crawler = Crawler(db)
        crawler.crawl_source(source.id)
        
        # Check articles
        articles = db.query(Article).filter(Article.source_id == source.id).order_by(Article.scraped_at.desc()).limit(5).all()
        print(f"\nFound {len(articles)} articles (showing top 5):")
        for article in articles:
            print(f"- {article.raw_title}")
            print(f"  URL: {article.url}")
            print(f"  Summary Len: {len(article.generated_summary or '')}")
            if article.generated_summary:
                print(f"  Summary Preview: {article.generated_summary[:100]}...")
            
    finally:
        db.close()

if __name__ == "__main__":
    test_infobae()
