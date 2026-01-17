from sqlalchemy import create_engine, text
import os

# Database URL
# Database URL
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./news_aggregator.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

def migrate():
    engine = create_engine(DATABASE_URL)
    # Use generic inspection first to avoid transaction aborts on Postgres
    from sqlalchemy import inspect
    
    inspector = inspect(engine)
    columns = [c["name"] for c in inspector.get_columns("system_config")]
    
    if "resend_api_key" in columns:
        print("Column 'resend_api_key' already exists. Skipping.")
    else:
        print("Adding 'resend_api_key' column to system_config...")
        # Add column in a transaction
        with engine.begin() as connection:
             connection.execute(text("ALTER TABLE system_config ADD COLUMN resend_api_key VARCHAR"))
        print("✅ Migration successful: Added 'resend_api_key' column.")

if __name__ == "__main__":
    migrate()
