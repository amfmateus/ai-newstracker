from database import SessionLocal, engine
from models import User, Story
from sqlalchemy import text

def migrate_stories_userid():
    print("Starting Stories UserID Migration...")
    db = SessionLocal()
    try:
        # 1. Check if column exists
        with engine.connect() as conn:
            result = conn.execute(text("PRAGMA table_info(stories)"))
            columns = [row[1] for row in result]
            
            if 'user_id' in columns:
                print("Column 'user_id' already exists in 'stories'.")
            else:
                print("Adding 'user_id' and 'updated_at' columns to 'stories'...")
                conn.execute(text("ALTER TABLE stories ADD COLUMN user_id VARCHAR REFERENCES users(id)"))
                conn.execute(text("ALTER TABLE stories ADD COLUMN updated_at DATETIME"))
                conn.commit()
                print("Columns added.")

        # 2. Backfill user_id for existing stories (assign to Admin/First User)
        # Find primary user
        admin_email = "amfmateus@gmail.com"
        user = db.query(User).filter(User.email == admin_email).first()
        
        if not user:
            print(f"Warning: Primary user {admin_email} not found. Using first available user.")
            user = db.query(User).first()
            
        if not user:
            print("Error: No users found in database to assign stories to.")
            return

        print(f"Assigning orphan stories to user: {user.email} ({user.id})")
        
        with engine.connect() as conn:
            # Check for orphans
            result = conn.execute(text("SELECT count(*) FROM stories WHERE user_id IS NULL"))
            count = result.scalar()
            
            if count > 0:
                conn.execute(text(f"UPDATE stories SET user_id = '{user.id}' WHERE user_id IS NULL"))
                conn.execute(text("UPDATE stories SET updated_at = created_at WHERE updated_at IS NULL"))
                conn.commit()
                print(f"Updated {count} stories.")
            else:
                print("No orphan stories found.")
                
    except Exception as e:
        print(f"Migration Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    migrate_stories_userid()
