from database import SessionLocal, engine
from sqlalchemy import text, inspect

def run_recreate_migration():
    print("Starting ROBUST migration (Attempt 2)...")
    inspector = inspect(engine)
    
    with engine.connect() as conn:
        try:
            # 0. Cleanup Previous Failed Run (if necessary)
            tables = inspector.get_table_names()
            if 'articles_old' in tables and 'articles' in tables:
                print("Detected partial migration state. Dropping incomplete 'articles' table...")
                conn.execute(text("DROP TABLE articles"))
            
            # 1. Rename existing table (if not already renamed)
            if 'articles' in tables and 'articles_old' not in tables:
                print("Renaming 'articles' to 'articles_old'...")
                conn.execute(text("ALTER TABLE articles RENAME TO articles_old"))
            
            # 1.1 Drop OLD Indices to free up names
            # SQLite renaming keeps indices. We need to drop them to reuse names for the new table.
            print("Dropping legacy indices to free up names...")
            indices_to_drop = ['ix_articles_id', 'ix_articles_url', 'ix_articles_url_source', 'sqlite_autoindex_articles_1']
            for idx in indices_to_drop:
                try:
                    conn.execute(text(f"DROP INDEX IF EXISTS {idx}"))
                except Exception as e:
                    pass # Ignore if doesn't exist

            # 2. Create NEW table
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
            
            # 3. Create Indices
            print("Creating NEW indices...")
            conn.execute(text("CREATE INDEX ix_articles_id ON articles (id)"))
            conn.execute(text("CREATE INDEX ix_articles_url ON articles (url)")) # Regular index
            conn.execute(text("CREATE UNIQUE INDEX ix_articles_url_source ON articles (url, source_id)")) # Composite Unique
            
            # 4. Copy Data
            print("Copying data from 'articles_old'...")
            conn.execute(text("INSERT INTO articles SELECT * FROM articles_old"))
            
            # 5. Drop Old Table
            print("Dropping 'articles_old'...")
            conn.execute(text("DROP TABLE articles_old"))
            
            conn.commit()
            print("Migration SUCCESS.")
            
        except Exception as e:
            print(f"Migration Failed: {e}")
            # db.rollback() implicit in context manager if not committed

if __name__ == "__main__":
    run_recreate_migration()
