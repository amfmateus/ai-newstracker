import sqlite3
import os

DB_PATH = "./news_aggregator.db"

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # List of new columns and their types
    new_columns = [
        ("pipeline_id", "TEXT"),
        ("run_type", "TEXT DEFAULT 'manual'"),
        ("delivery_log", "JSON"),
        ("article_ids", "JSON")
    ]

    # Get existing columns
    cursor.execute("PRAGMA table_info(reports)")
    existing_columns = [row[1] for row in cursor.fetchall()]

    for col_name, col_type in new_columns:
        if col_name not in existing_columns:
            print(f"Adding column {col_name} to reports table...")
            try:
                cursor.execute(f"ALTER TABLE reports ADD COLUMN {col_name} {col_type}")
                print(f"Successfully added {col_name}.")
            except sqlite3.Error as e:
                print(f"Error adding {col_name}: {e}")
        else:
            print(f"Column {col_name} already exists.")

    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
