from database import SessionLocal
from sqlalchemy import text

def add_column():
    db = SessionLocal()
    try:
        # Check if column exists strictly to avoid errors? Or just try/except
        # SQLite doesn't support IF NOT EXISTS in ADD COLUMN easily in all versions, 
        # but let's try the direct approach. Use exception handling.
        try:
            db.execute(text("ALTER TABLE system_config ADD COLUMN content_topic_focus VARCHAR"))
            db.commit()
            print("Successfully added content_topic_focus column.")
        except Exception as e:
            if "duplicate column name" in str(e).lower():
                print("Column already exists.")
            else:
                print(f"Error adding column: {e}")
                
    finally:
        db.close()

if __name__ == "__main__":
    add_column()
