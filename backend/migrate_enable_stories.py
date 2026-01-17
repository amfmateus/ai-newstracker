from sqlalchemy import create_engine, text
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./news_aggregator.db")
engine = create_engine(DATABASE_URL)

def migrate():
    with engine.connect() as conn:
        print("Adding enable_stories to system_config...")
        try:
            # SQLite doesn't support adding a column with a default value that isn't constant in the same way, 
            # but usually BOOLEAN/INTEGER works. 
            # We use a default of 1 (True) for existing records.
            conn.execute(text("ALTER TABLE system_config ADD COLUMN enable_stories BOOLEAN DEFAULT 1"))
            print("Added enable_stories")
        except Exception as e:
            print(f"Column enable_stories might already exist: {e}")
            
        conn.commit()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
