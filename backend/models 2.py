from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, JSON, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from datetime import datetime, timezone
from database import Base

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    email = Column(String, unique=True, index=True)
    full_name = Column(String, nullable=True)
    google_api_key = Column(String, nullable=True) # User-specific API Token
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    persona = relationship("UserPersona", back_populates="user", uselist=False)
    sources = relationship("Source", back_populates="user")

class UserPersona(Base):
    __tablename__ = "user_personas"
    
    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"))
    role = Column(String)  # e.g., "Head of Trade"
    interests = Column(JSON)  # List of strings: ["Trade", "Politics"]
    delivery_channel = Column(String, default="Notion") # Notion, Email
    
    user = relationship("User", back_populates="persona")

class Source(Base):
    __tablename__ = "sources"
    
    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id")) # Added
    url = Column(String, index=True)
    name = Column(String, nullable=True)
    type = Column(String) # 'rss', 'html_generic', 'html_custom'
    crawl_interval = Column(Integer, default=15) # Minutes
    last_crawled_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String, default="active") # active, error
    config = Column(JSON, default={}) # Stores: max_articles, min_relevance, min_length
    
    user = relationship("User", back_populates="sources")
    articles = relationship("Article", back_populates="source", cascade="all, delete-orphan")
    crawl_logs = relationship("CrawlEvent", back_populates="source", cascade="all, delete-orphan")

class Report(Base):
    __tablename__ = "reports"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    configuration = Column(JSON, nullable=False) # Stores start_date, end_date, source_ids, headings, scope
    content = Column(Text, nullable=True) # Markdown content
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    status = Column(String, default="creating") # creating, completed, failed

    user = relationship("User", back_populates="reports")

User.reports = relationship("Report", order_by=Report.created_at.desc(), back_populates="user")

class CrawlEvent(Base):
    __tablename__ = "crawl_events"
    
    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    source_id = Column(String, ForeignKey("sources.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String) # 'success', 'error'
    articles_count = Column(Integer, default=0)
    
    source = relationship("Source", back_populates="crawl_logs")

class Story(Base):
    __tablename__ = "stories"
    
    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id")) # Airlock isolation
    headline = Column(String)
    main_summary = Column(Text) # ~120 words
    extended_account = Column(Text, nullable=True)
    sentiment = Column(String, nullable=True) # positive, neutral, negative
    tags = Column(JSON, nullable=True)     # AI generated keywords
    entities = Column(JSON, nullable=True) # AI generated entities (people, orgs)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())
    
    articles = relationship("Article", back_populates="story")
    user = relationship("User")

class Article(Base):
    __tablename__ = "articles"
    
    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    source_id = Column(String, ForeignKey("sources.id"))
    story_id = Column(String, ForeignKey("stories.id"), nullable=True)
    
    url = Column(String, index=True) # REMOVED unique=True
    raw_title = Column(String)
    content_snippet = Column(Text, nullable=True)
    source_name_backup = Column(String, nullable=True) # Retains source name if source is deleted
    generated_summary = Column(Text, nullable=True)
    image_url = Column(String, nullable=True)
    
    __table_args__ = (
        UniqueConstraint('url', 'source_id', name='ix_articles_url_source'),
    )
    
    # AI Enrichment Fields
    language = Column(String, default="en")
    translated_title = Column(String, nullable=True)
    translated_content_snippet = Column(Text, nullable=True)
    translated_generated_summary = Column(Text, nullable=True)
    
    relevance_score = Column(Integer, default=0)
    tags = Column(JSON, nullable=True) # English
    tags_original = Column(JSON, nullable=True) # Original Language
    entities = Column(JSON, nullable=True) # English
    entities_original = Column(JSON, nullable=True) # Original Language
    
    sentiment = Column(String, nullable=True) # positive, neutral, negative
    
    ai_summary = Column(Text, nullable=True) # English
    ai_summary_original = Column(Text, nullable=True) # Original Language

    published_at = Column(DateTime(timezone=True), nullable=True)
    scraped_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    source = relationship("Source", back_populates="articles")
    story = relationship("Story", back_populates="articles")

class SystemConfig(Base):
    __tablename__ = "system_config"
    
    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=True, unique=True) # One config per user
    
    user = relationship("User")

    # 1. General Crawling
    first_crawl_lookback_hours = Column(Integer, default=24)
    min_text_length = Column(Integer, default=200)
    default_crawl_interval_mins = Column(Integer, default=15)
    
    # 2. RSS
    max_rss_entries = Column(Integer, default=100)
    
    # 3. HTML Scraper
    max_link_candidates = Column(Integer, default=1000)
    max_articles_to_scrape = Column(Integer, default=100)
    page_load_timeout_seconds = Column(Integer, default=30)
    
    # 4. AI
    min_relevance_score = Column(Integer, default=50)
    content_topic_focus = Column(String, default="Economics, Trade, Politics, or Finance") # Default prompt focus

    # 5. Story Generation
    story_generation_interval_mins = Column(Integer, default=60)
    clustering_article_window_hours = Column(Integer, default=24) # Lookback for new articles
    clustering_story_context_days = Column(Integer, default=7)   # Lookback for existing stories context
    last_clustering_at = Column(DateTime(timezone=True), nullable=True)

class ClusteringEvent(Base):
    __tablename__ = "clustering_events"
    
    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"))
    
    status = Column(String, default="queued") # queued, running, completed, error
    
    # Inputs
    input_stories_count = Column(Integer, default=0)
    input_articles_count = Column(Integer, default=0)
    
    # Outputs
    new_stories_created = Column(Integer, default=0)
    assignments_made = Column(Integer, default=0)
    unclustered_articles_count = Column(Integer, default=0)
    
    error_message = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    user = relationship("User")
