from database import SessionLocal, engine
from sqlalchemy import text, inspect

def run_migration():
    inspector = inspect(engine)
    columns = [c['name'] for c in inspector.get_columns('users')]
    
    if 'google_api_key' not in columns:
        print("Adding google_api_key column to users table...")
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN google_api_key VARCHAR"))
            conn.commit()
        print("Migration complete.")
    else:
        print("Column google_api_key already exists.")

if __name__ == "__main__":
    run_migration()
