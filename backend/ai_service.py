import os
import json
import logging
from google import genai
from google.genai import types
from typing import Dict, Any, Optional
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

# Hardcoded list of available Claude models
CLAUDE_MODELS = [
    {"id": "claude-opus-4-6", "name": "Claude Opus 4.6"},
    {"id": "claude-sonnet-4-6", "name": "Claude Sonnet 4.6"},
    {"id": "claude-haiku-4-5-20251001", "name": "Claude Haiku 4.5"},
]

def _is_claude_model(model_name: str) -> bool:
    return model_name.startswith("claude-")

def _strip_json_fences(text: str) -> str:
    """Remove markdown code fences that some models wrap JSON in."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r'^```(?:json)?\s*', '', text)
        text = re.sub(r'\s*```$', '', text)
    return text.strip()


class AIService:
    def __init__(self, api_key: str = None, anthropic_api_key: str = None):
        # Google/Gemini setup
        self.google_api_key = api_key or os.environ.get("GOOGLE_API_KEY")
        self.gemini_client = None

        if self.google_api_key:
            try:
                self.gemini_client = genai.Client(api_key=self.google_api_key)
                logger.info("Gemini client initialized.")
            except Exception as e:
                logger.error(f"Failed to configure Gemini: {e}")

        # Anthropic/Claude setup
        self.anthropic_api_key = anthropic_api_key or os.environ.get("ANTHROPIC_API_KEY")
        self.anthropic_client = None

        if self.anthropic_api_key:
            try:
                import anthropic
                self.anthropic_client = anthropic.AsyncAnthropic(api_key=self.anthropic_api_key)
                logger.info("Anthropic client initialized.")
            except Exception as e:
                logger.error(f"Failed to configure Anthropic: {e}")

        self.enabled = bool(self.gemini_client or self.anthropic_client)
        if not self.enabled:
            logger.warning("No AI API keys found. AI features will be disabled.")

    def _gemini_enabled(self) -> bool:
        return self.gemini_client is not None

    def _anthropic_enabled(self) -> bool:
        return self.anthropic_client is not None

    def _can_use_model(self, model_name: str) -> bool:
        if _is_claude_model(model_name):
            return self._anthropic_enabled()
        return self._gemini_enabled()

    async def analyze_article(self, title: str, text: str, topic_focus: str = "Economics, Trade, Politics, or Finance", model_name: str = "gemini-1.5-flash", custom_prompt: str = None, debug_logger: Any = None) -> Dict[str, Any]:
        if not self.enabled:
            return {}

        raw_prompt = custom_prompt if custom_prompt else DEFAULT_ANALYSIS_PROMPT

        if not model_name:
            logger.error("No AI model configured for analysis.")
            return {}

        prompt = raw_prompt.replace("{title}", title) \
                           .replace("{text}", text[:3000]) \
                           .replace("{topic_focus}", topic_focus)

        if debug_logger:
            debug_logger.log_step(f"analyze_{title[:20].strip()}_prompt", prompt)

        start_time = time.time()
        logger.debug(f"LLM Request [Title]: {title} | Model: {model_name}")

        try:
            if _is_claude_model(model_name):
                response_text = await self._call_anthropic_raw(prompt, model_name)
            else:
                response_text = await self._call_gemini_raw(prompt, model_name, response_mime_type="application/json")

            elapsed = time.time() - start_time
            logger.info(f"LLM Response | Model: {model_name} | Time: {elapsed:.2f}s")
            logger.debug(f"LLM Response Payload: {response_text}")

            if debug_logger:
                debug_logger.log_step(f"analyze_{title[:20].strip()}_response_raw", response_text)

            return json.loads(_strip_json_fences(response_text))
        except Exception as e:
            logger.error(f"AI Analysis failed: {e}")
            if debug_logger:
                debug_logger.log_step(f"analyze_{title[:20].strip()}_error", str(e))
            return {}

    async def analyze_image_or_pdf(self, file_path: str, context_prompt: str, model_name: str = "gemini-2.0-flash-lite") -> Any:
        if not self.enabled:
            return None

        if _is_claude_model(model_name):
            return await self._analyze_pdf_claude(file_path, context_prompt, model_name)
        else:
            return await self._analyze_pdf_gemini(file_path, context_prompt, model_name)

    async def _analyze_pdf_gemini(self, file_path: str, context_prompt: str, model_name: str) -> Any:
        if not self._gemini_enabled():
            logger.error("Gemini client not available for PDF analysis.")
            return None
        try:
            logger.info(f"Uploading file for Gemini Analysis: {file_path}")
            with open(file_path, "rb") as f:
                uploaded_file = await self.gemini_client.aio.files.upload(file=f, config={'mime_type': 'application/pdf'})
            logger.info(f"File uploaded: {uploaded_file.name}")

            start_time = time.time()
            response = await self.gemini_client.aio.models.generate_content(
                model=model_name,
                contents=[uploaded_file, context_prompt],
                config=types.GenerateContentConfig(response_mime_type="application/json")
            )
            elapsed = time.time() - start_time
            logger.info(f"Gemini Multimodal Response | Time: {elapsed:.2f}s")
            if response.text:
                return json.loads(response.text)
            return None
        except Exception as e:
            logger.error(f"Gemini Multimodal Analysis Failed: {e}")
            return None

    async def _analyze_pdf_claude(self, file_path: str, context_prompt: str, model_name: str) -> Any:
        if not self._anthropic_enabled():
            logger.error("Anthropic client not available for PDF analysis.")
            return None
        try:
            import base64
            logger.info(f"Reading file for Claude Analysis: {file_path}")
            with open(file_path, "rb") as f:
                pdf_data = base64.standard_b64encode(f.read()).decode("utf-8")

            start_time = time.time()
            message = await self.anthropic_client.messages.create(
                model=model_name,
                max_tokens=8096,
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "document",
                            "source": {
                                "type": "base64",
                                "media_type": "application/pdf",
                                "data": pdf_data,
                            },
                        },
                        {"type": "text", "text": context_prompt}
                    ],
                }]
            )
            elapsed = time.time() - start_time
            logger.info(f"Claude PDF Response | Time: {elapsed:.2f}s")
            text = message.content[0].text
            return json.loads(_strip_json_fences(text))
        except Exception as e:
            logger.error(f"Claude PDF Analysis Failed: {e}")
            return None

    async def call(self, prompt: str, model_name: str = "gemini-2.0-flash-lite", response_mime_type: str = "application/json", debug_logger: Any = None) -> str:
        if not self.enabled:
            return ""

        if not model_name:
            model_name = "gemini-2.0-flash-lite"

        if debug_logger:
            debug_logger.log_step("step_2_prompt_rendered", prompt, extension="txt")

        try:
            if _is_claude_model(model_name):
                result = await self._call_anthropic_raw(prompt, model_name)
            else:
                result = await self._call_gemini_raw(prompt, model_name, response_mime_type=response_mime_type)

            if not result:
                logger.warning(f"AI Response empty for model: {model_name}")

            if debug_logger:
                debug_logger.log_step("step_2_ai_response_raw", result, extension="txt")

            return result
        except Exception as e:
            logger.error(f"AI Call failed: {e}")
            if debug_logger:
                debug_logger.log_step("step_2_ai_error", str(e))
            raise

    async def _call_gemini_raw(self, prompt: str, model_name: str, response_mime_type: str = "application/json") -> str:
        if not self._gemini_enabled():
            raise RuntimeError("Gemini client not initialized")
        response = await self.gemini_client.aio.models.generate_content(
            model=model_name,
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type=response_mime_type)
        )
        return response.text or ""

    async def _call_anthropic_raw(self, prompt: str, model_name: str) -> str:
        if not self._anthropic_enabled():
            raise RuntimeError("Anthropic client not initialized")
        message = await self.anthropic_client.messages.create(
            model=model_name,
            max_tokens=8096,
            messages=[{"role": "user", "content": prompt}]
        )
        return message.content[0].text if message.content else ""

    def call_sync(self, prompt: str, model_name: str = "gemini-2.0-flash-lite", response_mime_type: str = "application/json") -> str:
        """Synchronous version of call() for use in non-async contexts (e.g. Celery tasks)."""
        if not self.enabled:
            return ""
        if not model_name:
            model_name = "gemini-2.0-flash-lite"
        try:
            if _is_claude_model(model_name):
                if not self._anthropic_enabled():
                    raise RuntimeError("Anthropic client not initialized")
                import anthropic as _anthropic
                client = _anthropic.Anthropic(api_key=self.anthropic_api_key)
                message = client.messages.create(
                    model=model_name,
                    max_tokens=8096,
                    messages=[{"role": "user", "content": prompt}]
                )
                return message.content[0].text if message.content else ""
            else:
                if not self._gemini_enabled():
                    raise RuntimeError("Gemini client not initialized")
                response = self.gemini_client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(response_mime_type=response_mime_type)
                )
                return response.text or ""
        except Exception as e:
            logger.error(f"AI call_sync failed: {e}")
            return ""

    def list_models(self):
        """Returns a list of available models from all configured providers."""
        models = []

        # Gemini models
        if self._gemini_enabled():
            try:
                gemini_models = self.gemini_client.models.list()
                for m in gemini_models:
                    if 'gemini' in m.name.lower() or 'flash' in m.name.lower():
                        mid = m.name.replace('models/', '')
                        models.append({"id": mid, "name": m.display_name or mid})
            except Exception as e:
                logger.error(f"Failed to list Gemini models: {e}")

        # Claude models (hardcoded — Anthropic SDK model list requires an extra API call)
        if self._anthropic_enabled():
            models.extend(CLAUDE_MODELS)

        return models
