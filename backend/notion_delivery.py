"""
Notion delivery for pipeline reports.

Generates Notion-flavored Markdown from the pipeline's post-processed AI content,
then converts it to Notion API blocks and creates a page in the target database.
"""
import re
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Inline rich-text parser
# Handles: [text](url), **bold**, plain text, up to 2000 chars per segment
# ---------------------------------------------------------------------------

def _parse_inline(text: str) -> List[dict]:
    """
    Parse a line of Notion-flavored Markdown inline elements into a Notion
    rich_text array.  Handles [text](url) links and **bold** spans.
    """
    if not text:
        return [{"type": "text", "text": {"content": ""}}]

    result = []
    # Pattern matches [text](url) or **bold** or plain text runs
    token_re = re.compile(
        r'\[([^\]]*)\]\((https?://[^\)]+)\)'  # [text](url)
        r'|\*\*([^*]+)\*\*'                    # **bold**
        r'|([^\[*]+)'                           # plain text (no [ or *)
    )
    pos = 0
    for m in token_re.finditer(text):
        # Gap before match → plain text
        if m.start() > pos:
            gap = text[pos:m.start()]
            for chunk in _chunks(gap):
                result.append({"type": "text", "text": {"content": chunk}})
        link_text, link_url, bold_text, plain = m.group(1), m.group(2), m.group(3), m.group(4)
        if link_url:
            for chunk in _chunks(link_text or link_url):
                result.append({
                    "type": "text",
                    "text": {"content": chunk, "link": {"url": link_url}},
                    "annotations": {"color": "blue"}
                })
        elif bold_text:
            for chunk in _chunks(bold_text):
                result.append({
                    "type": "text",
                    "text": {"content": chunk},
                    "annotations": {"bold": True}
                })
        elif plain:
            for chunk in _chunks(plain):
                result.append({"type": "text", "text": {"content": chunk}})
        pos = m.end()
    # Trailing text
    if pos < len(text):
        for chunk in _chunks(text[pos:]):
            result.append({"type": "text", "text": {"content": chunk}})
    return result or [{"type": "text", "text": {"content": ""}}]


def _chunks(text: str, max_len: int = 2000) -> List[str]:
    return [text[i:i + max_len] for i in range(0, max(len(text), 1), max_len)]


# ---------------------------------------------------------------------------
# Block builders from parsed lines
# ---------------------------------------------------------------------------

def _heading(level: int, text: str) -> dict:
    t = f"heading_{level}"
    return {t: {"rich_text": _parse_inline(text)}, "type": t}


def _paragraph(rich_text: List[dict]) -> dict:
    return {"type": "paragraph", "paragraph": {"rich_text": rich_text}}


def _bullet(rich_text: List[dict]) -> dict:
    return {"type": "bulleted_list_item", "bulleted_list_item": {"rich_text": rich_text}}


def _divider() -> dict:
    return {"type": "divider", "divider": {}}


def _callout(colour: str, rich_text: List[dict], emoji: str = "📋") -> dict:
    return {
        "type": "callout",
        "callout": {
            "rich_text": rich_text,
            "icon": {"type": "emoji", "emoji": emoji},
            "color": colour,
        },
    }


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
# Citation marker → Markdown link converter
# Runs BEFORE block building, on raw post-processed text
# ---------------------------------------------------------------------------

def _citations_to_links(text: str, refs_by_id: Dict) -> str:
    """
    Strip HTML tags and convert [[CITE_GROUP:id,...]] markers to
    Notion-flavored Markdown link format [num](url).
    """
    if not text:
        return ""
    # Strip HTML
    text = re.sub(r'<[^>]+>', '', text)

    def replace(m):
        ids = [i.strip() for i in m.group(1).split(',')]
        parts = []
        for aid in ids:
            ref = refs_by_id.get(aid)
            if ref:
                num = ref.get('number', '?')
                url = (ref.get('url') or '').strip()
                if url.startswith('http'):
                    parts.append(f"[{num}]({url})")
                else:
                    parts.append(f"[{num}]")
        return ''.join(parts)

    return re.sub(r'\[\[CITE_GROUP:([^\]]+)\]\]', replace, text)


# ---------------------------------------------------------------------------
# Markdown → blocks (simple line-based parser for our generated content)
# ---------------------------------------------------------------------------

def _md_to_blocks(md: str) -> List[dict]:
    """
    Convert a Notion-flavored Markdown string (as generated by
    _generate_markdown) into Notion API block dicts.
    Handles: ## headings, ### headings, --- dividers, - bullets, paragraphs.
    Callout blocks are passed through from our block list directly so they
    don't need to be parsed from text.
    """
    blocks = []
    for line in md.split('\n'):
        stripped = line.strip()
        if not stripped:
            continue
        if stripped == '---':
            blocks.append(_divider())
        elif stripped.startswith('### '):
            blocks.append(_heading(3, stripped[4:]))
        elif stripped.startswith('## '):
            blocks.append(_heading(2, stripped[3:]))
        elif stripped.startswith('# '):
            blocks.append(_heading(1, stripped[2:]))
        elif stripped.startswith('- '):
            blocks.append(_bullet(_parse_inline(stripped[2:])))
        else:
            blocks.append(_paragraph(_parse_inline(stripped)))
    return blocks


# ---------------------------------------------------------------------------
# Markdown generator
# ---------------------------------------------------------------------------

def _generate_markdown(processed_content: Dict, report_title: str, report_date: str) -> str:
    """
    Generate the body of the Notion page as a list of (type, content) tuples
    that can be turned into Notion blocks.  Returns a list of dicts ready
    to pass to the Notion API, NOT a raw string — we mix pre-built callout
    blocks (for colour) with markdown-parsed blocks.
    """
    # This is intentionally not called; the real entry point is build_notion_blocks().
    pass


# ---------------------------------------------------------------------------
# Main block builder
# ---------------------------------------------------------------------------

def build_notion_blocks(processed_content: Dict, report_date: str, report_title: str = "") -> List[dict]:
    """
    Convert post-processed pipeline AI content into Notion API block dicts,
    using Notion-flavored Markdown as the intermediate representation for
    text content so that inline links, bold, and other formatting are correct.
    """
    refs_by_id = {str(r["id"]): r for r in processed_content.get("references", [])}
    blocks: List[dict] = []

    logger.info(
        f"build_notion_blocks: title='{report_title}', date={report_date}, "
        f"keys={list(processed_content.keys())}, refs={len(refs_by_id)}"
    )

    def c(text: str) -> str:
        """Shorthand: convert citations in text to markdown links."""
        return _citations_to_links(text, refs_by_id)

    # 1. Blue header callout
    header = f"{report_title} · {report_date}" if report_title else report_date
    blocks.append(_callout("blue_background", _parse_inline(header), "📋"))
    blocks.append(_divider())

    # 2. Executive Summary
    summary = processed_content.get("summary") or processed_content.get("executive_summary") or ""
    if summary:
        logger.info(f"build_notion_blocks: summary len={len(summary)}")
        blocks.append(_heading(2, "Executive Summary"))
        blocks += _md_to_blocks(c(summary))
        blocks.append(_divider())

    # 3. Key Findings — each finding as a coloured callout
    key_findings = processed_content.get("key_findings", [])
    if key_findings:
        logger.info(f"build_notion_blocks: key_findings={len(key_findings)}")
        blocks.append(_heading(2, "Key Findings"))
        for finding in key_findings:
            raw = finding if isinstance(finding, str) else finding.get("text", str(finding))
            converted = c(raw)
            colour = _finding_colour(raw)
            blocks.append(_callout(colour, _parse_inline(converted), "•"))
        blocks.append(_divider())

    # 4. Thematic sections
    sections = processed_content.get("sections", [])
    if sections:
        logger.info(f"build_notion_blocks: sections={len(sections)}")
        for section in sections:
            heading = section.get("heading") or section.get("title", "")
            content = section.get("content") or section.get("body", "")
            if heading:
                blocks.append(_heading(2, heading))
            if content:
                blocks += _md_to_blocks(c(content))
            for sub in section.get("subsections", []):
                sub_heading = sub.get("heading") or sub.get("title", "")
                sub_content = sub.get("content") or sub.get("body", "")
                if sub_heading:
                    blocks.append(_heading(3, sub_heading))
                if sub_content:
                    blocks += _md_to_blocks(c(sub_content))
        blocks.append(_divider())

    # 5. References — bulleted list with [num](url) links
    refs = processed_content.get("references", [])
    if refs:
        logger.info(f"build_notion_blocks: references={len(refs)}")
        blocks.append(_heading(2, "References"))
        for ref in refs:
            num = ref.get("number", "")
            title = ref.get("title") or "Unknown"
            source = ref.get("source_name") or ""
            url = (ref.get("url") or "").strip()
            source_part = f"**{source}** — " if source else ""
            num_label = f"[{num}] " if num else ""
            if url.startswith("http"):
                line = f"{num_label}{source_part}[{title}]({url})"
            else:
                line = f"{num_label}{source_part}{title}"
            blocks.append(_bullet(_parse_inline(line)))

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
            children=blocks[:100],
        )
    except Exception as e:
        logger.error(f"Notion page creation failed: {e}")
        raise

    page_id = page["id"]
    page_url = page.get("url", "")
    logger.info(f"Notion page created: {page_url}")

    for i in range(100, len(blocks), 100):
        batch = blocks[i:i + 100]
        try:
            notion.blocks.children.append(page_id, children=batch)
        except Exception as e:
            logger.error(f"Notion append batch {i}–{i+100} failed: {e}")
            raise

    return page_url
