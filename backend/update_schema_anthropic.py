from sqlalchemy import create_engine, inspect, text
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./news_aggregator.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

def migrate():
    engine = create_engine(DATABASE_URL)
    inspector = inspect(engine)
    columns = [c["name"] for c in inspector.get_columns("users")]

    if "anthropic_api_key" in columns:
        print("Column 'anthropic_api_key' already exists. Skipping.")
    else:
        print("Adding 'anthropic_api_key' column to users...")
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE users ADD COLUMN anthropic_api_key VARCHAR"))
        print("✅ Migration successful: Added 'anthropic_api_key' column.")

if __name__ == "__main__":
    migrate()
