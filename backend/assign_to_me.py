from database import SessionLocal
from sqlalchemy import text
from models import User

TARGET_EMAIL = "amfmateus@gmail.com"

def fix_ownership():
    db = SessionLocal()
    try:
        print(f"Attempting to assign all data to {TARGET_EMAIL}...")
        
        target_user = db.query(User).filter(User.email == TARGET_EMAIL).first()
        if not target_user:
            print(f"User {TARGET_EMAIL} not found. Creating manually...")
            target_user = User(email=TARGET_EMAIL, full_name="Manual Fix")
            db.add(target_user)
            db.commit()
            db.refresh(target_user)
            print(f"Created user {TARGET_EMAIL} (ID: {target_user.id})")

        print(f"Found target user: {target_user.full_name} (ID: {target_user.id})")
        
        # 1. Update Sources
        result_sources = db.execute(text("UPDATE sources SET user_id = :uid"), {"uid": target_user.id})
        print(f"Transferred {result_sources.rowcount} sources to {TARGET_EMAIL}")

        # 2. Update System Config
        result_config = db.execute(text("UPDATE system_config SET user_id = :uid"), {"uid": target_user.id})
        print(f"Transferred {result_config.rowcount} config settings to {TARGET_EMAIL}")
        
        db.commit()
        print("Data assignment complete.")

    except Exception as e:
        print(f"Assignment Failed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_ownership()
