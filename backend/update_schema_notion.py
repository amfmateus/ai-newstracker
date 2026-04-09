"""Migration: add notion_token to system_config and delivery_config_ids to report_pipelines."""
import logging
from database import engine
from sqlalchemy import text

logger = logging.getLogger(__name__)

def migrate():
    with engine.connect() as conn:
        migrations = [
            ("system_config", "notion_token", "VARCHAR"),
            ("report_pipelines", "delivery_config_ids", "TEXT"),  # stored as JSON string
        ]
        for table, col, col_type in migrations:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
                conn.commit()
                logger.info(f"Added column {table}.{col}")
            except Exception as e:
                if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                    logger.debug(f"Column {table}.{col} already exists, skipping.")
                else:
                    logger.error(f"Migration error for {table}.{col}: {e}")

if __name__ == "__main__":
    migrate()
