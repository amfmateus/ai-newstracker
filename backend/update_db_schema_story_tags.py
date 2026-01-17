from database import engine, Base
from sqlalchemy import text

def update_schema():
    print("Updating database schema for Story tags...")
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE stories ADD COLUMN tags JSON"))
            print("Added tags column.")
        except Exception as e:
            print(f"Column tags might already exist: {e}")

        try:
            conn.execute(text("ALTER TABLE stories ADD COLUMN entities JSON"))
            print("Added entities column.")
        except Exception as e:
            print(f"Column entities might already exist: {e}")
        
        conn.commit()
    print("Schema update complete.")

if __name__ == "__main__":
    update_schema()
