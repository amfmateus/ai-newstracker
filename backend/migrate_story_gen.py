from sqlalchemy import create_engine, text
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./news_aggregator.db")
engine = create_engine(DATABASE_URL)

def migrate():
    with engine.connect() as conn:
        print("Adding story_generation_interval_mins and last_clustering_at to system_config...")
        try:
            conn.execute(text("ALTER TABLE system_config ADD COLUMN story_generation_interval_mins INTEGER DEFAULT 60"))
            print("Added story_generation_interval_mins")
        except Exception as e:
            print(f"Column story_generation_interval_mins might already exist: {e}")
            
        try:
            conn.execute(text("ALTER TABLE system_config ADD COLUMN last_clustering_at DATETIME"))
            print("Added last_clustering_at")
        except Exception as e:
            print(f"Column last_clustering_at might already exist: {e}")
            
        conn.commit()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
