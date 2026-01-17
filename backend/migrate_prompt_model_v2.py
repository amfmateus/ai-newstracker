import sqlite3
import os

DB_PATH = '/Users/amfmateus/Documents/Development/AI_Newstracker/backend/news_aggregator.db'

def migrate():
    print(f"Migrating database at {DB_PATH}...")
    if not os.path.exists(DB_PATH):
        print(f"Error: Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if column exists
        cursor.execute("PRAGMA table_info(prompt_library)")
        columns = [info[1] for info in cursor.fetchall()]
        print(f"Existing columns: {columns}")
        
        if 'model' not in columns:
            print("Adding 'model' column to prompt_library...")
            cursor.execute("ALTER TABLE prompt_library ADD COLUMN model TEXT DEFAULT 'gemini-2.0-flash-lite'")
            conn.commit()
            print("Column added successfully.")
        else:
            print("Column 'model' already exists.")
            
    except Exception as e:
        print(f"Migration failed: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
