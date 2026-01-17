import sqlite3
import os

# Path to the database
DB_PATH = "/Users/amfmateus/Documents/Development/AI_Newstracker/backend/news_aggregator.db"

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        print("Checking for citation_type column in formatting_library...")
        cursor.execute("PRAGMA table_info(formatting_library)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'citation_type' not in columns:
            print("Adding citation_type column to formatting_library...")
            cursor.execute("ALTER TABLE formatting_library ADD COLUMN citation_type TEXT DEFAULT 'numeric_superscript'")
            conn.commit()
            print("Successfully added column.")
        else:
            print("Column citation_type already exists.")

    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
