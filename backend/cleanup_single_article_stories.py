from sqlalchemy.orm import Session
from database import SessionLocal
from models import Story, Article
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def cleanup_single_article_stories():
    db = SessionLocal()
    try:
        # Find all stories
        stories = db.query(Story).all()
        logger.info(f"Checking {len(stories)} stories for single-article clusters...")
        
        cleaned_count = 0
        released_articles = 0
        
        for story in stories:
            # Count articles in this story
            article_count = db.query(Article).filter(Article.story_id == story.id).count()
            
            if article_count == 1:
                logger.info(f"Cleaning up story '{story.headline}' (id: {story.id}) - has 1 article")
                
                # Release the article
                article = db.query(Article).filter(Article.story_id == story.id).first()
                if article:
                    article.story_id = None
                    released_articles += 1
                
                # Delete the story
                db.delete(story)
                cleaned_count += 1
        
        db.commit()
        logger.info(f"Cleanup complete. Removed {cleaned_count} stories and released {released_articles} articles.")
        
    except Exception as e:
        logger.error(f"Error during cleanup: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    cleanup_single_article_stories()
