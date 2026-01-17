import sqlite3
import os

db_path = "news_aggregator.db"
if not os.path.exists(db_path):
    print(f"Error: Database {db_path} not found.")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # 1. Add column
    print("Adding reference_name column to sources table...")
    cursor.execute("ALTER TABLE sources ADD COLUMN reference_name TEXT")
    
    # 2. Populate it with existing names
    print("Populating reference_name with existing names...")
    cursor.execute("UPDATE sources SET reference_name = name WHERE reference_name IS NULL")
    
    conn.commit()
    print("Migration successful.")
except sqlite3.OperationalError as e:
    if "duplicate column name" in str(e).lower():
        print("Column already exists. Migration skipped.")
    else:
        print(f"Operational error: {e}")
except Exception as e:
    print(f"Error during migration: {e}")
    conn.rollback()
finally:
    conn.close()
