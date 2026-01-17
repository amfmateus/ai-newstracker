from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import json
import logging
import os
from sqlalchemy.orm import Session

from models import (
    ReportPipeline, Article, Story, Source, 
    PromptLibrary, FormattingLibrary, OutputConfigLibrary, DeliveryConfigLibrary,
    SourceConfigLibrary, Report, User, PipelineTestCache, SystemConfig
)
from schemas import ArticleResponse
from ai_service import AIService
from email_service import send_report_email
from jinja2 import Template
from utils.debug_logger import PipelineDebugLogger

logger = logging.getLogger(__name__)

class PipelineContext:
    def __init__(self, pipeline_id: str, user_id: str):
        self.pipeline_id = pipeline_id
        self.user_id = user_id
        self.pipeline_name: Optional[str] = None
        self.start_time = datetime.utcnow()
        self.state: Dict[str, Any] = {
            "step_1_source": {},
            "step_2_processing": {},
            "step_3_formatting": {},
            "step_4_output": {},
            "step_5_delivery": {}
        }
    
    def update(self, step: str, data: Dict[str, Any]):
        if step not in self.state:
            self.state[step] = {}
        self.state[step].update(data)
        
    def get(self, step: str) -> Dict[str, Any]:
        return self.state.get(step, {})
        
    def to_dict(self):
        return {
            "pipeline_id": self.pipeline_id,
            "user_id": self.user_id,
            "start_time": self.start_time.isoformat(),
            "state": self.state
        }

class PipelineExecutor:
    def __init__(self, db: Session):
        self.db = db

    async def run_pipeline(self, pipeline_id: str, user_id: str, run_type: str = "manual"):
        pipeline = self.db.query(ReportPipeline).filter(
            ReportPipeline.id == pipeline_id, 
            ReportPipeline.user_id == user_id
        ).first()
        
        if not pipeline:
            raise ValueError(f"Pipeline {pipeline_id} not found")
            
        context = PipelineContext(pipeline_id, user_id)
        context.pipeline_name = pipeline.name
        
        # 1. Source (Inline Config)
        articles = self._execute_source(pipeline.source_config, context)
        
        # 2. Processing (Prompt Library)
        ai_content = {}
        if pipeline.prompt_id:
            prompt_lib = self.db.query(PromptLibrary).get(pipeline.prompt_id)
            if prompt_lib:
                ai_content = await self._execute_processing(prompt_lib, articles, context)
        
        # 3. Formatting (Formatting Library)
        html_output = ""
        if pipeline.formatting_id:
            fmt_lib = self.db.query(FormattingLibrary).get(pipeline.formatting_id)
            if fmt_lib:
                html_output = self._execute_formatting(fmt_lib, ai_content, context)
            
        # 4. Output (Output Config Library)
        # We should create a dummy report if we want to use the full execute logic, 
        # or just call execute_pipeline properly.
        # For simplicity in this 'run_pipeline' (often used for manual trigers),
        # let's call the full execute_pipeline which handles record creation.
        return await self.execute_pipeline(self.db, pipeline_id, user_id, run_type=run_type)

    async def execute_pipeline(self, db: Session, pipeline_id: str, user_id: str, run_type: str = "manual"):
        pipeline = db.query(ReportPipeline).filter(
            ReportPipeline.id == pipeline_id, 
            ReportPipeline.user_id == user_id
        ).first()
        
        if not pipeline:
            raise ValueError(f"Pipeline {pipeline_id} not found")
            
        context = PipelineContext(pipeline_id, user_id)
        context.pipeline_name = pipeline.name
        
        # Initialize Debug Logger
        debug_logger = PipelineDebugLogger(pipeline_id)
        context.update("debug", {"log_path": debug_logger.base_dir})

        # 1. Source
        articles = self._execute_source(pipeline.source_config, context)
        debug_logger.log_step("step_1_source_articles", [self._serialize_article(a) for a in articles], extension="json")
        
        # 2. Processing
        ai_content = {}
        if pipeline.prompt_id:
            prompt_lib = db.query(PromptLibrary).get(pipeline.prompt_id)
            if prompt_lib:
                ai_content = await self._execute_processing(prompt_lib, articles, context, debug_logger=debug_logger)
                debug_logger.log_step("step_2_ai_response_parsed", ai_content, extension="json")
            
        # 2.5 Formatting Config (Fetch early for citation style)
        citation_type = "numeric_superscript"
        formatting_params = {}
        fmt_lib = None
        if pipeline.formatting_id:
            fmt_lib = db.query(FormattingLibrary).get(pipeline.formatting_id)
            if fmt_lib:
                citation_type = getattr(fmt_lib, "citation_type", "numeric_superscript") or "numeric_superscript"
                # Check for parameters attribute
                formatting_params = getattr(fmt_lib, "parameters", {}) or {}
                # Fallback to empty dict if it's None or missing
                if not isinstance(formatting_params, dict):
                    formatting_params = {}

        # 2.6 Post-Processing (Reconciliation & Citation Formatting)
        if ai_content and articles:
            ai_content = self._post_process_report_content(
                ai_content, articles, context, 
                citation_type=citation_type, 
                formatting_params=formatting_params
            )
        
        # 3. Formatting
        html_output = ""
        if fmt_lib:
            html_output = self._execute_formatting(fmt_lib, ai_content, context)
            debug_logger.log_step("step_3_formatting_html", html_output, extension="html")
        
        # --- Create Report Record (Before Output/Delivery) ---
        report = Report(
            user_id=user_id,
            title=ai_content.get("title", f"Report {datetime.now().date()}"),
            configuration=pipeline.source_config,
            content=html_output, # Store the formatted HTML
            status="processing",
            meta_prompt=json.dumps(context.get("step_2_processing")),
            created_at=datetime.now(timezone.utc),
            # Archive Metadata
            pipeline_id=pipeline_id,
            run_type=run_type,
            article_ids=[a.id for a in articles]
        )
        db.add(report)
        db.commit()
        db.refresh(report) # Get ID
        
        # 4. Output
        final_file_path = None
        if pipeline.output_config_id:
            out_lib = db.query(OutputConfigLibrary).get(pipeline.output_config_id)
            if out_lib:
                # Pass report and articles
                final_file_path = await self._execute_output(out_lib, report, articles, context)
        
        # 5. Delivery
        if pipeline.delivery_config_id:
            del_lib = db.query(DeliveryConfigLibrary).get(pipeline.delivery_config_id)
            if del_lib:
                # Pass report and articles
                await self._execute_delivery(del_lib, report, articles, final_file_path, context)
        
        # Update Report Status
        report.status = "completed"
        db.commit()
        
        context.update("final", {"report_id": report.id})
        return context.to_dict()

    async def export_pipeline_config(self, pipeline_id: str, user_id: str) -> Dict[str, Any]:
        """
        Exports a pipeline's full configuration, including all library items and Source Templates.
        As per requirements, it DOES NOT save specific source IDs, only the template/filters.
        """
        pipeline = self.db.query(ReportPipeline).filter(
            ReportPipeline.id == pipeline_id, 
            ReportPipeline.user_id == user_id
        ).first()

        if not pipeline:
            raise ValueError("Pipeline not found")

        # 1. Base Pipeline Config
        source_config = (pipeline.source_config or {}).copy()
        
        # CRITICAL: Strip specific source_ids to ensure portability and dynamic filtering
        if "source_ids" in source_config:
            del source_config["source_ids"]

        config = {
            "version": "1.0",
            "name": pipeline.name,
            "description": pipeline.description,
            "source_config": source_config,
            "steps": {}
        }

        # 2. Source Template Library (if used)
        template_id = source_config.get("template_id")
        if template_id:
            st = self.db.query(SourceConfigLibrary).get(template_id)
            if st:
                st_config = (st.config or {}).copy()
                if "source_ids" in st_config:
                    del st_config["source_ids"]
                    
                config["source_template"] = {
                    "name": st.name,
                    "description": st.description,
                    "config": st_config
                }

        # 3. Prompt Library
        if pipeline.prompt_id:
            p = self.db.query(PromptLibrary).get(pipeline.prompt_id)
            if p:
                config["steps"]["prompt"] = {
                    "name": p.name,
                    "description": p.description,
                    "prompt_text": p.prompt_text,
                    "model": p.model
                }

        # 4. Formatting Library
        if pipeline.formatting_id:
            f = self.db.query(FormattingLibrary).get(pipeline.formatting_id)
            if f:
                config["steps"]["formatting"] = {
                    "name": f.name,
                    "description": f.description,
                    "structure_definition": f.structure_definition,
                    "css": f.css,
                    "citation_type": f.citation_type,
                    "parameters": f.parameters
                }

        # 5. Output Library
        if pipeline.output_config_id:
            o = self.db.query(OutputConfigLibrary).get(pipeline.output_config_id)
            if o:
                config["steps"]["output"] = {
                    "name": o.name,
                    "converter_type": o.converter_type,
                    "parameters": o.parameters
                }

        # 6. Delivery Library
        if pipeline.delivery_config_id:
            d = self.db.query(DeliveryConfigLibrary).get(pipeline.delivery_config_id)
            if d:
                config["steps"]["delivery"] = {
                    "name": d.name,
                    "delivery_type": d.delivery_type,
                    "parameters": d.parameters
                }

        return config

    async def import_pipeline_config(self, config_data: Dict[str, Any], user_id: str) -> ReportPipeline:
        """
        Imports a pipeline configuration, recreating library items and source templates.
        """
        # 1. Handle Source Template
        source_config = config_data.get("source_config", {})
        source_template_data = config_data.get("source_template")
        
        if source_template_data:
            st = SourceConfigLibrary(
                user_id=user_id,
                name=f"{source_template_data['name']} (Imported)",
                description=source_template_data.get("description"),
                config=source_template_data["config"]
            )
            self.db.add(st)
            self.db.flush()
            # Update the template_id in the pipeline's inline config
            source_config["template_id"] = st.id

        # 2. Create Library Items (Always create new ones for isolation)
        steps = config_data.get("steps", {})
        
        prompt_id = None
        if "prompt" in steps:
            p_data = steps["prompt"]
            prompt = PromptLibrary(
                user_id=user_id,
                name=f"{p_data['name']} (Imported)",
                description=p_data.get("description"),
                prompt_text=p_data["prompt_text"],
                model=p_data.get("model", "gemini-2.0-flash-lite")
            )
            self.db.add(prompt)
            self.db.flush()
            prompt_id = prompt.id

        formatting_id = None
        if "formatting" in steps:
            f_data = steps["formatting"]
            formatting = FormattingLibrary(
                user_id=user_id,
                name=f"{f_data['name']} (Imported)",
                description=f_data.get("description"),
                structure_definition=f_data["structure_definition"],
                css=f_data.get("css"),
                citation_type=f_data.get("citation_type"),
                parameters=f_data.get("parameters", {})
            )
            self.db.add(formatting)
            self.db.flush()
            formatting_id = formatting.id

        output_id = None
        if "output" in steps:
            o_data = steps["output"]
            output = OutputConfigLibrary(
                user_id=user_id,
                name=f"{o_data['name']} (Imported)",
                converter_type=o_data["converter_type"],
                parameters=o_data.get("parameters", {})
            )
            self.db.add(output)
            self.db.flush()
            output_id = output.id

        delivery_id = None
        if "delivery" in steps:
            d_data = steps["delivery"]
            delivery = DeliveryConfigLibrary(
                user_id=user_id,
                name=f"{d_data['name']} (Imported)",
                delivery_type=d_data["delivery_type"],
                parameters=d_data.get("parameters", {})
            )
            self.db.add(delivery)
            self.db.flush()
            delivery_id = delivery.id

        # 3. Create Pipeline
        new_pipeline = ReportPipeline(
            user_id=user_id,
            name=f"{config_data['name']} (Imported)",
            description=config_data.get("description"),
            source_config=source_config,
            prompt_id=prompt_id,
            formatting_id=formatting_id,
            output_config_id=output_id,
            delivery_config_id=delivery_id,
            schedule_enabled=False # Always disable automation on import for safety
        )
        self.db.add(new_pipeline)
        self.db.commit()
        self.db.refresh(new_pipeline)

        return new_pipeline

    def _execute_source(self, config: Dict[str, Any], context: PipelineContext) -> List[Article]:
        from datetime import datetime, timedelta
        from sqlalchemy import or_
        limit = config.get("limit")
        sort_by = config.get("sort", "published_at")
        filter_date = config.get("filter_date")
        
        # New Filters
        source_ids = config.get("source_ids") # List[str]
        story_status = config.get("story_status")
        min_relevance = config.get("min_relevance")
        search = config.get("search")
        sentiment = config.get("sentiment")
        tags = config.get("tags") # List[str]
        entities = config.get("entities") # List[str]
        
        query = self.db.query(Article).join(Source).filter(Source.user_id == context.user_id)
        
        # Date Filter
        if filter_date:
            start_date = None
            # Use aware UTC time to match models.py UTCDateTime
            now = datetime.now(timezone.utc)
            if filter_date == "24h":
                start_date = now - timedelta(hours=24)
            elif filter_date == "48h":
                start_date = now - timedelta(hours=48)
            elif filter_date == "7d":
                start_date = now - timedelta(days=7)
            elif filter_date == "30d":
                start_date = now - timedelta(days=30)
            
            if start_date:
                query = query.filter(Article.published_at >= start_date)
                context.update("step_1_source", {"start_date": start_date.isoformat()})
                
        # Source Filter
        if source_ids:
            query = query.filter(Article.source_id.in_(source_ids))
            
        # Story Status Filter
        if story_status == 'orphaned':
            query = query.filter(Article.story_id == None)
        elif story_status == 'connected':
            query = query.filter(Article.story_id != None)
            
        # Min Relevance Filter
        if min_relevance:
            query = query.filter(Article.relevance_score >= int(min_relevance))
            
        # Sentiment Filter
        if sentiment:
            query = query.filter(Article.sentiment == sentiment)
            
        # Search Filter
        if search:
            search_filter = f"%{search}%"
            query = query.filter(or_(
                Article.raw_title.ilike(search_filter),
                Article.translated_title.ilike(search_filter),
                Article.ai_summary.ilike(search_filter),
                Article.content_snippet.ilike(search_filter)
            ))
            
        # Tags Filter
        if tags:
            for tag in tags:
                 # Use GLOB for strict case-sensitive matching in SQLite
                 # Matches exact string including characters like _
                 query = query.filter(Article.tags.op('GLOB')(f"*{tag}*"))
        
        # Entities Filter
        if entities:
            for entity in entities:
                 # Use GLOB for strict case-sensitive matching
                 query = query.filter(Article.entities.op('GLOB')(f"*{entity}*"))

        # Apply Sort
        if sort_by == 'relevance':
            query = query.order_by(Article.relevance_score.desc())
        else:
            # Default to published_at desc, matching main.py
            query = query.order_by(Article.published_at.desc())
            
        # Execute
        if limit and int(limit) > 0:
            query = query.limit(int(limit))
        articles = query.all()
        
        context.update("step_1_source", {
            "count": len(articles), 
            "article_ids": [a.id for a in articles]
        })
        return articles

    def _serialize_article(self, article: Article) -> Dict[str, Any]:
        """Helper to serialize article for AI context"""
        return {
            "id": article.id,
            "title": article.raw_title,
            "translated_title": article.translated_title,
            "url": article.url,
            "content": article.content_snippet,
            "ai_summary": article.ai_summary,
            "published_at": article.published_at.isoformat() if article.published_at else None,
            "source": article.source.name if article.source else "Unknown",
            "sentiment": article.sentiment,
            "relevance": article.relevance_score,
            "tags": article.tags,
            "entities": article.entities
        }

    async def _execute_processing(self, prompt_lib: PromptLibrary, articles: List[Article], context: PipelineContext, debug_logger: Any = None) -> Dict[str, Any]:
        """
        Uses AI Service to generating report content from articles.
        """
        if not articles:
            return {"title": "No Articles Found", "summary": "No articles matched the criteria.", "sections": []}

        # 1. Prepare Data Context
        serialized_articles = [self._serialize_article(a) for a in articles]
        articles_json = json.dumps(serialized_articles, indent=2)
        
        # Helper for legacy plain text format
        articles_text = ""
        for i, art in enumerate(articles):
            articles_text += f"\n[Article {i+1}] (ID: {art.id}) {art.raw_title}\n{art.ai_summary or art.content_snippet or ''}\n"

        template_context = {
            "articles": serialized_articles, # For {% for a in articles %}
            "articles_json": articles_json,   # For {{ articles_json }}
            "articles_text": articles_text,   # For {{ articles_text }}
            "date": datetime.now().strftime("%Y-%m-%d"),
            "time": datetime.now().strftime("%H:%M"),
            "current_time": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "current_date": datetime.now().strftime("%Y-%m-%d")
        }

        # 2. Render System Prompt (User Variables)
        system_prompt_template = prompt_lib.prompt_text
        try:
            # Use Jinja2 to render the prompt
            # This replaces {{ variable }} with actual values
            rendered_prompt = Template(system_prompt_template).render(**template_context)
        except Exception as e:
            logger.error(f"Failed to render prompt template: {e}")
            rendered_prompt = system_prompt_template # Fallback to raw text
            
        combined_prompt = rendered_prompt

        # 3. Auto-Inject Articles if not explicitly used
        import re
        # Check if 'articles', 'articles_json', or 'articles_text' is used inside {{ }} or {% %}
        has_variable = re.search(r"(\{\{|\{%)\s*.*(articles|articles_json|articles_text).*(\}\}|\%\})", system_prompt_template, re.DOTALL)
        
        if not has_variable:
            combined_prompt += f"\n\nHere is the data context for your analysis (JSON Format):\n{articles_json}"

        try:
            # Fetch user for their specific API key
            user = self.db.query(User).get(context.user_id)
            user_api_key = user.google_api_key if user else None
            
            ai_service = AIService(api_key=user_api_key)
            
            # STORE DEBUG INFO
            context.update("step_2_processing", { "debug_prompt": combined_prompt })
            logger.info(f"DEBUG: Saved prompt to context. Length: {len(combined_prompt)} chars")
            
            # Use model from library if available, otherwise default
            model_to_use = prompt_lib.model if prompt_lib.model else "gemini-2.0-flash-lite-preview-02-05"

            response_text = await ai_service.call(
                model_name=model_to_use, 
                prompt=combined_prompt,
                debug_logger=debug_logger
            )
            
            context.update("step_2_processing", { "debug_raw_response": response_text })
            
            # AI response might be empty
            if not response_text:
                raise ValueError("AI returned an empty response")

            # Simple JSON cleanup if needed
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                 response_text = response_text.split("```")[1].split("```")[0].strip()
                 
            # Robust JSON parsing
            def robust_json_load(text):
                try:
                    return json.loads(text)
                except json.JSONDecodeError as e:
                    import re
                    # 1. Handle invalid unicode escapes \uXXXX
                    # If we have \u and NOT followed by 4 hex digits, escape the \
                    text = re.sub(r'\\u(?![0-9a-fA-F]{4})', r'\\\\u', text)
                    
                    # 2. Try again
                    try:
                        return json.loads(text, strict=False)
                    except json.JSONDecodeError:
                        # 3. Last ditch: try to fix common AI JSON artifacts (trailing commas, etc)
                        text = re.sub(r',\s*([\]}])', r'\1', text) 
                        return json.loads(text, strict=False)

            result = robust_json_load(response_text)
            context.update("step_2_processing", { "ai_response": result })
            return result
        except Exception as e:
            logger.error(f"AI Processing failed: {e}")
            # Return error structure
            return {
                "title": "Error Generating Report",
                "summary": f"An error occurred: {str(e)}",
                "sections": [],
                "error": str(e)
            }

    def _post_process_report_content(self, ai_content: Dict[str, Any], articles_db: List[Article], context: PipelineContext, citation_type: str = "numeric_superscript", formatting_params: Dict = None) -> Dict[str, Any]:
        """
        Reconciles references with DB ground truth and reformats citations into structural groups.
        This version is FULLY recursive to catch citations in any list or nested dictionary.
        """
        import re
        import markdown
        params = formatting_params or {}
        group_citations = params.get("group_citations", True)
        if citation_type == "user_defined":
            group_citations = False
            
        leave_space = params.get("leave_space", False)
        
        # 1. Build ground truth map
        db_map = {str(a.id): a for a in articles_db}
        # Build index map (1-based) to support LLMs citing by provided list index
        index_map = {str(i + 1): str(a.id) for i, a in enumerate(articles_db)}
        # Build source name map (lowercase) for fallback matching
        source_map = {}
        for a in articles_db:
            s_name = a.source.name if a.source else (a.source_name_backup or None)
            ref_name = a.source.reference_name if a.source else None
            if s_name:
                source_map[s_name.lower().strip()] = str(a.id)
            if ref_name:
                source_map[ref_name.lower().strip()] = str(a.id)
        
        citation_mapping = {} # article_id -> number/label
        next_number = 1
        reconciled_references = []

        def get_or_assign_number(aid):
            nonlocal next_number
            aid = str(aid).strip()
            # 1. Map index to UUID if it's a short numeric reference
            if aid in index_map:
                aid = index_map[aid]
            # 2. Map source name to UUID if the AI cited by source instead of ID
            elif aid.lower() in source_map:
                aid = source_map[aid.lower()]
                
            if aid not in citation_mapping:
                if aid in db_map:
                    citation_mapping[aid] = next_number
                    next_number += 1
                    # Add to reconciled references in the order they first appear
                    art = db_map[aid]
                    actual_name = art.source.name if art.source else (art.source_name_backup or "Unknown Source")
                    ref_name = art.source.reference_name if art.source and art.source.reference_name else actual_name
                    
                    # Determine the 'citation' field value based on style
                    citation_label = str(citation_mapping[aid])
                    if citation_type in ['inline_source_link', 'source_bracket']:
                        citation_label = ref_name

                    ref_obj = {
                        "id": aid,
                        "number": citation_mapping[aid],
                        "title": art.translated_title or art.raw_title,
                        "url": art.url,
                        "source_name": actual_name,
                        "citation": citation_label
                    }
                    reconciled_references.append(ref_obj)
                    return citation_mapping[aid], aid
                return None, None
            return citation_mapping[aid], aid

        def process_text(text):
            if not text or not isinstance(text, str): return text
            
            # 1. Flatten any existing CITE_GROUP tags back to individual REF tags to allow re-processing
            # This is critical for idempotency and when formatting settings change in Step 3
            def flatten_cite_group(match):
                ids = match.group(1).split(',')
                return "".join([f"[[REF:{i.strip()}]]" for i in ids if i.strip()])
            
            text = re.sub(r'\[\[CITE_GROUP:([^\]]+)\]\]', flatten_cite_group, text)

            # Find all citations: [[REF:ID]] or [[CITATION:ID]] or [REF:ID]
            # Permissive regex to catch IDs with underscores, dots, or spaces
            pattern = r'\[{1,2}(?:REF|CITATION|CITE|CIT):?\s*([a-zA-Z0-9\-\._\s]+)\s*\]{1,2}'
            
            def replace_single(match):
                aid = match.group(1).strip()
                num, resolved_id = get_or_assign_number(aid)
                if num:
                    return f"[[CITE_GROUP:{resolved_id}]]"
                return "" # Delete invalid citations

            if not group_citations:
                # If not grouping, just replace each tag one-by-one to preserve separators/spaces between them
                # But we still need to handle leave_space if there's no space before them
                if leave_space:
                    # Look for [non-whitespace][[REF:ID]] and insert space
                    # This is a bit tricky with re.sub, so we'll do it in two passes
                    processed = re.sub(pattern, replace_single, text)
                    # Insert space between word and CITE_GROUP if missing
                    processed = re.sub(r'([^\s\t\n])(\[\[CITE_GROUP:)', r'\1 \2', processed)
                    return processed
                return re.sub(pattern, replace_single, text)

            def replace_group(match_full):
                # match_full is a contiguous block of citations
                ids = re.findall(pattern, match_full)
                valid_ids = []
                seen = set()
                for aid in ids:
                    num, res_id = get_or_assign_number(aid)
                    if num and res_id not in seen:
                        valid_ids.append(res_id)
                        seen.add(res_id)
                
                if not valid_ids:
                    return ""
                
                return f"[[CITE_GROUP:{','.join(valid_ids)}]]"

            # Match contiguous citation tags with potential leading whitespace and separators
            # This is ONLY used if group_citations is True
            contiguous_pattern = r'([ \t]*)((?:\[{1,2}(?:REF|CITATION|CITE|CIT):?\s*[a-zA-Z0-9\-\._\s]+\s*\]{1,2}[,; \t]*)*(?:\[{1,2}(?:REF|CITATION|CITE|CIT):?\s*[a-zA-Z0-9\-\._\s]+\s*\]{1,2}))'
            
            def sub_handler(match):
                leading_ws = match.group(1)
                citation_block = match.group(2)
                
                # If there was any leading whitespace, preserve exactly one space if leave_space is True
                prefix = " " if leave_space else ""
                
                group_tag = replace_group(citation_block)
                if not group_tag:
                    return leading_ws if leave_space else ""
                
                return prefix + group_tag

            processed = re.sub(contiguous_pattern, sub_handler, text)
            
            # Convert Markdown to HTML to preserve paragraphs and formatting
            # This ensures \n\n becomes <p> tags, which is more robust when wrapped in HTML templates
            try:
                processed = markdown.markdown(processed, extensions=['extra', 'sane_lists'])
            except Exception as md_ex:
                logger.warning(f"Markdown conversion failed: {md_ex}")
            
            return processed

        def traverse(node):
            """
            Fully recursive traversal through dicts and lists.
            """
            if isinstance(node, dict):
                for key, value in node.items():
                    if isinstance(value, str):
                        node[key] = process_text(value)
                    else:
                        traverse(value)
            elif isinstance(node, list):
                for i in range(len(node)):
                    if isinstance(node[i], str):
                        node[i] = process_text(node[i])
                    else:
                        traverse(node[i])

        # Process the content recursively
        traverse(ai_content)
        
        # Group references by source for templates
        references_by_source = {}
        source_mapping = {} # article_id -> source_name
        for ref in reconciled_references:
            s_name = ref["source_name"]
            source_mapping[ref["id"]] = s_name
            if s_name not in references_by_source:
                references_by_source[s_name] = []
            references_by_source[s_name].append(ref)

        # Override the AI's reference list with our ordered, reconciled list
        ai_content["references"] = reconciled_references
        
        # Helper map for quick lookup in formatting
        ai_content["id_to_citation"] = {ref["id"]: ref["citation"] for ref in reconciled_references}

        # Keep legacy mappings for now to avoid breaking existing logic
        ai_content["references_by_source"] = references_by_source
        ai_content["citation_mapping"] = citation_mapping
        ai_content["source_mapping"] = source_mapping
        
        context.update("post_processing", {
            "citation_count": len(reconciled_references),
            "mapping": citation_mapping,
            "source_count": len(references_by_source)
        })
        
        return ai_content

    def _execute_formatting(self, fmt_lib: FormattingLibrary, ai_content: Dict[str, Any], context: PipelineContext) -> str:
        """
        Applies Jinja2 template and citations style based on fmt_lib.citation_type.
        """
        import re
        template_str = fmt_lib.structure_definition
        css = fmt_lib.css or ""
        citation_type = getattr(fmt_lib, 'citation_type', 'numeric_superscript') or 'numeric_superscript'
        
        try:
            # Prepare render context
            # We pass the FULL ai_content to the template to allow for flexible fields like 'key_findings'
            render_ctx = ai_content.copy() if ai_content else {}
            
            if "pipeline" not in render_ctx:
                render_ctx["pipeline"] = context.pipeline_name or "Unknown"
            if "date" not in render_ctx:
                render_ctx["date"] = datetime.now().strftime("%Y-%m-%d")
            
            # Common aliases
            render_ctx["current_date"] = render_ctx.get("date")
            render_ctx["current_time"] = datetime.now().strftime("%H:%M")
            render_ctx["pipeline_name"] = context.pipeline_name
                
            template = Template(template_str)
            html_body = template.render(**render_ctx)
            
            # Post-render replacement of Citation Groups
            
            def flexible_renderer(match):
                ids = match.group(1).split(',')
                params = getattr(fmt_lib, 'parameters', {}) or {}
                
                # Defaults
                display_style = params.get("display_style", "superscript") # superscript, regular
                enclosure = params.get("enclosure", "square_brackets") # none, parenthesis, square_brackets, curly_braces
                link_target = params.get("link_target", "external") # internal, external
                
                # Enclosure Mappings
                enclosures = {
                    "none": ("", ""),
                    "parenthesis": ("(", ")"),
                    "square_brackets": ("[", "]"),
                    "curly_braces": ("{", "}")
                }
                enc_start, enc_end = enclosures.get(enclosure, ("[", "]"))
                
                # Style Mappings
                if citation_type == "user_defined":
                    # User-defined citations use a customizable HTML template with placeholders
                    rendered_links = []
                    id_to_cite = ai_content.get("id_to_citation", {})
                    id_to_url = {ref["id"]: ref["url"] for ref in ai_content.get("references", [])}
                    
                    # Custom template from params or default
                    custom_template = params.get("citation_template") or '<span class="cite"><a href="{{ url }}" {{ target }}>{{ label }}</a></span>'
                    
                    for aid in ids:
                        cite = id_to_cite.get(aid)
                        url = id_to_url.get(aid, "#")
                        if cite:
                            href = f"#ref-{aid}" if link_target == "internal" else url
                            target_attr = 'target="_blank"' if link_target == "external" else ""
                            
                            # Replace placeholders
                            link_html = custom_template.replace("{{ label }}", str(cite))
                            link_html = link_html.replace("{{ url }}", href)
                            link_html = link_html.replace("{{ target }}", target_attr)
                            
                            rendered_links.append(link_html)
                    
                    return ", ".join(rendered_links)

                # Standard Rendering (Superscript/Regular)
                # Match the preview: color the whole span if it's a link-style citation
                color_attr = "color: #2563eb;" if citation_type != 'none' else ""
                
                if display_style == "superscript":
                    span_style = f"vertical-align: super; font-size: 0.75rem; font-weight: 600; {color_attr}"
                else:
                    span_style = f"font-size: 0.9em; font-weight: 600; margin-left: 2px; {color_attr}"
                
                # Links
                id_to_cite = ai_content.get("id_to_citation", {})
                id_to_url = {ref["id"]: ref["url"] for ref in ai_content.get("references", [])}
                
                rendered_links = []
                for aid in ids:
                    cite = id_to_cite.get(aid)
                    url = id_to_url.get(aid, "#")
                    if cite:
                        href = f"#ref-{aid}" if link_target == "internal" else url
                        target = ' target="_blank"' if link_target == "external" else ""
                        rendered_links.append(f'<a href="{href}"{target} style="text-decoration: none; color: #2563eb;">{cite}</a>')
                
                if not rendered_links: return ""
                
                # Construct result
                content = ", ".join(rendered_links)
                return f'<span style="{span_style}">{enc_start}{content}{enc_end}</span>'

            def replace_cite_none(match):
                return "" # Strip citations

            # Registry of citation renderers
            renderers = {
                'numeric_superscript': flexible_renderer,
                'inline_source_link': flexible_renderer,
                'source_bracket': flexible_renderer,
                'none': replace_cite_none
            }

            # Dispatch based on type
            renderer = renderers.get(citation_type, flexible_renderer)
            html_body = re.sub(r'\[\[CITE_GROUP:([^\]]+)\]\]', renderer, html_body)
            
            # Wrap in full HTML
            full_html = f"""
            <html>
            <head>
                <style>
                    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }}
                    {css}
                </style>
            </head>
            <body>
                {html_body}
            </body>
            </html>
            """
            
            context.update("step_3_formatting", { "html_length": len(full_html), "citation_type": citation_type })
            return full_html
        except Exception as e:
            logger.error(f"Formatting failed: {e}")
            return f"<h1>Formatting Error</h1><p>{str(e)}</p>"

    def _slugify(self, text: str) -> str:
        """
        Relaxed slugification for filenames: preserves case and spaces, 
        strips only path separators and truly unsafe characters.
        """
        import re
        import unicodedata
        
        # Normalize to ASCII-compatible characters where possible
        text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('ascii')
        
        # Replace strictly unsafe filesystem characters: / \ : * ? " < > |
        # We replace them with a hyphen or remove them to prevent path traversal or OS errors
        text = re.sub(r'[\\/\\:\\*\\?"<>\\|]', '-', text)
        
        # Collapse multiple spaces or hyphens (optional, but good for readability) - treating newlines as spaces
        text = re.sub(r'[\r\n]+', ' ', text)
        
        # Strip leading/trailing whitespace
        return text.strip()

    async def _execute_output(self, out_lib: OutputConfigLibrary, report: Report, articles: List[Article], context: PipelineContext) -> str:
        """
        Converts the formatted report into the target output format (PDF, HTML, etc.)
        """
        logger.info(f"Executing Output Step: {out_lib.name} ({out_lib.converter_type})")
        
        output_dir = "/tmp/reports"
        os.makedirs(output_dir, exist_ok=True)
        
        # Determine Filename
        params = out_lib.parameters or {}
        filename_template = params.get("filename_template")
        filename = f"report_{report.id}" # Default
        
        if filename_template:
            try:
                from jinja2 import Template
                tpl = Template(filename_template)
                
                # DEBUG LOGGING
                import logging
                pl_name = getattr(context, 'pipeline_name', None)
                logger.info(f"Filename Render Context | Pipeline Name (attr): {pl_name} | Context Keys: {context.state.keys() if hasattr(context, 'state') else 'No State'} | Report Title: {report.title}")
                
                rendered = tpl.render(
                    date=datetime.now().strftime("%Y-%m-%d"),
                    time=datetime.now().strftime("%H-%M"),
                    title=report.title or "Untitled",
                    pipeline=getattr(context, 'pipeline_name', 'Unknown') or "Unknown"
                )
                filename = self._slugify(rendered)
            except Exception as e:
                logger.error(f"Filename template rendering failed: {e}")
        
        if out_lib.converter_type == 'PDF':
             from pdf_service import generate_pdf
             try:
                 # generate_pdf should ideally be sync if it uses library like reportlab or playwright sync
                 # but for safety in a pipeline we can wrap it or make it async
                 pdf_bytes = generate_pdf(report, articles)
                 file_path = f"{output_dir}/{filename}.pdf"
                 with open(file_path, "wb") as f:
                     f.write(pdf_bytes)
                 context.update("step_4_output", { "file_path": file_path, "type": "pdf" })
                 return file_path
             except Exception as e:
                 logger.error(f"PDF Output failed: {e}")
                 context.update("step_4_output", { "error": str(e) })
                 return None
                 
        elif out_lib.converter_type == 'HTML':
             file_path = f"{output_dir}/{filename}.html"
             with open(file_path, 'w') as f:
                 f.write(report.content or "")
             context.update("step_4_output", { "file_path": file_path, "type": "html" })
             return file_path
             
        return None

    async def _execute_delivery(self, del_lib: DeliveryConfigLibrary, report: Report, articles: List[Article], file_path: str, context: PipelineContext):
        logger.info(f"Executing Delivery Step: {del_lib.name} ({del_lib.delivery_type})")
        
        params = del_lib.parameters or {}
        recipients = params.get("recipients", [])
        if isinstance(recipients, str): recipients = [recipients]

        # Delivery Logic
        result = None
        status = "success"
        error_msg = None
        
        try:
            if del_lib.delivery_type == 'EMAIL':
                # Fetch SystemConfig for the user
                sys_config = self.db.query(SystemConfig).filter(SystemConfig.user_id == report.user_id).first()
                sys_config_map = {}
                if sys_config:
                    sys_config_map = {
                        # Host/Port/User/Pass removed - SMTP Disabled
                        "smtp_from_email": sys_config.smtp_from_email,
                        "smtp_sender_name": sys_config.smtp_sender_name,
                        "smtp_reply_to": sys_config.smtp_reply_to,
                        "resend_api_key": sys_config.resend_api_key
                    }

                final_config = sys_config_map.copy()
                if params:
                    final_config.update(params)

                # Handle custom subject template
                custom_subject = None
                subject_template = params.get("subject")
                if subject_template:
                    try:
                        from jinja2 import Template
                        tpl = Template(subject_template)
                        custom_subject = tpl.render(
                            date=datetime.now().strftime("%Y-%m-%d"),
                            time=datetime.now().strftime("%H:%M"),
                            title=report.title,
                            pipeline=getattr(context, 'pipeline_name', 'Unknown') or "Unknown",
                            pipeline_name=getattr(context, 'pipeline_name', 'Unknown') or "Unknown"
                        )
                    except Exception as e:
                        logger.error(f"Failed to render subject template: {e}")

                for email in recipients:
                     send_report_email(email, report, articles, config=final_config, subject=custom_subject, attachment_path=file_path)
            
            elif del_lib.delivery_type == 'TELEGRAM':
                # Placeholder
                pass
                
        except Exception as e:
            status = "failed"
            error_msg = str(e)
            logger.error(f"Delivery failed: {e}")

        # Extract extra details for logging
        sent_subject = "Reports Notification" # Default
        sent_cc = []
        sent_bcc = []
        
        if del_lib.delivery_type == 'EMAIL':
             # Re-extract these for logging purposes since they might have been merged
             # We rely on final_config logic above
             sys_config = self.db.query(SystemConfig).filter(SystemConfig.user_id == report.user_id).first()
             sys_config_map = {}
             # ... simplified re-fetch or just assume 'final_config' is available in scope if success, 
             # but if exception happened early it might not be.
             # Safest is to use local vars if defined
             try:
                 if 'custom_subject' in locals() and custom_subject:
                     sent_subject = custom_subject
                 elif 'final_config' in locals() and final_config.get('subject'):
                      # This is unlikely to happen if custom_subject failed but let's be safe
                      sent_subject = final_config.get('subject')
                 elif 'report' in locals():
                      sent_subject = f"Report: {report.title}"

                 if 'final_config' in locals():
                     cc_raw = final_config.get("cc") or final_config.get("CC")
                     if cc_raw:
                        if isinstance(cc_raw, str): sent_cc = [e.strip() for e in cc_raw.split(',') if e.strip()]
                        elif isinstance(cc_raw, list): sent_cc = cc_raw
                        
                     bcc_raw = final_config.get("bcc") or final_config.get("BCC")
                     if bcc_raw:
                        if isinstance(bcc_raw, str): sent_bcc = [e.strip() for e in bcc_raw.split(',') if e.strip()]
                        elif isinstance(bcc_raw, list): sent_bcc = bcc_raw
             except:
                 pass

        # Append to Delivery Log
        log_entry = {
            "channel": del_lib.delivery_type,
            "config": params,
            "status": status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "error": error_msg,
            # Enhanced details
            "subject": sent_subject,
            "recipients": recipients,
            "cc": sent_cc,
            "bcc": sent_bcc
        }
        
        # Ensure it's a list (SQLite JSON)
        current_log = report.delivery_log or []
        if isinstance(current_log, str): current_log = []
        
        new_log = list(current_log)
        new_log.append(log_entry)
        
        report.delivery_log = new_log
        self.db.commit()

        context.update("step_5_delivery", { "status": status, "log": log_entry })
        return { "status": status, "log": log_entry }


    async def test_step(self, step_number: int, input_context: Dict, step_config_id: Optional[str] = None, user_id: str = None, force_refresh: bool = False):
        """
        Executes a single step in isolation for testing purposes, with caching.
        """
        from models import PipelineTestCache
        import hashlib
        
        # 0. Build config for hashing
        hash_payload = {
            "step_number": step_number,
            "input_context": input_context,
            "step_config_id": step_config_id
        }
        
        # If it's a library item, we should include its content in the hash
        # so that when the library item changes, the hash changes.
        if step_number == 2 and step_config_id:
            prompt_lib = self.db.query(PromptLibrary).get(step_config_id)
            if prompt_lib:
                hash_payload["prompt_text"] = prompt_lib.prompt_text
        elif step_number == 3 and step_config_id:
            fmt_lib = self.db.query(FormattingLibrary).get(step_config_id)
            if fmt_lib:
                hash_payload["structure_definition"] = fmt_lib.structure_definition
                hash_payload["css"] = fmt_lib.css
        elif step_number == 4 and step_config_id:
            out_lib = self.db.query(OutputConfigLibrary).get(step_config_id)
            if out_lib:
                hash_payload["out_config"] = out_lib.parameters
        elif step_number == 5 and step_config_id:
            del_lib = self.db.query(DeliveryConfigLibrary).get(step_config_id)
            if del_lib:
                hash_payload["del_config"] = del_lib.parameters

        config_hash = hashlib.sha256(json.dumps(hash_payload, sort_keys=True).encode()).hexdigest()
        
        # 1. Check Cache
        if not force_refresh:
            cached = self.db.query(PipelineTestCache).filter(
                PipelineTestCache.user_id == user_id,
                PipelineTestCache.step_number == step_number,
                PipelineTestCache.config_hash == config_hash
            ).first()
            
            if cached:
                logger.info(f"Cache HIT for step {step_number}")
                return cached.result

        # 2. Execute Step
        logger.info(f"Cache MISS for step {step_number}. Executing...")
        result = await self._run_test_step_logic(step_number, input_context, step_config_id, user_id)
        
        # 2.5 Ensure result is JSON serializable for the database
        def to_json_serializable(obj):
            if isinstance(obj, list):
                return [to_json_serializable(item) for item in obj]
            if isinstance(obj, dict):
                return {k: to_json_serializable(v) for k, v in obj.items()}
            
            # Use Pydantic's own JSON serialization to handle datetimes, etc.
            if hasattr(obj, 'model_dump_json') and callable(getattr(obj, 'model_dump_json')):
                return json.loads(obj.model_dump_json())
            if hasattr(obj, 'json') and callable(getattr(obj, 'json')):
                return json.loads(obj.json())
                
            if isinstance(obj, datetime):
                # Ensure it's aware and UTC before outputting ISO
                if obj.tzinfo is None:
                    obj = obj.replace(tzinfo=timezone.utc)
                else:
                    obj = obj.astimezone(timezone.utc)
                return obj.isoformat().replace('+00:00', 'Z')
                
            return obj

        serializable_result = to_json_serializable(result)
        
        new_cache = PipelineTestCache(
            user_id=user_id,
            step_number=step_number,
            config_hash=config_hash,
            result=serializable_result
        )
        self.db.add(new_cache)
        self.db.commit()
        
        return result

    async def _run_test_step_logic(self, step_number: int, input_context: Dict, step_config_id: Optional[str] = None, user_id: str = None):
        # Create a debug logger for this test run
        run_timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        debug_logger = PipelineDebugLogger("TEST_PIPELINE", run_id=f"step_{step_number}_{run_timestamp}")

        if step_number == 1:
            # Test Source
            config = input_context
            articles = self._execute_source(config, PipelineContext("TEST", user_id or "unknown"))
            serialized = [self._serialize_article(a) for a in articles]
            debug_logger.log_step("step_1_source_articles", serialized, extension="json")
            return [ArticleResponse.from_orm(a) for a in articles]
            
        elif step_number == 2:
            # Test Processing
            if not step_config_id: raise ValueError("Prompt ID required")
            prompt_lib = self.db.query(PromptLibrary).get(step_config_id)
            if not prompt_lib: raise ValueError("Prompt not found")
            
            article_ids = input_context.get("article_ids", [])
            articles = self.db.query(Article).filter(Article.id.in_(article_ids)).all()
            mock_ctx = PipelineContext("TEST", user_id)
            mock_ctx.pipeline_name = input_context.get("pipeline_name")
            
            debug_logger.log_step("step_1_input_articles", [self._serialize_article(a) for a in articles], extension="json")
            
            ai_content = await self._execute_processing(prompt_lib, articles, mock_ctx, debug_logger=debug_logger)
            debug_logger.log_step("step_2_ai_response_parsed", ai_content, extension="json")
            
            # CRITICAL: Always post-process if articles are available
            if articles and ai_content:
                # Try to get citation style from input_context or default
                citation_type = input_context.get("citation_type")
                formatting_params = input_context.get("formatting_params", {})
                
                if not citation_type and input_context.get("formatting_id"):
                    fmt = self.db.query(FormattingLibrary).get(input_context.get("formatting_id"))
                    if fmt:
                        citation_type = getattr(fmt, "citation_type", "numeric_superscript")
                        if not formatting_params:
                            formatting_params = getattr(fmt, "parameters", {})
                
                ai_content = self._post_process_report_content(
                    ai_content, articles, mock_ctx, 
                    citation_type=citation_type or "numeric_superscript",
                    formatting_params=formatting_params
                )
            
            # INJECT DEBUG INFO for Frontend
            step2_state = mock_ctx.get("step_2_processing")
            if isinstance(ai_content, dict):
                ai_content["_debug_prompt"] = step2_state.get("debug_prompt")
                ai_content["_debug_raw_response"] = step2_state.get("debug_raw_response")
                
            return ai_content
            
        elif step_number == 3:
            # Test Formatting
            if not step_config_id: raise ValueError("Formatting ID required")
            fmt_lib = self.db.query(FormattingLibrary).get(step_config_id)
            if not fmt_lib: raise ValueError("Formatting Interface not found")
            
            mock_ctx = PipelineContext("TEST", user_id)
            mock_ctx.pipeline_name = input_context.get("pipeline_name")
            
            # If the user provides raw AI content (with REF tags) but no CITE_GROUPs,
            # and we have article_ids, we should attempt to post-process it first.
            article_ids = input_context.get("article_ids", [])
            
            # Fallback: Extract IDs from text if not provided in article_ids
            if not article_ids:
                import re
                txt = json.dumps(input_context)
                # Updated to catch both UUIDs and short numeric indices (1-3 digits) after REF/CITATION/etc
                # UUIDs: [a-zA-Z0-9-]{10,}
                # Indices: [0-9]{1,3}
                id_matches = re.findall(r'\[{1,2}(?:REF|CITATION|CITE|CIT|CITE_GROUP):?\s*([a-zA-Z0-9\-]{1,})', txt)
                
                flat_ids = []
                for match in id_matches:
                    if ',' in match:
                        flat_ids.extend([m.strip() for m in match.split(',')])
                    else:
                        flat_ids.append(match.strip())
                article_ids = list(set(flat_ids))
            
            if article_ids:
                articles = self.db.query(Article).filter(Article.id.in_(article_ids)).all()
                if articles:
                    input_context = self._post_process_report_content(
                        input_context, 
                        articles, 
                        mock_ctx, 
                        citation_type=getattr(fmt_lib, "citation_type", "numeric_superscript"),
                        formatting_params=getattr(fmt_lib, "parameters", {})
                    )

            html_result = self._execute_formatting(fmt_lib, input_context, mock_ctx)
            debug_logger.log_step("step_3_formatting_html", html_result, extension="html")
            return html_result
        
        elif step_number == 4:
            # Test Output
             if not step_config_id: raise ValueError("Output Config ID required")
             out_lib = self.db.query(OutputConfigLibrary).get(step_config_id)
             mock_ctx = PipelineContext("TEST", user_id)
             mock_ctx.pipeline_name = input_context.get("pipeline_name", "Test Pipeline") # Pass from frontend if available
             
             # Create a mock report for the output generator
             # Use the title passed from frontend (extracted from Step 2) or default
             r_title = input_context.get("report_title", "Test Report")
             mock_report = Report(id="TEST-REPORT", content=input_context.get("html_result", ""), title=r_title, created_at=datetime.now(timezone.utc))
             return await self._execute_output(out_lib, mock_report, [], mock_ctx)
             
        elif step_number == 5:
             # Test Delivery
             if not step_config_id: raise ValueError("Delivery Config ID required")
             del_lib = self.db.query(DeliveryConfigLibrary).get(step_config_id)
             mock_ctx = PipelineContext("TEST", user_id)
             mock_ctx.pipeline_name = input_context.get("pipeline_name", "Unknown Pipeline")
             
             mock_report = Report(
                id="TEST-REPORT", 
                user_id=user_id, 
                content=input_context.get("html", ""), 
                title=input_context.get("report_title", "Test Report"), 
                created_at=datetime.now(timezone.utc)
             )
             result = await self._execute_delivery(del_lib, mock_report, [], "mock_path", mock_ctx)
             return result  
            
        return {"error": "Step not implemented"}
