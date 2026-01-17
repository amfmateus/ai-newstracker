from database import SessionLocal, engine
from models import User
from sqlalchemy import text

def migrate_sources_userid():
    print("Starting Sources UserID Migration...")
    db = SessionLocal()
    try:
        # 1. Check if column exists
        with engine.connect() as conn:
            result = conn.execute(text("PRAGMA table_info(sources)"))
            columns = [row[1] for row in result]
            
            if 'user_id' in columns:
                print("Column 'user_id' already exists in 'sources'. Skipping column creation.")
            else:
                print("Adding 'user_id' column to 'sources'...")
                conn.execute(text("ALTER TABLE sources ADD COLUMN user_id VARCHAR REFERENCES users(id)"))
                conn.commit()
                print("Column added.")

        # 2. Backfill user_id for existing sources
        # Find primary user
        admin_email = "amfmateus@gmail.com"
        user = db.query(User).filter(User.email == admin_email).first()
        
        if not user:
            print(f"Warning: Primary user {admin_email} not found. Using first available user.")
            user = db.query(User).first()
            
        if not user:
            print("Error: No users found in database to assign sources to.")
            return

        print(f"Assigning orphan sources to user: {user.email} ({user.id})")
        
        # Update logic
        with engine.connect() as conn:
            # Check for orphans
            result = conn.execute(text("SELECT count(*) FROM sources WHERE user_id IS NULL"))
            count = result.scalar()
            print(f"Found {count} sources without user_id.")
            
            if count > 0:
                conn.execute(text(f"UPDATE sources SET user_id = '{user.id}' WHERE user_id IS NULL"))
                conn.commit()
                print("Sources updated.")
            else:
                print("No orphan sources found.")
                
    except Exception as e:
        print(f"Migration Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    migrate_sources_userid()
