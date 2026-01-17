from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, JSON, UniqueConstraint, types
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from datetime import datetime, timezone
from database import Base

class UTCDateTime(types.TypeDecorator):
    """
    Custom type to ensure datetimes are always stored as UTC and returned as aware.
    SQLite doesn't support timezones, so we force awareness on load.
    """
    impl = types.DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None:
            if value.tzinfo is None:
                # Force UTC for naive datetimes being saved
                value = value.replace(tzinfo=timezone.utc)
            else:
                # Convert aware datetimes to UTC
                value = value.astimezone(timezone.utc)
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            if value.tzinfo is None:
                # Add UTC awareness to naive datetimes from DB
                value = value.replace(tzinfo=timezone.utc)
        return value

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
    
    # New relationships for Pipeline Libraries
    assets = relationship("Asset", back_populates="user", cascade="all, delete-orphan")
    prompt_libraries = relationship("PromptLibrary", back_populates="user", cascade="all, delete-orphan")
    formatting_libraries = relationship("FormattingLibrary", back_populates="user", cascade="all, delete-orphan")
    output_libraries = relationship("OutputConfigLibrary", back_populates="user", cascade="all, delete-orphan")
    delivery_libraries = relationship("DeliveryConfigLibrary", back_populates="user", cascade="all, delete-orphan")
    source_config_libraries = relationship("SourceConfigLibrary", back_populates="user", cascade="all, delete-orphan")
    report_pipelines = relationship("ReportPipeline", back_populates="user", cascade="all, delete-orphan")

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
    crawl_interval = Column(Integer, default=60) # Minutes
    crawl_method = Column(String, default="auto") # auto, rss, html, pdf
    last_crawled_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String, default="active") # active, error
    config = Column(JSON, default={}) # Stores: max_articles, min_relevance, min_length
    reference_name = Column(String, nullable=True) # Shorter name for citations
    
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
    
    # Metadata for Diagnostics
    meta_duration_ms = Column(Integer, nullable=True)
    meta_model = Column(String, nullable=True)
    meta_tokens_in = Column(Integer, nullable=True)
    meta_tokens_out = Column(Integer, nullable=True)
    meta_prompt = Column(Text, nullable=True)

    # Archive Metadata (New)
    pipeline_id = Column(String, ForeignKey("report_pipelines.id"), nullable=True)
    run_type = Column(String, default="manual") # manual, scheduled, test
    delivery_log = Column(JSON, default=[]) # List of delivery events
    article_ids = Column(JSON, default=[]) # Snapshot of used article IDs

    user = relationship("User", back_populates="reports")
    pipeline = relationship("ReportPipeline", back_populates="reports")

# Legacy Template Model (Kept for backward compatibility if needed, or migration)
class ReportTemplate(Base):
    __tablename__ = "report_templates"
    
    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"))
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    headings = Column(JSON, nullable=False) # List of strings
    scope = Column(Text, nullable=False)
    prompt_override = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    user = relationship("User", back_populates="report_templates")

User.reports = relationship("Report", order_by=Report.created_at.desc(), back_populates="user")
User.report_templates = relationship("ReportTemplate", back_populates="user", cascade="all, delete-orphan")

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

    # 0. SMTP Settings
    smtp_host = Column(String, nullable=True)
    smtp_port = Column(Integer, default=587)
    smtp_user = Column(String, nullable=True)
    smtp_password = Column(String, nullable=True)
    smtp_from_email = Column(String, nullable=True)
    smtp_sender_name = Column(String, nullable=True)
    smtp_reply_to = Column(String, nullable=True)
    resend_api_key = Column(String, nullable=True)

    # 1. General Crawling
    first_crawl_lookback_hours = Column(Integer, default=24)
    min_text_length = Column(Integer, default=200)
    default_crawl_interval_mins = Column(Integer, default=15)
    
    # 2. RSS
    max_rss_entries = Column(Integer, default=100)
    
    # 3. HTML Scraper
    max_articles_to_scrape = Column(Integer, default=100)
    page_load_timeout_seconds = Column(Integer, default=30)
    
    # 4. AI
    min_relevance_score = Column(Integer, default=50)
    content_topic_focus = Column(String, default="Economics, Trade, Politics, or Finance") # Default prompt focus
    
    analysis_model = Column(String, nullable=True)
    analysis_prompt = Column(Text, nullable=True)
    
    clustering_model = Column(String, nullable=True)
    clustering_prompt = Column(Text, nullable=True)
    
    report_model = Column(String, nullable=True)
    report_prompt = Column(Text, nullable=True)

    # 5. Dynamic PDF Crawler
    pdf_crawl_model = Column(String, nullable=True)
    pdf_crawl_prompt = Column(Text, nullable=True)

    # 5. Story Generation
    enable_stories = Column(Boolean, default=False)
    story_generation_interval_mins = Column(Integer, default=60)
    min_story_strength = Column(Integer, default=2) # Minimum articles per story
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

# --- New Asset Management ---

class Asset(Base):
    __tablename__ = "assets"

    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"))
    name = Column(String, nullable=False) # Helper name e.g "Company Logo"
    file_path = Column(String, nullable=False) # Local path
    url = Column(String, nullable=True) # Public URL if served via static
    asset_type = Column(String, default="image") # image, font, etc.
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="assets")

# --- New Pipeline Libraries ---

class PromptLibrary(Base):
    __tablename__ = "prompt_library"

    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"))
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    prompt_text = Column(Text, nullable=False) # The system instructions
    model = Column(String, default="gemini-2.0-flash-lite") # Added model selection
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="prompt_libraries")
    pipelines = relationship("ReportPipeline", back_populates="prompt")

class FormattingLibrary(Base):
    __tablename__ = "formatting_library"

    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"))
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    structure_definition = Column(Text, nullable=False) # Jinja2 Template
    css = Column(Text, nullable=True) # CSS styles
    citation_type = Column(String, default="numeric_superscript") # 'numeric_superscript', 'none', etc.
    parameters = Column(JSON, default={}) # For citation style config
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="formatting_libraries")
    pipelines = relationship("ReportPipeline", back_populates="formatting")

class OutputConfigLibrary(Base):
    __tablename__ = "output_config_library"

    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"))
    name = Column(String, nullable=False) # e.g. "Standard PDF"
    converter_type = Column(String, nullable=False) # 'PDF', 'MD', 'DOCX'
    parameters = Column(JSON, default={}) # e.g. { "page_size": "A4" }
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="output_libraries")
    pipelines = relationship("ReportPipeline", back_populates="output_config")

class DeliveryConfigLibrary(Base):
    __tablename__ = "delivery_config_library"

    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"))
    name = Column(String, nullable=False) # e.g. "Management Team List"
    delivery_type = Column(String, nullable=False) # 'EMAIL', 'TELEGRAM', 'DRIVE'
    parameters = Column(JSON, default={}) # e.g. { "recipients": ["ceo@example.com"] }
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="delivery_libraries")
    pipelines = relationship("ReportPipeline", back_populates="delivery_config")

class SourceConfigLibrary(Base): # Fixed name from Base
    __tablename__ = "source_config_library"

    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"))
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    config = Column(JSON, nullable=False, default={}) # The filter JSON
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="source_config_libraries")

# --- Report Pipeline ---

class ReportPipeline(Base):
    __tablename__ = "report_pipelines"

    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"))
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    
    # Scheduling
    schedule_enabled = Column(Boolean, default=False)
    schedule_cron = Column(String, nullable=True) # e.g. "0 9 * * 1"
    next_run_at = Column(DateTime(timezone=True), nullable=True)

    # Step 1: Inline Source Config
    source_config = Column(JSON, nullable=False, default={}) 
    # { "filter_date": "24h", "keywords": [], "categories": [] }

    # Step 2: Processing (Prompt)
    prompt_id = Column(String, ForeignKey("prompt_library.id"), nullable=True)
    
    # Step 3: Formatting
    formatting_id = Column(String, ForeignKey("formatting_library.id"), nullable=True)
    
    # Step 4: Output
    output_config_id = Column(String, ForeignKey("output_config_library.id"), nullable=True)
    
    # Step 5: Delivery
    delivery_config_id = Column(String, ForeignKey("delivery_config_library.id"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="report_pipelines")
    
    prompt = relationship("PromptLibrary", back_populates="pipelines")
    formatting = relationship("FormattingLibrary", back_populates="pipelines")
    output_config = relationship("OutputConfigLibrary", back_populates="pipelines")
    delivery_config = relationship("DeliveryConfigLibrary", back_populates="pipelines")
    
    reports = relationship("Report", back_populates="pipeline")

class PipelineTestCache(Base):
    __tablename__ = "pipeline_test_cache"

    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"))
    step_number = Column(Integer)
    # config_hash is a hash of the parameters that produced the result
    config_hash = Column(String, index=True)
    result = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
