import sqlite3

DB_PATH = "backend/news_aggregator.db"

def inspect_table(table_name):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns = cursor.fetchall()
        print(f"--- Columns in {table_name} ---")
        for col in columns:
            print(col) # (cid, name, type, notnull, dflt_value, pk)
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    inspect_table("stories")
