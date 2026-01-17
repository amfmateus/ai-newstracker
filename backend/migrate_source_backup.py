from database import engine, Base
from sqlalchemy import text

def run_migration():
    with engine.connect() as conn:
        print("Running migration to add source_name_backup...")
        try:
            # Add column if not exists
            conn.execute(text("ALTER TABLE articles ADD COLUMN source_name_backup VARCHAR"))
            print("Migration successful: Added source_name_backup")
        except Exception as e:
            print(f"Migration finished (cols likely exist): {e}")

if __name__ == "__main__":
    run_migration()
