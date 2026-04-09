"""Migration: add google_api_key_enabled and anthropic_api_key_enabled to users table."""
import logging
from database import engine
from sqlalchemy import text

logger = logging.getLogger(__name__)

def migrate():
    with engine.connect() as conn:
        for col, default in [
            ("google_api_key_enabled", "true"),
            ("anthropic_api_key_enabled", "true"),
        ]:
            try:
                conn.execute(text(
                    f"ALTER TABLE users ADD COLUMN {col} BOOLEAN NOT NULL DEFAULT {default}"
                ))
                conn.commit()
                logger.info(f"Added column users.{col}")
            except Exception as e:
                if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                    logger.debug(f"Column users.{col} already exists, skipping.")
                else:
                    logger.error(f"Migration error for users.{col}: {e}")

if __name__ == "__main__":
    migrate()
