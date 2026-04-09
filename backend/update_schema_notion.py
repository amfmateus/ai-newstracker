"""
Migration: add notion_token to system_config and delivery_config_ids to report_pipelines.

Each column is migrated in its own connection so a 'column already exists' error
on one does not abort the transaction and block the others.
Also converts delivery_config_ids from TEXT to JSONB if it was already added as TEXT.
"""
import logging
from database import engine
from sqlalchemy import text

logger = logging.getLogger(__name__)


def _add_column_if_missing(col_name: str, table: str, col_def: str):
    """Add a column inside its own connection/transaction. Silently skips if already exists."""
    with engine.connect() as conn:
        try:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_def}"))
            conn.commit()
            logger.info(f"Added column {table}.{col_name}")
        except Exception as e:
            conn.rollback()
            msg = str(e).lower()
            if "already exists" in msg or "duplicate column" in msg:
                logger.debug(f"Column {table}.{col_name} already exists, skipping.")
            else:
                logger.error(f"Migration error adding {table}.{col_name}: {e}")


def _convert_to_jsonb_if_needed():
    """
    If delivery_config_ids was previously created as TEXT (not JSONB), convert it.
    This is safe on PostgreSQL: USING clause re-parses existing JSON strings.
    On SQLite this is a no-op (SQLite doesn't have JSONB).
    """
    with engine.connect() as conn:
        try:
            # Only relevant on PostgreSQL
            result = conn.execute(text(
                "SELECT data_type FROM information_schema.columns "
                "WHERE table_name='report_pipelines' AND column_name='delivery_config_ids'"
            ))
            row = result.fetchone()
            if row and row[0].lower() == 'text':
                conn.execute(text(
                    "ALTER TABLE report_pipelines "
                    "ALTER COLUMN delivery_config_ids TYPE JSONB "
                    "USING delivery_config_ids::JSONB"
                ))
                conn.commit()
                logger.info("Converted report_pipelines.delivery_config_ids TEXT → JSONB")
        except Exception as e:
            conn.rollback()
            msg = str(e).lower()
            if "does not exist" in msg or "no such" in msg:
                pass  # Column not there yet; _add_column_if_missing will handle it
            else:
                logger.error(f"Migration error converting delivery_config_ids to JSONB: {e}")


def migrate():
    _add_column_if_missing("notion_token", "system_config", "VARCHAR")
    _add_column_if_missing("delivery_config_ids", "report_pipelines", "JSONB")
    _convert_to_jsonb_if_needed()


if __name__ == "__main__":
    migrate()
