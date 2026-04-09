"""
Notion delivery for pipeline reports.

Converts the pipeline's post-processed AI content (with [[CITE_GROUP:...]] citation
markers and reconciled_references list) into structured Notion blocks matching the
Import Daily Digest SOP format, then creates a page in the target database.
"""
import re
import logging
from typing import Dict, Any, List
from datetime import datetime

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Rich-text helpers
# ---------------------------------------------------------------------------

def _cite_group_to_rich_text(text: str, refs_by_id: Dict) -> list:
    """
    Split text on [[CITE_GROUP:id1,id2,...]] markers and build a Notion
    rich_text array. Citation markers become linked text like [1].
    Plain text segments become plain text objects.
    """
    if not text:
        return [{"type": "text", "text": {"content": ""}}]

    # Strip any residual HTML tags (can appear if content went through markdown conversion)
    text = re.sub(r'<[^>]+>', '', text)

    parts = re.split(r'(\[\[CITE_GROUP:[^\]]+\]\])', text)
    rich_text = []
    for part in parts:
        m = re.match(r'\[\[CITE_GROUP:([^\]]+)\]\]', part)
        if m:
            ids = [i.strip() for i in m.group(1).split(',')]
            for aid in ids:
                ref = refs_by_id.get(aid)
                if ref:
                    label = f"[{ref.get('number', '?')}]"
                    url = ref.get('url', '#') or '#'
                    rich_text.append({
                        "type": "text",
                        "text": {"content": label, "link": {"url": url}},
                        "annotations": {"bold": True, "color": "blue"}
                    })
        elif part:
            # Truncate individual text segments to Notion's 2000-char limit
            for chunk in _chunk_text(part, 2000):
                rich_text.append({"type": "text", "text": {"content": chunk}})

    return rich_text or [{"type": "text", "text": {"content": ""}}]


def _chunk_text(text: str, max_len: int) -> List[str]:
    """Split text into chunks of at most max_len characters."""
    return [text[i:i + max_len] for i in range(0, max(len(text), 1), max_len)]


def _plain_rich_text(text: str) -> list:
    """Simple rich text with no links."""
    result = []
    for chunk in _chunk_text(text or "", 2000):
        result.append({"type": "text", "text": {"content": chunk}})
    return result or [{"type": "text", "text": {"content": ""}}]


# ---------------------------------------------------------------------------
# Block builders
# ---------------------------------------------------------------------------

def _heading2(text: str) -> dict:
    return {
        "type": "heading_2",
        "heading_2": {"rich_text": _plain_rich_text(text)}
    }


def _paragraph(rich_text: list) -> dict:
    return {"type": "paragraph", "paragraph": {"rich_text": rich_text}}


def _callout(colour: str, rich_text: list, emoji: str = "📋") -> dict:
    return {
        "type": "callout",
        "callout": {
            "rich_text": rich_text,
            "icon": {"type": "emoji", "emoji": emoji},
            "color": colour
        }
    }


def _divider() -> dict:
    return {"type": "divider", "divider": {}}


# ---------------------------------------------------------------------------
# Colour mapping for key findings
# ---------------------------------------------------------------------------

def _finding_colour(text: str) -> str:
    t = (text or "").lower()
    if any(w in t for w in ["risk", "security", "conflict", "sanction", "attack", "war", "threat"]):
        return "red_background"
    if any(w in t for w in ["trade", "export", "import", "growth", "gdp", "economy", "market", "commerce"]):
        return "green_background"
    if any(w in t for w in ["budget", "fiscal", "deficit", "tax", "revenue", "spending", "debt"]):
        return "yellow_background"
    if any(w in t for w in ["infrastructure", "investment", "port", "road", "bridge", "construction"]):
        return "blue_background"
    if any(w in t for w in ["energy", "oil", "gas", "solar", "environment", "climate", "emission"]):
        return "orange_background"
    if any(w in t for w in ["tech", "digital", "ai ", "innovation", "startup", "data"]):
        return "purple_background"
    return "gray_background"


# ---------------------------------------------------------------------------
# Main block builder
# ---------------------------------------------------------------------------

def build_notion_blocks(processed_content: Dict, report_date: str, report_title: str = "") -> List[dict]:
    """
    Convert post-processed pipeline AI content into a list of Notion blocks
    matching the Import Daily Digest SOP format.
    """
    refs_by_id = {r["id"]: r for r in processed_content.get("references", [])}
    blocks = []

    logger.info(f"build_notion_blocks: keys={list(processed_content.keys())}, refs={len(refs_by_id)}")

    # 1. Blue header callout — use report title + date
    header_text = f"{report_title} · {report_date}" if report_title else report_date
    blocks.append(_callout("blue_background", _plain_rich_text(header_text), "📋"))
    blocks.append(_divider())

    # 2. Executive Summary
    summary = (
        processed_content.get("summary")
        or processed_content.get("executive_summary")
        or ""
    )
    if summary:
        logger.info(f"build_notion_blocks: summary length={len(summary)}")
        blocks.append(_heading2("Executive Summary"))
        blocks.append(_paragraph(_cite_group_to_rich_text(summary, refs_by_id)))
        blocks.append(_divider())

    # 3. Key Findings
    key_findings = processed_content.get("key_findings", [])
    if key_findings:
        logger.info(f"build_notion_blocks: key_findings count={len(key_findings)}")
        blocks.append(_heading2("Key Findings"))
        for finding in key_findings:
            text = finding if isinstance(finding, str) else finding.get("text", str(finding))
            colour = _finding_colour(text)
            blocks.append(_callout(colour, _cite_group_to_rich_text(text, refs_by_id), "•"))
        blocks.append(_divider())

    # 4. Thematic sections
    sections = processed_content.get("sections", [])
    if sections:
        logger.info(f"build_notion_blocks: sections count={len(sections)}")
        for section in sections:
            heading = section.get("heading") or section.get("title", "")
            content = section.get("content") or section.get("body", "")
            if heading:
                blocks.append(_heading2(heading))
            if content:
                blocks.append(_paragraph(_cite_group_to_rich_text(content, refs_by_id)))
            # Handle subsections if present
            for sub in section.get("subsections", []):
                sub_heading = sub.get("heading") or sub.get("title", "")
                sub_content = sub.get("content") or sub.get("body", "")
                if sub_heading:
                    blocks.append({
                        "type": "heading_3",
                        "heading_3": {"rich_text": _plain_rich_text(sub_heading)}
                    })
                if sub_content:
                    blocks.append(_paragraph(_cite_group_to_rich_text(sub_content, refs_by_id)))
        blocks.append(_divider())

    # 5. References — bulleted list with clickable links (avoids table API issues)
    refs = processed_content.get("references", [])
    if refs:
        logger.info(f"build_notion_blocks: references count={len(refs)}")
        blocks.append(_heading2("References"))
        for ref in refs:
            url = ref.get("url", "").strip()
            title = ref.get("title") or ref.get("source_name") or "Unknown"
            source = ref.get("source_name") or ""
            number = ref.get("number", "")
            label = f"[{number}] {source} — " if source else f"[{number}] "
            ref_rt = [{"type": "text", "text": {"content": label}}]
            if url and url.startswith("http"):
                ref_rt.append({
                    "type": "text",
                    "text": {"content": title, "link": {"url": url}},
                    "annotations": {"color": "blue"}
                })
            else:
                ref_rt.append({"type": "text", "text": {"content": title}})
            blocks.append({
                "type": "bulleted_list_item",
                "bulleted_list_item": {"rich_text": ref_rt}
            })

    return blocks


# ---------------------------------------------------------------------------
# Delivery entry point
# ---------------------------------------------------------------------------

def deliver_to_notion(
    token: str,
    database_id: str,
    title: str,
    report_date: str,
    processed_content: Dict,
) -> str:
    """
    Create a Journal entry in the target Notion database.
    Returns the URL of the created page.
    """
    from notion_client import Client

    notion = Client(auth=token)
    blocks = build_notion_blocks(processed_content, report_date, report_title=title)

    logger.info(f"Creating Notion page '{title}' in database {database_id} ({len(blocks)} blocks)")

    try:
        page = notion.pages.create(
            parent={"database_id": database_id},
            icon={"type": "emoji", "emoji": "📰"},
            properties={
                "Name": {"title": [{"type": "text", "text": {"content": title}}]},
                "date": {"date": {"start": report_date}},
            },
            children=blocks[:100],  # Notion API limit per request
        )
    except Exception as e:
        logger.error(f"Notion page creation failed: {e}")
        raise

    page_id = page["id"]
    page_url = page.get("url", "")
    logger.info(f"Notion page created: {page_url}")

    # Append remaining blocks in batches of 100
    for i in range(100, len(blocks), 100):
        batch = blocks[i:i + 100]
        try:
            notion.blocks.children.append(page_id, children=batch)
        except Exception as e:
            logger.error(f"Notion append batch {i}-{i+100} failed: {e}")
            raise

    return page_url
