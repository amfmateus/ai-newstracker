from sqlalchemy.orm import Session
from database import SessionLocal
from models import Source

def check_worldbank():
    db = SessionLocal()
    try:
        # Search for source
        sources = db.query(Source).filter(Source.url.ilike('%worldbank%')).all()
        
        if not sources:
            print("No source found containing 'worldbank'. checking by name...")
            sources = db.query(Source).filter(Source.name.ilike('%worldbank%')).all()

        if not sources:
             print("No source found.")
             return

        for s in sources:
            print(f"ID: {s.id}")
            print(f"Name: {s.name}")
            print(f"URL: {s.url}")
            print(f"Status: {s.status}")
            print(f"Last Crawled: {s.last_crawled_at}")
            print(f"Config: {s.config}")
            print("-" * 20)
            
    finally:
        db.close()

if __name__ == "__main__":
    check_worldbank()
