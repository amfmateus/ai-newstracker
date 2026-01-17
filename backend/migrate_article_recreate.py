from database import SessionLocal, engine
from sqlalchemy import text

def run_recreate_migration():
    print("Starting ROBUST migration: Recreating Articles Table...")
    with engine.connect() as conn:
        try:
            # 1. Rename existing table
            print("Renaming 'articles' to 'articles_old'...")
            conn.execute(text("ALTER TABLE articles RENAME TO articles_old"))
            
            # 2. Create NEW table (Schema copied from models.py request, stripped of unique=True on url)
            print("Creating new 'articles' table...")
            create_sql = """
            CREATE TABLE articles (
                id VARCHAR PRIMARY KEY,
                source_id VARCHAR,
                story_id VARCHAR,
                url VARCHAR,
                raw_title VARCHAR,
                content_snippet TEXT,
                source_name_backup VARCHAR,
                generated_summary TEXT,
                image_url VARCHAR,
                language VARCHAR DEFAULT 'en',
                translated_title VARCHAR,
                translated_content_snippet TEXT,
                translated_generated_summary TEXT,
                relevance_score INTEGER DEFAULT 0,
                tags JSON,
                tags_original JSON,
                entities JSON,
                entities_original JSON,
                sentiment VARCHAR,
                ai_summary TEXT,
                published_at DATETIME,
                scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(source_id) REFERENCES sources(id),
                FOREIGN KEY(story_id) REFERENCES stories(id)
            );
            """
            conn.execute(text(create_sql))
            
            # 3. Create Indices (The one we WANT and the normal ones)
            print("Creating indices...")
            conn.execute(text("CREATE INDEX ix_articles_id ON articles (id)"))
            conn.execute(text("CREATE INDEX ix_articles_url ON articles (url)")) # Regular index, NOT UNIQUE
            conn.execute(text("CREATE UNIQUE INDEX ix_articles_url_source ON articles (url, source_id)")) # The GOAL
            
            # 4. Copy Data
            print("Copying data from old table...")
            # We list columns explicitly to ensure safety if schemas slightly differ, 
            # but for now a generic INSERT INTO ... SELECT is usually fine if columns match.
            # To be safe, we select * matches.
            conn.execute(text("INSERT INTO articles SELECT * FROM articles_old"))
            
            # 5. Drop Old Table
            print("Dropping 'articles_old'...")
            conn.execute(text("DROP TABLE articles_old"))
            
            conn.commit()
            print("Migration SUCCESS.")
            
        except Exception as e:
            print(f"Migration Failed: {e}")
            # Optional: Attempt rollback logic if needed, but in SQLite transaction should handle it if not committed.

if __name__ == "__main__":
    run_recreate_migration()
