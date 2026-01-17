from database import SessionLocal, engine
from sqlalchemy import text, inspect

def run_recreate_migration_v3():
    print("Starting ROBUST migration (Attempt V3)...")
    inspector = inspect(engine)
    
    with engine.connect() as conn:
        try:
            # 0. Cleanup Previous Failed Run
            tables = inspector.get_table_names()
            if 'articles_old' in tables and 'articles' in tables:
                print("Cleaning up partial state (dropping 'articles')...")
                conn.execute(text("DROP TABLE articles"))
            
            # 1. Rename existing table
            if 'articles' in tables and 'articles_old' not in tables:
                print("Renaming 'articles' to 'articles_old'...")
                conn.execute(text("ALTER TABLE articles RENAME TO articles_old"))
                
                # Check indices on the OLD table and drop them to free names
                print("Dropping old indices...")
                for idx in ['ix_articles_id', 'ix_articles_url', 'ix_articles_url_source', 'sqlite_autoindex_articles_1']:
                    try:
                        conn.execute(text(f"DROP INDEX IF EXISTS {idx}"))
                    except: pass

            # 2. Create NEW table (With ALL columns and CORRECT TYPES)
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
                ai_summary_original TEXT,
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
            conn.execute(text("CREATE INDEX ix_articles_url ON articles (url)"))
            conn.execute(text("CREATE UNIQUE INDEX ix_articles_url_source ON articles (url, source_id)"))
            
            # 4. Copy Data (EXPLICIT MAPPING)
            print("Copying data from 'articles_old' with explicit mapping...")
            # We map explicit columns. The order in INSERT must match SELECT.
            cols = [
                "id", "source_id", "story_id", "url", "raw_title", "content_snippet", 
                "source_name_backup", "generated_summary", "image_url", "language",
                "translated_title", "translated_content_snippet", "translated_generated_summary",
                "relevance_score", "tags", "tags_original", "entities", "entities_original",
                "sentiment", "ai_summary", "ai_summary_original", "published_at", "scraped_at"
            ]
            col_str = ", ".join(cols)
            
            sql = f"INSERT INTO articles ({col_str}) SELECT {col_str} FROM articles_old"
            conn.execute(text(sql))
            
            # 5. Drop Old Table
            print("Dropping 'articles_old'...")
            conn.execute(text("DROP TABLE articles_old"))
            
            conn.commit()
            print("Migration SUCCESS.")
            
        except Exception as e:
            print(f"Migration Failed: {e}")
            # db.rollback() is implicit

if __name__ == "__main__":
    run_recreate_migration_v3()
