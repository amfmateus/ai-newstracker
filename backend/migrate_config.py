from sqlalchemy import text
from database import engine

def migrate():
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE sources ADD COLUMN config JSON DEFAULT '{}'"))
        conn.commit()
    print("Migration successful: Added config column to sources table.")

if __name__ == "__main__":
    try:
        migrate()
    except Exception as e:
        print(f"Migration failed (might already exist): {e}")
