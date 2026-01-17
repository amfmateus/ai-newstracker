from sqlalchemy.orm import Session
from database import SessionLocal, engine
from models import Story, Article, ClusteringEvent
from sqlalchemy import text

def reset_stories():
    db = SessionLocal()
    try:
        print("Resetting stories...")
        
        # 1. Unassign articles from stories
        print("Unassigning articles...")
        db.execute(text("UPDATE articles SET story_id = NULL"))
        
        # 2. Delete all stories
        print("Deleting stories...")
        db.execute(text("DELETE FROM stories"))
        
        # 3. Delete clustering events (optional, but good for clean slate)
        print("Deleting clustering events...")
        db.execute(text("DELETE FROM clustering_events"))
        
        db.commit()
        print("Successfully reset stories and clustering data.")
        
    except Exception as e:
        print(f"Error resetting stories: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    reset_stories()
