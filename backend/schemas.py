from pydantic import BaseModel, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

class SourceCreate(BaseModel):
    name: Optional[str] = None
    url: str
    type: str # Added type
    crawl_interval: Optional[int] = 60
    crawl_method: Optional[str] = "auto"
    crawl_config: Optional[Dict[str, Any]] = None
    reference_name: Optional[str] = None
    status: Optional[str] = "active"

class SystemConfigUpdate(BaseModel):
    first_crawl_lookback_hours: Optional[int] = None
    min_text_length: Optional[int] = None
    default_crawl_interval_mins: Optional[int] = None
    max_rss_entries: Optional[int] = None
    max_articles_to_scrape: Optional[int] = None
    page_load_timeout_seconds: Optional[int] = None
    min_relevance_score: Optional[int] = None
    content_topic_focus: Optional[str] = None
    story_generation_interval_mins: Optional[int] = None
    clustering_article_window_hours: Optional[int] = None
    clustering_story_context_days: Optional[int] = None
    min_story_strength: Optional[int] = None
    enable_stories: Optional[bool] = None
    
    analysis_model: Optional[str] = None
    analysis_prompt: Optional[str] = None
    clustering_model: Optional[str] = None
    clustering_prompt: Optional[str] = None
    report_model: Optional[str] = None
    report_prompt: Optional[str] = None
    pdf_crawl_model: Optional[str] = None
    pdf_crawl_prompt: Optional[str] = None

    # SMTP
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from_email: Optional[str] = None
    smtp_sender_name: Optional[str] = None
    smtp_sender_name: Optional[str] = None
    smtp_reply_to: Optional[str] = None
    resend_api_key: Optional[str] = None

    class Config:
        extra = "ignore"

class SourceResponse(BaseModel):
    id: str
    name: Optional[str] = None
    url: Optional[str] = None
    type: Optional[str] = None
    crawl_interval: Optional[int] = 60
    crawl_method: Optional[str] = "auto"
    crawl_config: Optional[Dict[str, Any]] = None
    reference_name: Optional[str] = None
    last_crawled_at: Optional[datetime] = None
    status: Optional[str] = None
    last_crawl_status: Optional[str] = None
    last_crawl_count: Optional[int] = None
    is_active: Optional[bool] = True
    
    class Config:
        from_attributes = True

class ArticleResponse(BaseModel):
    id: str
    source_id: Optional[str] = None
    url: str
    raw_title: str
    content_snippet: Optional[str] = None
    source_name_backup: Optional[str] = None
    generated_summary: Optional[str] = None
    image_url: Optional[str] = None
    
    language: Optional[str] = "en"
    translated_title: Optional[str] = None
    translated_content_snippet: Optional[str] = None
    translated_generated_summary: Optional[str] = None
    
    relevance_score: Optional[int] = 0
    tags: Optional[List[str]] = None
    tags_original: Optional[List[str]] = None
    entities: Optional[List[str]] = None
    entities_original: Optional[List[str]] = None
    
    sentiment: Optional[str] = None
    ai_summary: Optional[str] = None
    ai_summary_original: Optional[str] = None
    
    published_at: Optional[datetime] = None
    scraped_at: Optional[datetime] = None
    
    source: Optional[SourceResponse] = None
    story_id: Optional[str] = None
    
    @field_validator('published_at', 'scraped_at', mode='before')
    @classmethod
    def ensure_utc(cls, v):
        if isinstance(v, datetime) and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v

    class Config:
        from_attributes = True

class PaginatedArticleResponse(BaseModel):
    items: List[ArticleResponse]
    total: int

class SourceUpdate(BaseModel):
    name: Optional[str] = None
    crawl_interval: Optional[int] = None
    is_active: Optional[bool] = None
    crawl_method: Optional[str] = None
    crawl_config: Optional[Dict[str, Any]] = None
    reference_name: Optional[str] = None
    status: Optional[str] = None

class StoryResponse(BaseModel):
    id: str
    headline: str
    main_summary: Optional[str] = None
    extended_account: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    articles: Optional[List[ArticleResponse]] = None
    article_count: Optional[int] = None
    sentiment: Optional[str] = None
    tags: Optional[List[str]] = None
    entities: Optional[List[str]] = None
    
    @field_validator('created_at', 'updated_at', mode='before')
    @classmethod
    def ensure_utc(cls, v):
        if isinstance(v, datetime) and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v

    class Config:
        from_attributes = True

class PaginatedStoryResponse(BaseModel):
    items: List[StoryResponse]
    total: int

class SettingsSchema(BaseModel):
    first_crawl_lookback_hours: int
    min_text_length: int
    default_crawl_interval_mins: int
    max_rss_entries: int
    max_articles_to_scrape: int
    page_load_timeout_seconds: int
    min_relevance_score: int
    content_topic_focus: str
    story_generation_interval_mins: int
    clustering_article_window_hours: int
    clustering_story_context_days: int
    min_story_strength: int
    last_clustering_at: Optional[datetime] = None
    enable_stories: bool = True
    
    analysis_model: str
    analysis_prompt: Optional[str] = None
    clustering_model: str
    clustering_prompt: Optional[str] = None
    report_model: str
    report_prompt: Optional[str] = None
    pdf_crawl_model: str
    pdf_crawl_prompt: Optional[str] = None

    # SMTP
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from_email: Optional[str] = None
    smtp_sender_name: Optional[str] = None
    smtp_sender_name: Optional[str] = None
    smtp_reply_to: Optional[str] = None
    resend_api_key: Optional[str] = None

    id: str
    user_id: str

    class Config:
        from_attributes = True
        extra = "ignore"

class SettingsUpdate(SystemConfigUpdate):
    pass

class UserProfile(BaseModel):
    id: str # Fixed from int to str
    email: str
    full_name: Optional[str] = None
    has_api_key: bool
    
    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    google_api_key: Optional[str] = None
    full_name: Optional[str] = None

# --- Report Template Schemas (Legacy) ---
class ReportTemplateBase(BaseModel):
    name: str
    description: Optional[str] = None
    headings: List[str]
    scope: str
    prompt_override: Optional[str] = None

class ReportTemplateCreate(ReportTemplateBase):
    pass

class ReportTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    headings: Optional[List[str]] = None
    scope: Optional[str] = None
    prompt_override: Optional[str] = None

class ReportTemplateResponse(ReportTemplateBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# --- Report Schemas ---
class ReportBase(BaseModel):
    title: str
    subtitle: Optional[str] = None
    author: Optional[str] = None
    start_date: str
    end_date: str
    source_ids: Optional[List[str]] = None
    # Filter parameters for the report
    search: Optional[str] = None
    sentiment: Optional[str] = None
    tags: Optional[List[str]] = None
    entities: Optional[List[str]] = None
    min_relevance: Optional[int] = None
    story_status: Optional[str] = None
    date_type: Optional[str] = 'published'
    article_ids: Optional[List[str]] = None
    
    headings: List[str]
    scope: str
    template_id: Optional[str] = None
    formatting_id: Optional[str] = None

class ReportCreate(ReportBase):
    pass

class ReportResponse(ReportBase):
    id: str
    user_id: str
    content: Optional[str] = None
    created_at: datetime
    status: str
    
    meta_duration_ms: Optional[int] = None
    meta_model: Optional[str] = None
    meta_tokens_in: Optional[int] = None
    meta_tokens_out: Optional[int] = None
    meta_prompt: Optional[str] = None

    # Archive Metadata
    pipeline_id: Optional[str] = None
    run_type: Optional[str] = "manual"
    delivery_log: Optional[List[Dict[str, Any]]] = None

    @field_validator('created_at', mode='before')
    @classmethod
    def ensure_utc(cls, v):
        if isinstance(v, datetime) and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v

    class Config:
        from_attributes = True

class EmailRequest(BaseModel):
    email: str

# --- Pipeline & Library Schemas ---

# 1. Assets
class AssetBase(BaseModel):
    name: str
    asset_type: Optional[str] = "image"

class AssetCreate(AssetBase):
    pass # File upload handled separately

class AssetResponse(AssetBase):
    id: str
    url: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

# 2. Prompt Library
class PromptLibraryBase(BaseModel):
    name: str
    description: Optional[str] = None
    prompt_text: str
    model: Optional[str] = "gemini-2.0-flash-lite" # Added model field

class PromptLibraryCreate(PromptLibraryBase):
    pass

class PromptLibraryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    prompt_text: Optional[str] = None
    model: Optional[str] = None # Added model update field

class PromptLibraryResponse(PromptLibraryBase):
    id: str
    created_at: datetime
    
    class Config:
        from_attributes = True

# 3. Formatting Library
class FormattingLibraryBase(BaseModel):
    name: str
    description: Optional[str] = None
    structure_definition: str
    css: Optional[str] = None
    citation_type: Optional[str] = "numeric_superscript"
    parameters: Dict[str, Any] = {}

class FormattingLibraryCreate(FormattingLibraryBase):
    pass

class FormattingLibraryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    structure_definition: Optional[str] = None
    css: Optional[str] = None
    citation_type: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None

class FormattingLibraryResponse(FormattingLibraryBase):
    id: str
    created_at: datetime
    
    class Config:
        from_attributes = True

# 4. Output Config Library
class OutputConfigLibraryBase(BaseModel):
    name: str
    converter_type: str
    parameters: Dict[str, Any] = {}

class OutputConfigLibraryCreate(OutputConfigLibraryBase):
    pass

class OutputConfigLibraryUpdate(BaseModel):
    name: Optional[str] = None
    converter_type: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None

class OutputConfigLibraryResponse(OutputConfigLibraryBase):
    id: str
    created_at: datetime
    
    class Config:
        from_attributes = True

# 5. Delivery Config Library
class DeliveryConfigLibraryBase(BaseModel):
    name: str
    delivery_type: str
    parameters: Dict[str, Any] = {}

class DeliveryConfigLibraryCreate(DeliveryConfigLibraryBase):
    pass

class DeliveryConfigLibraryUpdate(BaseModel):
    name: Optional[str] = None
    delivery_type: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None

class DeliveryConfigLibraryResponse(DeliveryConfigLibraryBase):
    id: str
    created_at: datetime
    
    class Config:
        from_attributes = True

# 6. Source Config Library
class SourceConfigLibraryBase(BaseModel):
    name: str
    description: Optional[str] = None
    config: Dict[str, Any] = {}

class SourceConfigLibraryCreate(SourceConfigLibraryBase):
    pass

class SourceConfigLibraryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    config: Optional[Dict[str, Any]] = None

class SourceConfigLibraryResponse(SourceConfigLibraryBase):
    id: str
    created_at: datetime
    
    class Config:
        from_attributes = True

# 7. Report Pipeline
class ReportPipelineBase(BaseModel):
    name: str
    description: Optional[str] = None
    source_config: Dict[str, Any] = {}
    
    prompt_id: Optional[str] = None
    formatting_id: Optional[str] = None
    output_config_id: Optional[str] = None
    delivery_config_id: Optional[str] = None
    
    schedule_enabled: bool = False
    schedule_cron: Optional[str] = None

class ReportPipelineCreate(ReportPipelineBase):
    pass

class ReportPipelineUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    source_config: Optional[Dict[str, Any]] = None
    prompt_id: Optional[str] = None
    formatting_id: Optional[str] = None
    output_config_id: Optional[str] = None
    delivery_config_id: Optional[str] = None
    schedule_enabled: Optional[bool] = None
    schedule_cron: Optional[str] = None

class ReportPipelineResponse(ReportPipelineBase):
    id: str
    created_at: datetime
    updated_at: datetime
    next_run_at: Optional[datetime] = None
    
    # Expanded objects (Optional, often useful for UI to have names)
    prompt: Optional[PromptLibraryResponse] = None
    formatting: Optional[FormattingLibraryResponse] = None
    output_config: Optional[OutputConfigLibraryResponse] = None
    delivery_config: Optional[DeliveryConfigLibraryResponse] = None

    class Config:
        from_attributes = True
