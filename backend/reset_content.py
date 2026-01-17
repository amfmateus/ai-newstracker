import sqlite3
import os

DB_PATH = "./news_aggregator.db"

def reset_content():
    if not os.path.exists(DB_PATH):
        print("Database not found.")
        return

    print(f"Connecting to {DB_PATH}...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    tables_to_clear = ["articles", "crawl_events", "stories", "sources"]
    
    for table in tables_to_clear:
        try:
            cursor.execute(f"DELETE FROM {table}")
            print(f"Cleared table: {table}")
        except Exception as e:
            print(f"Error clearing {table}: {e}")

    conn.commit()
    conn.close()
    print("Database content reset complete (Sources preserved).")

if __name__ == "__main__":
    reset_content()
