from database import SessionLocal
from models import Article
import json

def view_data():
    db = SessionLocal()
    try:
        articles = db.query(Article).limit(3).all()
        for i, article in enumerate(articles, 1):
            print(f"\n--- Article {i} ---")
            print(f"Title: {article.raw_title}")
            print(f"URL: {article.url}")
            print(f"Published At: {article.published_at}")
            print(f"Generated Summary ({len(article.generated_summary or '')} chars):\n{article.generated_summary}")
    finally:
        db.close()

if __name__ == "__main__":
    view_data()
