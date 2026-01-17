from sqlalchemy import create_engine, text
import os

# Database URL
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./news_aggregator.db")

def migrate():
    engine = create_engine(DATABASE_URL)
    connection = engine.connect()

    try:
        # Check if column exists
        print("Checking for 'resend_api_key' in system_config...")
        try:
            connection.execute(text("SELECT resend_api_key FROM system_config LIMIT 1"))
            print("Column 'resend_api_key' already exists. Skipping.")
        except Exception:
            print("Adding 'resend_api_key' column to system_config...")
            connection.execute(text("ALTER TABLE system_config ADD COLUMN resend_api_key VARCHAR"))
            print("✅ Migration successful: Added 'resend_api_key' column.")
            
    except Exception as e:
        print(f"❌ Migration failed: {e}")
    finally:
        connection.close()

if __name__ == "__main__":
    migrate()
