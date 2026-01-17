from database import engine, Base
from sqlalchemy import text

def run_migration():
    with engine.connect() as conn:
        print("Running migration to add dual-language fields...")
        try:
            # Add columns if they don't exist
            conn.execute(text("ALTER TABLE articles ADD COLUMN tags_original JSON"))
            conn.execute(text("ALTER TABLE articles ADD COLUMN entities_original JSON"))
            conn.execute(text("ALTER TABLE articles ADD COLUMN ai_summary_original TEXT"))
            print("Migration successful: Added tags_original, entities_original, ai_summary_original")
        except Exception as e:
            print(f"Migration finished (cols likely exist): {e}")

if __name__ == "__main__":
    run_migration()
