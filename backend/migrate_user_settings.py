from database import SessionLocal, engine
from models import User, SystemConfig
from sqlalchemy import text

def migrate_user_settings_v2():
    print("Starting Per-User Settings Migration (V2 - Recreate)...")
    db = SessionLocal()
    try:
        # 1. Drop Old Table and Recreate
        # Since we are changing PK type, recreation is safest/easiest in SQLite
        with engine.connect() as conn:
            print("Dropping old system_config table...")
            conn.execute(text("DROP TABLE IF EXISTS system_config"))
            
            print("Creating new system_config table...")
            # We use the schema definition from models.py effectively
            create_sql = """
            CREATE TABLE system_config (
                id VARCHAR PRIMARY KEY,
                user_id VARCHAR UNIQUE,
                first_crawl_lookback_hours INTEGER DEFAULT 24,
                min_text_length INTEGER DEFAULT 200,
                default_crawl_interval_mins INTEGER DEFAULT 15,
                max_rss_entries INTEGER DEFAULT 100,
                max_articles_to_scrape INTEGER DEFAULT 100,
                page_load_timeout_seconds INTEGER DEFAULT 30,
                min_relevance_score INTEGER DEFAULT 50,
                content_topic_focus VARCHAR,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );
            """
            conn.execute(text(create_sql))
            conn.commit()

        # 2. Populate Configs for Existing Users
        users = db.query(User).all()
        print(f"Found {len(users)} users. Creating default configs...")
        
        for user in users:
            print(f" - Config for {user.email}")
            new_config = SystemConfig(
                user_id=user.id,
                first_crawl_lookback_hours=24,
                min_text_length=200,
                default_crawl_interval_mins=15,
                max_rss_entries=100,
                max_articles_to_scrape=100,
                page_load_timeout_seconds=30,
                min_relevance_score=50,
                content_topic_focus="Economics, Trade, Politics, or Finance"
            )
            db.add(new_config)
        
        db.commit()
        print("Migration V2 complete.")

    except Exception as e:
        print(f"Migration Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    migrate_user_settings_v2()
