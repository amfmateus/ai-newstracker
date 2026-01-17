import sqlite3
import os

# Database file is expected to be in the same directory as this script (backend/) or one level up?
# database.py says: "sqlite:///./news_aggregator.db"
# If we run this from backend/ it should be "../news_aggregator.db" or "./news_aggregator.db" depending on where run_command cwd is.
# The user's manage.sh runs from root. Database.py uses ./news_aggregator.db.
# If I run form root, it's ./backend/news_aggregator.db?
# Let's check where the db file is.
# Using absolute path logic based on workspace root.

DB_PATH = "backend/news_aggregator.db"

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    columns_to_add = [
        ("smtp_sender_name", "VARCHAR"),
        ("smtp_reply_to", "VARCHAR")
    ]

    for col_name, col_type in columns_to_add:
        try:
            print(f"Adding column {col_name}...")
            cursor.execute(f"ALTER TABLE system_config ADD COLUMN {col_name} {col_type}")
            print(f"Successfully added {col_name}")
        except sqlite3.OperationalError as e:
            if "duplicate column" in str(e).lower():
                print(f"Column {col_name} already exists.")
            else:
                print(f"Error adding {col_name}: {e}")

    conn.commit()
    conn.close()
    print("Migration completed.")

if __name__ == "__main__":
    migrate()
