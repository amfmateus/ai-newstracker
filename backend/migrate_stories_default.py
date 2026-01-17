
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import SystemConfig
from database import SQLALCHEMY_DATABASE_URL
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate():
    logger.info("Starting migration: Disabling stories for all existing users...")
    
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Fetch all configs
        configs = db.query(SystemConfig).all()
        logger.info(f"Found {len(configs)} system configurations.")
        
        updated_count = 0
        for config in configs:
            if config.enable_stories: # Only update if currently True
                config.enable_stories = False
                updated_count += 1
        
        db.commit()
        logger.info(f"Successfully updated {updated_count} configurations to disable stories.")
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
