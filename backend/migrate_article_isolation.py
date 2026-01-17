from database import SessionLocal, engine
from sqlalchemy import text

def run_migration():
    print("Starting migration: Isolate Articles Per Source...")
    with engine.connect() as conn:
        try:
            # 1. Drop existing unique index on URL (name may vary, trying common patterns)
            # Inspecting SQLite usually requires recreating the table, but we can try DROP INDEX if it was named.
            # However, SQLAlchemy often creates implicit indices.
            # For SQLite, the most reliable way to change constraints is complex (copy table), 
            # BUT since we are in dev/prototype, we can try to drop the index if it exists.
            
            # Note: In previous `models.py`, `url = Column(String, unique=True, index=True)`
            # This creates an index named `ix_articles_url` usually.
            
            print("Attempting to drop global unique index on URL...")
            try:
                conn.execute(text("DROP INDEX IF EXISTS ix_articles_url"))
                conn.execute(text("DROP INDEX IF EXISTS sqlite_autoindex_articles_1")) # Common autoindex name
            except Exception as e:
                print(f"Warning dropping index: {e}")

            # 2. Add new unique index on (url, source_id)
            print("Creating new unique index on (url, source_id)...")
            try:
                conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_articles_url_source ON articles (url, source_id)"))
            except Exception as e:
                print(f"Error creating new index: {e}")
                
            conn.commit()
            print("Migration steps executed.")
            
        except Exception as e:
            print(f"Migration failed: {e}")

if __name__ == "__main__":
    run_migration()
