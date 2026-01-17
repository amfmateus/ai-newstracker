
import sqlite3
import os

# Database file path (assumes typical local setup relative to script execution)
DB_PATH = "news_aggregator.db"

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Database file not found at {DB_PATH}. Skipping migration.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check if column exists
        cursor.execute("PRAGMA table_info(sources)")
        columns = [info[1] for info in cursor.fetchall()]
        
        if "crawl_method" not in columns:
            print("Adding 'crawl_method' column to 'sources' table...")
            cursor.execute("ALTER TABLE sources ADD COLUMN crawl_method TEXT DEFAULT 'auto'")
            print("Migration successful.")
        else:
            print("'crawl_method' column already exists.")

        conn.commit()
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
