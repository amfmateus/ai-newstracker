import sqlite3
import os

DB_PATH = "./news_aggregator.db"

def migrate():
    print(f"Migrating {DB_PATH}...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. Update SOURCES table
    try:
        cursor.execute("ALTER TABLE sources ADD COLUMN crawl_interval INTEGER DEFAULT 15")
        print("Added crawl_interval to sources")
    except sqlite3.OperationalError as e:
        print(f"Skipping sources update: {e}")

    # 2. Update ARTICLES table
    columns_to_add = [
        ("language", "TEXT DEFAULT 'en'"),
        ("translated_title", "TEXT"),
        ("translated_content_snippet", "TEXT"),
        ("translated_generated_summary", "TEXT"),
        ("relevance_score", "INTEGER DEFAULT 0"),
        ("tags", "JSON"),
        ("entities", "JSON"),
        ("sentiment", "TEXT"),
        ("ai_summary", "TEXT")
    ]

    for col_name, col_type in columns_to_add:
        try:
            cursor.execute(f"ALTER TABLE articles ADD COLUMN {col_name} {col_type}")
            print(f"Added {col_name} to articles")
        except sqlite3.OperationalError as e:
            print(f"Skipping {col_name}: {e}")

    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    if os.path.exists(DB_PATH):
        migrate()
    else:
        print("Database not found, nothing to migrate (init_db will handle it).")
