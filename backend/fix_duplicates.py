from database import SessionLocal
from models import Source, Article, User
from sqlalchemy import func

TARGET_USER_EMAIL = "amfmateus@gmail.com"

def fix_duplicates():
    db = SessionLocal()
    try:
        # 1. Get Target User
        user = db.query(User).filter(User.email == TARGET_USER_EMAIL).first()
        if not user:
            print(f"User {TARGET_USER_EMAIL} not found!")
            return
        
        print(f"Target User: {user.full_name} ({user.id})")
        
        # 2. Find Sources owned by Target User
        my_sources = db.query(Source).filter(Source.user_id == user.id).all()
        my_urls = {s.url: s for s in my_sources}
        
        print(f"User has {len(my_sources)} sources.")
        
        # 3. Find CONFLICTING sources (same URL, different user)
        other_sources = db.query(Source).filter(
            Source.url.in_(my_urls.keys()),
            Source.user_id != user.id
        ).all()
        
        print(f"Found {len(other_sources)} conflicting sources from other users.")
        
        for other in other_sources:
            winner = my_urls[other.url]
            print(f"Merging Source {other.name} ({other.id}) -> {winner.name} ({winner.id})")
            
            # Reassign Articles
            articles = db.query(Article).filter(Article.source_id == other.id).all()
            print(f"  - Transferring {len(articles)} articles...")
            
            for a in articles:
                a.source_id = winner.id
                a.source_name_backup = None
                
            db.commit()
            
            # Delete Looser Source
            print(f"  - Deleting old source {other.id}")
            db.delete(other)
            db.commit()
            
        print("Merge complete.")

    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_duplicates()
