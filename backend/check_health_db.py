from database import SessionLocal, engine
from sqlalchemy import text, inspect

def check_health():
    print("Checking Database Health...")
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    print(f"Tables found: {tables}")
    
    with engine.connect() as conn:
        for table in tables:
            try:
                count = conn.execute(text(f"SELECT count(*) FROM {table}")).scalar()
                print(f" - {table}: {count} rows")
            except Exception as e:
                print(f" - {table}: ERROR {e}")

if __name__ == "__main__":
    check_health()
