from database import SessionLocal
from sqlalchemy import text
from models import User

def migrate():
    db = SessionLocal()
    try:
        print("Starting Multi-Tenancy Migration...")
        
        # 1. Add user_id to sources
        try:
            db.execute(text("ALTER TABLE sources ADD COLUMN user_id VARCHAR REFERENCES users(id)"))
            print("Added user_id to sources.")
        except Exception as e:
            if "duplicate column" in str(e).lower():
                print("Column user_id already exists in sources.")
            else:
                print(f"Error adding user_id to sources: {e}")

        # 2. Add user_id to system_config
        try:
            db.execute(text("ALTER TABLE system_config ADD COLUMN user_id VARCHAR REFERENCES users(id)"))
            print("Added user_id to system_config.")
        except Exception as e:
            if "duplicate column" in str(e).lower():
                print("Column user_id already exists in system_config.")
            else:
                print(f"Error adding user_id to system_config: {e}")

        db.commit()

        # 3. Backfill Data (Assign to first found user)
        # Find a user (should be at least the dev user or the one just logged in)
        first_user = db.query(User).first()
        
        if first_user:
            print(f"Found user to assign legacy data: {first_user.email} ({first_user.id})")
            
            # Allow commit of schema changes first
            
            # Assign Sources
            result_sources = db.execute(text("UPDATE sources SET user_id = :uid WHERE user_id IS NULL"), {"uid": first_user.id})
            print(f"Assigned {result_sources.rowcount} sources to {first_user.email}")
            
            # Assign Config
            result_config = db.execute(text("UPDATE system_config SET user_id = :uid WHERE user_id IS NULL"), {"uid": first_user.id})
            print(f"Assigned {result_config.rowcount} config rows to {first_user.email}")
            
            db.commit()
        else:
            print("WARNING: No users found in DB. Existing data remains unassigned (user_id=NULL). Login first to create a user.")

    except Exception as e:
        print(f"Migration Failed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
