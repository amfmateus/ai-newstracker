import os
import json
import logging
from google import genai
from google.genai import types
from typing import Dict, Any
from dotenv import load_dotenv
from logger_config import setup_logger
import time

load_dotenv()

import unicodedata
import re

logger = setup_logger(__name__)

def normalize_metadata(values):
    """Normalize a list of strings to ALL_CAPS_UNDERSCORE without diacritics."""
    if not values or not isinstance(values, list):
        return []
    
    normalized = []
    for val in values:
        if not isinstance(val, str):
            continue
            
        # 1. Remove diacritics
        s = unicodedata.normalize('NFKD', val).encode('ascii', 'ignore').decode('ascii')
        # 2. To Upper
        s = s.upper()
        # 3. Replace spaces and non-alphanumeric (except underscores) with underscores
        s = re.sub(r'[^A-Z0-9_]', '_', s)
        # 4. Clean up double underscores
        s = re.sub(r'_+', '_', s).strip('_')
        
        if s:
            normalized.append(s)
            
    return list(set(normalized)) # Deduplicate

DEFAULT_ANALYSIS_PROMPT = """
        You are an expert news analyst. Analyze the following news article.
        
        Headline: {title}
        Text: {text}

        Tasks:
        1.  **Language**: Detect the language of the article key (e.g., 'en', 'es', 'pt').
        2.  **Cleaning**: Clean the original article text. Remove HTML tags, advertisements, "read more" links, and UI artifacts. Keep only the core journalistic content in the original language.
        3.  **Translation**: 
            - Translate the Headline to English.
            - Translate the Cleaned Text to English.
        4.  **Relevance**: Determine if this article is relevant to "{topic_focus}". (true/false) & Score (0-100).
        5.  **Tags**: Extract key Tags (max 5) in BOTH English and Original Language. Format: ALL CAPS, no diacritics, use underscores for spaces (e.g., "MARKET_INDEX").
        6.  **Entities**: Extract key Named Entities in BOTH English and Original Language. Format: ALL CAPS, no diacritics, use underscores for spaces (e.g., "WORLD_BANK").
        7.  **Sentiment**: Determine Sentiment (positive, neutral, negative).
        8.  **Executive Summary**: Generate a "One-Sentence Executive Summary" in BOTH English and Original Language.

        Return ONLY raw valid JSON (no markdown formatting) with the following structure:
        {{
            "language": "pt",
            "cleaned_text_original": "...",
            "translated_title": "...",
            "translated_text": "...",
            "is_relevant": true,
            "relevance_score": 85,
            "tags_en": ["Economy", "Inflation"],
            "tags_original": ["Economia", "Inflação"],
            "entities_en": ["Bank of England"],
            "entities_original": ["Banco de Inglaterra"],
            "sentiment": "neutral",
            "ai_summary_en": "...",
            "ai_summary_original": "..."
        }}
        """

class AIService:
    def __init__(self, api_key: str = None):
        # 1. Try passed key (User specific)
        # 2. Try env var (System default)
        self.api_key = api_key or os.environ.get("GOOGLE_API_KEY")
        self.client = None
        
        if not self.api_key:
            logger.warning("GOOGLE_API_KEY not found. AI features will be disabled.")
            self.enabled = False
        else:
            try:
                self.client = genai.Client(api_key=self.api_key)
                self.enabled = True
                logger.info("AI Service initialized and enabled.")
            except Exception as e:
                logger.error(f"Failed to configure AI: {e}")
                self.enabled = False

    async def analyze_article(self, title: str, text: str, topic_focus: str = "Economics, Trade, Politics, or Finance", model_name: str = "gemini-1.5-flash", custom_prompt: str = None, debug_logger: Any = None) -> Dict[str, Any]:
        if not self.enabled:
            return {}

        raw_prompt = custom_prompt if custom_prompt else DEFAULT_ANALYSIS_PROMPT
        
        # Ensure model is valid
        if not model_name:
            model_name = "gemini-1.5-flash"
            
        try:
            # Format prompt with provided context
            prompt = raw_prompt.replace("{title}", title) \
                               .replace("{text}", text[:3000]) \
                               .replace("{topic_focus}", topic_focus)

            if debug_logger:
                debug_logger.log_step(f"analyze_{title[:20].strip()}_prompt", prompt)

            start_time = time.time()
            logger.debug(f"LLM Request [Title]: {title} | Model: {model_name}")
            
            response = await self.client.aio.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
            
            elapsed = time.time() - start_time
            
            # Extract Usage Metadata
            usage = response.usage_metadata
            input_tokens = usage.prompt_token_count if usage else "N/A"
            output_tokens = usage.candidates_token_count if usage else "N/A"
            
            logger.info(f"LLM Response | Model: {model_name} | In: {input_tokens} | Out: {output_tokens} | Time: {elapsed:.2f}s")
            logger.info(f"Prompt (First 100): {prompt[:100].replace(chr(10), ' ')}...") # Replace newlines for cleaner log
            logger.debug(f"LLM Response Payload: {response.text}")
            
            if debug_logger:
                debug_logger.log_step(f"analyze_{title[:20].strip()}_response_raw", response.text)

            return json.loads(response.text)
        except Exception as e:
            logger.error(f"AI Analysis failed: {e}")
            if debug_logger:
                debug_logger.log_step(f"analyze_{title[:20].strip()}_error", str(e))
            return {}

    async def analyze_image_or_pdf(self, file_path: str, context_prompt: str, model_name: str = "gemini-2.0-flash-lite") -> Any:
        if not self.enabled:
            return None
            
        try:
            logger.info(f"Uploading file for AI Analysis: {file_path}")
            
            # 1. Upload File
            # We use the correct async client method for file uploads
            with open(file_path, "rb") as f:
                uploaded_file = await self.client.aio.files.upload(file=f, config={'mime_type': 'application/pdf'})
                
            logger.info(f"File uploaded: {uploaded_file.name}")
            
            # 2. Generate Content
            logger.debug(f"Sending Multimodal Request | Model: {model_name}")
            start_time = time.time()
            
            response = await self.client.aio.models.generate_content(
                model=model_name,
                contents=[
                    uploaded_file,
                    context_prompt
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
            
            elapsed = time.time() - start_time
            logger.info(f"Multimodal Response | Time: {elapsed:.2f}s")
             
            if response.text:
                return json.loads(response.text)
            return None
            
        except Exception as e:
            logger.error(f"Multimodal Analysis Failed: {e}")
            return None
    async def call(self, prompt: str, model_name: str = "gemini-2.0-flash-lite", response_mime_type: str = "application/json", debug_logger: Any = None) -> str:
        if not self.enabled:
            return ""
            
        try:
            # Format model name
            if not model_name:
                model_name = "gemini-2.0-flash-lite"
            
            if debug_logger:
                debug_logger.log_step("step_2_prompt_rendered", prompt, extension="txt")

            response = await self.client.aio.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type=response_mime_type
                )
            )
            if not response.text:
                logger.warning(f"AI Response empty. Candidates: {response.candidates}")
            
            if debug_logger:
                debug_logger.log_step("step_2_ai_response_raw", response.text, extension="txt")

            return response.text
        except Exception as e:
            logger.error(f"AI Call failed: {e}")
            if debug_logger:
                debug_logger.log_step("step_2_ai_error", str(e))
            return ""

    def list_models(self):
        """Returns a list of available models supported by the API."""
        if not self.enabled:
            return []
        
        try:
            # We want models that support generateContent
            models = self.client.models.list()
            supported = []
            for m in models:
                # Basic filter for gemini models
                if 'gemini' in m.name.lower() or 'flash' in m.name.lower():
                     # The API returns 'models/gemini-pro', we want just the ID usually.
                     mid = m.name.replace('models/', '')
                     supported.append({
                         "id": mid,
                         "name": m.display_name or mid
                     })
            return supported
        except Exception as e:
            logger.error(f"Failed to list models: {e}")
            return []
