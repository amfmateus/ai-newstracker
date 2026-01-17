from database import SessionLocal
from models import Story, Article
from clustering import calculate_story_sentiment

def migrate_sentiments():
    db = SessionLocal()
    try:
        stories = db.query(Story).all()
        print(f"Migrating {len(stories)} stories...")
        for story in stories:
            articles = db.query(Article).filter(Article.story_id == story.id).all()
            new_sentiment = calculate_story_sentiment(articles)
            story.sentiment = new_sentiment
            print(f"Story {story.id}: {new_sentiment}")
        db.commit()
        print("Migration complete.")
    finally:
        db.close()

if __name__ == "__main__":
    migrate_sentiments()
