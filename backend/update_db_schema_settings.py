from database import engine, Base
from sqlalchemy import text

def update_schema():
    print("Updating database schema for SystemConfig...")
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE system_config ADD COLUMN clustering_article_window_hours INTEGER DEFAULT 24"))
            print("Added clustering_article_window_hours column.")
        except Exception as e:
            print(f"Column clustering_article_window_hours might already exist: {e}")

        try:
            conn.execute(text("ALTER TABLE system_config ADD COLUMN clustering_story_context_days INTEGER DEFAULT 7"))
            print("Added clustering_story_context_days column.")
        except Exception as e:
            print(f"Column clustering_story_context_days might already exist: {e}")
        
        conn.commit()
    print("Schema update complete.")

if __name__ == "__main__":
    update_schema()
