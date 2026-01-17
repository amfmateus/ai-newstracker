from sqlalchemy.orm import Session
from sqlalchemy import desc
from models import Report, Article, Source, User, generate_uuid
from schemas import ReportCreate
from datetime import datetime
import json
import logging
from google import genai
import time

logger = logging.getLogger(__name__)

DEFAULT_REPORT_PROMPT = """
        You are an expert intelligence analyst writing a comprehensive report for a high-level executive.
        
        GOAL: Write a structured report based ONLY on the provided articles.
        
        SCOPE/INSTRUCTIONS:
        {scope}
        
        REQUIRED SECTIONS:
        {headings}
        
        CITATION RULES (CRITICAL):
        - You must cite your sources for every factual claim.
        - Use the format [[CITATION:ID]].
        - Example: "Inflation rose by 2% [[CITATION:123-abc]]."
        - Do not use footnotes or other formats.
        
        SOURCE ARTICLES:
        {articles}
        
        Write the report in professional Markdown format.
        """

class ReportGenerator:
    def __init__(self, db: Session):
        self.db = db

    def generate(self, user_id: str, config: ReportCreate) -> Report:
        """
        Generates a new AI Report based on the provided configuration.
        """
        logger.info(f"Generating report for user {user_id}")
        
        # 1. Fetch User & API Key & Config
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user or not user.google_api_key:
             raise ValueError("User not found or missing API Key")
        
        from models import SystemConfig
        sys_config = self.db.query(SystemConfig).filter(SystemConfig.user_id == user_id).first()
        
        model_name = "gemini-2.5-flash-lite"
        custom_prompt = None
        if sys_config:
            model_name = sys_config.report_model or "gemini-2.5-flash-lite"
            custom_prompt = sys_config.report_prompt

        client = genai.Client(api_key=user.google_api_key) # Fast model for long context

        # 2. Fetch Context Articles
        # Filter by Date Range
        try:
            start = datetime.fromisoformat(config.start_date)
            end = datetime.fromisoformat(config.end_date)
        except:
             raise ValueError("Invalid date format")

        query = self.db.query(Article).join(Source).filter(
            Source.user_id == user_id,
            Article.published_at >= start,
            Article.published_at <= end
        )

        # Filter by Sources
        if config.source_ids:
            query = query.filter(Article.source_id.in_(config.source_ids))
            
        # Get most relevant articles first, limit context window
        context_articles = query.order_by(desc(Article.relevance_score)).limit(100).all()
        
        if not context_articles:
             raise ValueError("No articles found matching the criteria")

        # 3. Format Context for LLM
        # We need to provide ID so the LLM can cite it
        articles_text = ""
        for art in context_articles:
            date_str = art.published_at.strftime('%Y-%m-%d') if art.published_at else "N/A"
            source_name = art.source.name if art.source else "Unknown"
            
            # Use English content if available
            title = art.translated_title or art.raw_title
            summary = art.translated_content_snippet or art.generated_summary or ""
            
            articles_text += f"ID: {art.id}\nTitle: {title}\nDate: {date_str}\nSource: {source_name}\nSummary: {summary}\n\n"

        # 4. Construct Prompt
        headings_str = "\n".join([f"- {h}" for h in config.headings]) if config.headings else "- Key Developments\n- Market Impact"
        
        raw_prompt = custom_prompt if custom_prompt else DEFAULT_REPORT_PROMPT
        
        prompt = raw_prompt.format(
            scope=config.scope,
            headings=headings_str,
            articles=articles_text
        )

        try:
            # 5. Call LLM
            logger.info(f"Sending prompt to LLM (Model: {model_name})...")
            start_time = time.time()
            response = client.models.generate_content(
                model=model_name,
                contents=prompt
            )
            elapsed = time.time() - start_time
            logger.info(f"Report generated in {elapsed:.2f}s")
            
            report_content = response.text
            
            # 6. Save Report
            report = Report(
                id=generate_uuid(),
                user_id=user_id,
                title=config.title,
                content=report_content,
                created_at=datetime.utcnow(),
                status='completed',
                configuration=config.dict() # Keep config context
            )
            
            self.db.add(report)
            self.db.commit()
            self.db.refresh(report)
            
            return report

        except Exception as e:
            logger.error(f"Report Generation Failed: {e}")
            self.db.rollback()
            raise e
