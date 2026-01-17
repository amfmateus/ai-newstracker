import sqlite3
import os

DB_PATH = "./news_aggregator.db"

def reset_timestamps():
    if not os.path.exists(DB_PATH):
        print("Database not found.")
        return

    print(f"Connecting to {DB_PATH}...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Reset last_crawled_at to NULL so the crawler thinks it's the first time
        cursor.execute("UPDATE sources SET last_crawled_at = NULL")
        print("Reset last_crawled_at for all sources.")
    except Exception as e:
        print(f"Error updating sources: {e}")

    conn.commit()
    conn.close()

if __name__ == "__main__":
    reset_timestamps()
