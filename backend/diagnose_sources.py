from sqlalchemy.orm import Session
from database import SessionLocal
from models import Source, Article, CrawlEvent
from datetime import datetime, timezone, timedelta

def diagnose():
    db: Session = SessionLocal()
    try:
        print("--- Source Status Report ---")
        sources = db.query(Source).all()
        if not sources:
            print("No sources found in database.")
            return

        now = datetime.now(timezone.utc)
        print(f"Current Time (UTC): {now}")

        for s in sources:
            last = s.last_crawled_at
            if last and last.tzinfo is None:
                last = last.replace(tzinfo=timezone.utc)
            
            print(f"ID: {s.id}")
            print(f"  Name: {s.name or s.url}")
            print(f"  Status: {s.status}")
            print(f"  Last Crawled At: {last}")
            print(f"  Interval: {s.crawl_interval} mins")
            
            if last:
                next_crawl = last + timedelta(minutes=s.crawl_interval or 15)
                print(f"  Next Crawl Due: {next_crawl}")
                print(f"  Due Now? {'YES' if next_crawl <= now else 'NO'}")
            else:
                print(f"  Next Crawl Due: NOW (Never crawled)")
            
            # Check if stuck
            if s.status == 'crawling':
                if last and (now - last).total_seconds() > 3600:
                    print(f"  WARNING: Source appears STUCK in 'crawling' (last update > 1h ago)")
                elif not last:
                    print(f"  WARNING: Source is 'crawling' but has no last_crawled_at!")
            print("-" * 30)

        print("\n--- Crawler Event Summary (Last 10) ---")
        events = db.query(CrawlEvent).order_by(CrawlEvent.created_at.desc()).limit(10).all()
        for e in events:
            print(f"[{e.created_at}] Source: {e.source_id} | Status: {e.status} | Count: {e.articles_count}")

    finally:
        db.close()

if __name__ == "__main__":
    diagnose()
