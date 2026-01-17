from sqlalchemy.orm import Session
from sqlalchemy import desc
from models import Story, Article, User, ClusteringEvent
from datetime import datetime, timedelta, timezone
import json
import logging
from google import genai
from logger_config import setup_logger

logger = setup_logger(__name__)

def calculate_story_sentiment(articles: list) -> str:
    if not articles:
        return "neutral"
    
    values = []
    for a in articles:
        sentiment = getattr(a, 'sentiment', 'neutral')
        if sentiment == "positive":
            values.append(1)
        elif sentiment == "negative":
            values.append(-1)
        else:
            values.append(0)
    
    avg = sum(values) / len(values)
    
    if avg >= 0.333:
        return "positive"
    elif avg <= -0.333:
        return "negative"
    return "neutral"

DEFAULT_CLUSTERING_PROMPT = """
        You are an expert news editor. Your task is to organize incoming news articles into "Stories" (clusters).
        
        CONTEXT (Existing Stories):
        {existing_stories}
        
        INPUT (New Articles):
        {new_articles}
        
        INSTRUCTIONS:
        1. **ASSIGNMENT**: Check if any "New Article" belongs to an "Existing Story". 
           - **Topic Match**: Must match the exact topic/event.
           - **Time Coherence**: Must be temporally related. Do NOT assign a new article to an old story about a PAST instance of a recurring event (e.g., last month's CPI data).
        
        2. **NEW STORIES**: Group remaining articles into NEW Stories.
           - **Event Specificity**: "The Fed raised rates" (Specific) vs "Global Economics" (Broad).
           - **Time Match**: Articles MUST be from the same timeframe (within 24-48h). Do NOT group disconnected events from different weeks.
           - **Recurring Events**: Treat recurring events (e.g., "Monthly Inflation Report", "Weekly Jobless Claims") as SEPARATE stories if they refer to different periods.
           - **Minimum Count**: Must have at least {min_story_strength} articles.
           - **Headlines**: Event-driven (e.g., "SpaceX Successfully Launches Starship").
        
        3. **CONTENT GENERATION**: For each new story, generate:
           - **Headline**: Specific and descriptive.
           - **Executive Summary**: A concise high-level overview (max 100 words).
           - **Extended Account**: A comprehensive detailed analysis (500-1000 words). 
             - **FORMAT**: Use Markdown. Divide into clear subtopics using `### Subheaders`. Use bullet points where appropriate.
             - **CONTENT**: Cover the background, key details, involved parties, and potential implications.
           - **Tags**: 3-5 high-level keywords representing the story theme (e.g., "Monetary Policy", "Space Exploration").
           - **Entities**: List of key people, organizations, or locations involved.
        
        4. **EXCLUSION**: Ignore isolated articles that don't fit any tight group.
        
        OUTPUT FORMAT (JSON ONLY):
        {{
            "assignments": [
                {{ "article_id": "...", "story_id": "..." }} 
            ],
            "new_stories": [
                {{
                    "headline": "Specific Event Headline",
                    "executive_summary": "High-level overview...",
                    "extended_account": "Detailed main body...",
                    "tags": ["Tag1", "Tag2"],
                    "entities": ["Entity1", "Entity2"],
                    "article_ids": ["...", "..."] 
                }}
            ]
        }}
        """

def analyze_clusters(db: Session, user_id: str, api_key: str, event_id: str = None):
    """
    Core logic to group ungrouped articles into Stories (Themes).
    1. Fetches "Active Stories" (recent) for CONTEXT.
    2. Fetches "Ungrouped Articles" for INPUT.
    3. Asks AI to match or create new groups.
    """
    
    # 0. Fetch Event if exists
    event = None
    if event_id:
        event = db.query(ClusteringEvent).filter(ClusteringEvent.id == event_id).first()
        if event:
            event.status = "running"
            db.commit()

    try:
    # 1. Fetch User & Config
        logger.info(f"Starting analyze_clusters for user_id: {user_id}")
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            logger.error(f"User {user_id} not found in database")
            raise ValueError("User not found")

        # Fetch System Config
        from models import SystemConfig
        sys_config = db.query(SystemConfig).filter(SystemConfig.user_id == user_id).first()
        
        # Default defaults
        context_days = 7
        article_hours = 24
        
        # New Settings
        model_name = "gemini-2.5-flash-lite"
        custom_prompt = None
        
        if sys_config:
            context_days = sys_config.clustering_story_context_days or 7
            article_hours = sys_config.clustering_article_window_hours or 24
            min_story_strength = sys_config.min_story_strength or 2
            model_name = sys_config.clustering_model or "gemini-2.5-flash-lite"
            custom_prompt = sys_config.clustering_prompt
        else:
            min_story_strength = 2
        
        logger.info(f"Clustering Config: Story Context={context_days} days, Article Scan={article_hours} hours | Model: {model_name}")

        if not api_key:
            logger.error(f"No API Key provided for user {user_id}")
            return {"status": "error", "message": "No API Key"}

        logger.info("Configuring Gemini API...")
        client = genai.Client(api_key=api_key)
        
        # 2. Fetch Active Stories (Configurable Context)
        since_date = datetime.now(timezone.utc) - timedelta(days=context_days)
        active_stories = db.query(Story).filter(
            Story.user_id == user_id,
            Story.updated_at >= since_date
        ).all()
        logger.info(f"Found {len(active_stories)} active stories for context (last {context_days} days).")
        
        existing_stories_json = [
            {
                "id": s.id, 
                "headline": s.headline, 
                "summary": s.main_summary,
                "date": s.updated_at.isoformat() if s.updated_at else "Unknown"
            }
            for s in active_stories
        ]

        # 3. Fetch Ungrouped Articles (Configurable Window)
        article_window = datetime.now(timezone.utc) - timedelta(hours=article_hours)
        new_articles = db.query(Article).filter(
            Article.source.has(user_id=user_id),
            Article.scraped_at >= article_window,
            Article.story_id == None,
            Article.relevance_score >= 40
        ).limit(50).all()
        
        logger.info(f"Found {len(new_articles)} ungrouped articles to process (last {article_hours} hours).")

        # Update Event Inputs
        if event:
            event.input_stories_count = len(active_stories)
            event.input_articles_count = len(new_articles)
            db.commit()

        if not new_articles:
            logger.info("No new articles to cluster. Exiting.")
            if event:
                event.status = "completed"
                event.completed_at = datetime.now(timezone.utc)
                event.unclustered_articles_count = 0 
                db.commit()
            return {"status": "no_articles", "message": "No new articles to cluster."}

        articles_json = [
            {
                "id": a.id, 
                "headline": a.translated_title or a.raw_title, 
                "source": a.source.name if a.source else "Unknown",
                "date": (a.published_at or a.scraped_at).isoformat()
            }
            for a in new_articles
        ]
        
        # 4. Prompt Engineering
        logger.info("Preparing prompt for Gemini...")
        raw_prompt = custom_prompt if custom_prompt else DEFAULT_CLUSTERING_PROMPT
        
        prompt = raw_prompt.format(
            existing_stories=json.dumps(existing_stories_json, indent=2),
            new_articles=json.dumps(articles_json, indent=2),
            min_story_strength=min_story_strength
        )
        
        logger.info(f"Sending request to Gemini API (Model: {model_name})...")
        # Log a snippet of the articles list for debugging
        logger.debug(f"Articles to cluster: {len(articles_json)}")
        
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config={"response_mime_type": "application/json"}
        )
        logger.info("Received response from Gemini.")
        result = json.loads(response.text)
        
        input_article_ids = {a.id for a in new_articles}
        updates_count = 0
        created_count = 0
        assigned_article_ids = set()
        
        # 5. Process Assignments (Existing Stories)
        assignments = result.get("assignments", [])
        logger.info(f"Gemini proposed {len(assignments)} assignments to existing stories.")
        for assignment in assignments:
            article_id = assignment["article_id"]
            if article_id not in input_article_ids:
                logger.warning(f"Gemini tried to assign article {article_id} which was not in input. Ignoring.")
                continue

            assigned_article_ids.add(article_id)
            article = db.query(Article).filter(Article.id == article_id).first()
            if article and article.source.user_id == user_id: 
                article.story_id = assignment["story_id"]
                story = db.query(Story).filter(Story.id == assignment["story_id"]).first()
                if story: 
                    all_articles = db.query(Article).filter(Article.story_id == story.id).all()
                    story.sentiment = calculate_story_sentiment(all_articles)
                updates_count += 1

        # 6. Process New Stories
        new_stories = result.get("new_stories", [])
        logger.info(f"Gemini proposed {len(new_stories)} new stories.")
        for ns in new_stories:
            article_ids = ns.get("article_ids", [])
            # Filter IDs to only those in our input
            valid_input_ids = [aid for aid in article_ids if aid in input_article_ids]
            
            if len(valid_input_ids) < min_story_strength: 
                logger.info(f"Skipping proposed story '{ns.get('headline')}' - only {len(valid_input_ids)} valid input articles (threshold: {min_story_strength}).")
                continue
            
            current_story_articles = []
            for art_id in valid_input_ids:
                 article = db.query(Article).filter(Article.id == art_id).first()
                 if article and article.source.user_id == user_id:
                     current_story_articles.append(article)
                     assigned_article_ids.add(art_id)
            
            if len(current_story_articles) < min_story_strength:
                 continue

            # Create Story
            story = Story(
                user_id=user_id,
                headline=ns["headline"],
                main_summary=ns.get("executive_summary") or ns.get("summary"), # Fallback
                extended_account=ns.get("extended_account"),
                tags=ns.get("tags", []),
                entities=ns.get("entities", []),
                sentiment=calculate_story_sentiment(current_story_articles),
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            db.add(story)
            db.flush() 
            
            # Link Articles
            for article in current_story_articles:
                article.story_id = story.id
            
            created_count += 1
            logger.info(f"Created story: {ns['headline']} with {len(current_story_articles)} articles.")
            
        unclustered_count = len(input_article_ids) - len(assigned_article_ids)
        
        # Update Event Success
        if event:
            event.status = "completed"
            event.assignments_made = updates_count
            event.new_stories_created = created_count
            event.unclustered_articles_count = unclustered_count
            event.completed_at = datetime.now(timezone.utc)
            
        db.commit()
        logger.info(f"Clustering complete. Assigned: {updates_count}, Created: {created_count}")
        
        return {
            "status": "success",
            "assigned": updates_count,
            "created": created_count
        }

    except Exception as e:
        logger.error(f"Clustering Error during execution: {e}", exc_info=True)
        db.rollback()
        # Update Event Error
        try:
            # Need new transaction or session state might be broken
            if event_id:
                 # Re-query in case session is borked? 
                 # Usually simple rollback and re-query works if we need to save the error state.
                 # But we might need to be careful about double rollback.
                 event_err = db.query(ClusteringEvent).filter(ClusteringEvent.id == event_id).first()
                 if event_err:
                    event_err.status = "error"
                    event_err.error_message = str(e)
                    event_err.completed_at = datetime.now(timezone.utc)
                    db.commit()
        except Exception as inner_e:
            logger.error(f"Failed to save clustering error state: {inner_e}")
            
        raise e
