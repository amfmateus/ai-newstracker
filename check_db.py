import sqlite3
import os

db_path = "backend/news_aggregator.db"
if not os.path.exists(db_path):
    db_path = "news_aggregator.db"

if not os.path.exists(db_path):
    print(f"Error: Database {db_path} not found.")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Check table info
    cursor.execute("PRAGMA table_info(sources)")
    columns = cursor.fetchall()
    print("Columns in 'sources' table:")
    for col in columns:
        print(col)

    # Check some data
    cursor.execute("SELECT id, name, reference_name FROM sources LIMIT 10")
    rows = cursor.fetchall()
    print("\nData in 'sources' table (first 10 rows):")
    for row in rows:
        print(row)

except Exception as e:
    print(f"Error: {e}")
finally:
    conn.close()
