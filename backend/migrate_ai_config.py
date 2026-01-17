import sqlite3
import os

db_path = "/Users/amfmateus/Documents/Development/Newstracker/backend/news_aggregator.db"

def migrate():
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    columns = [
        ("analysis_model", "TEXT DEFAULT 'gemini-2.0-flash-lite'"),
        ("analysis_prompt", "TEXT"),
        ("clustering_model", "TEXT DEFAULT 'gemini-2.0-flash-lite'"),
        ("clustering_prompt", "TEXT"),
        ("report_model", "TEXT DEFAULT 'gemini-2.0-flash-lite'"),
        ("report_prompt", "TEXT")
    ]
    
    for col_name, col_type in columns:
        try:
            cursor.execute(f"ALTER TABLE system_config ADD COLUMN {col_name} {col_type}")
            print(f"Added column {col_name} to system_config")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e).lower():
                print(f"Column {col_name} already exists")
            else:
                print(f"Error adding column {col_name}: {e}")
                
    conn.commit()
    conn.close()

if __name__ == "__main__":
    migrate()
