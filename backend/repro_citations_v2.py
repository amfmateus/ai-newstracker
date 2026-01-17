
import re
from typing import Dict, Any, List

def get_or_assign_number(aid):
    mapping = {"id1": 1, "id2": 2, "id3": 3}
    return mapping.get(aid), aid

def process_text_standalone(text, group_citations=True, leave_space=False):
    # Find all citations: [[REF:ID]] or [[CITATION:ID]] or [REF:ID]
    pattern = r'\[{1,2}(?:REF|CITATION|CITE|CIT):?\s*([a-zA-Z0-9\-\._\s]+)\s*\]{1,2}'
    
    def replace_single(match):
        aid = match.group(1)
        num, resolved_id = get_or_assign_number(aid)
        if num:
            return f"[[CITE_GROUP:{resolved_id}]]"
        return ""

    if not group_citations:
        return re.sub(pattern, replace_single, text)

    def replace_group(match_full):
        ids = re.findall(pattern, match_full)
        valid_ids = []
        seen = set()
        for aid in ids:
            num, resolved_id = get_or_assign_number(aid)
            if num and resolved_id not in seen:
                valid_ids.append(resolved_id)
                seen.add(resolved_id)
        if not valid_ids: return ""
        return f"[[CITE_GROUP:{','.join(valid_ids)}]]"

    contiguous_pattern = r'([ \t]*)((?:\[{1,2}(?:REF|CITATION|CITE|CIT):?\s*[a-zA-Z0-9\-\._\s]+\s*\]{1,2}[,; \t]*)*(?:\[{1,2}(?:REF|CITATION|CITE|CIT):?\s*[a-zA-Z0-9\-\._\s]+\s*\]{1,2}))'
    
    def sub_handler(match):
        leading_ws = match.group(1)
        citation_block = match.group(2)
        prefix = " " if leave_space else ""
        group_tag = replace_group(citation_block)
        if not group_tag: return leading_ws if leave_space else ""
        return prefix + group_tag

    return re.sub(contiguous_pattern, sub_handler, text)

# Mock Renderer
def flexible_renderer(match, display_style="superscript", enclosure="parenthesis"):
    ids = match.group(1).split(',')
    encs = {"parenthesis": ("(", ")"), "square_brackets": ("[", "]")}
    s, e = encs.get(enclosure, ("[", "]"))
    color = "color: #2563eb;"
    span_style = f"vertical-align: super; font-size: 0.75rem; font-weight: 600; {color}"
    
    rendered = [f"<a href='#'>{i[-1]}</a>" for i in ids] # mock label as last char of ID
    return f'<span style="{span_style}">{s}{", ".join(rendered)}{e}</span>'

# Test
text = "Analysis [[CITATION:id1]] [[CITATION:id2]], [[CITATION:id3]]"

print("--- Grouping OFF ---")
post = process_text_standalone(text, group_citations=False, leave_space=True)
print(f"Post-processed: {post}")
rendered = re.sub(r'\[\[CITE_GROUP:([^\]]+)\]\]', lambda m: flexible_renderer(m, enclosure="parenthesis"), post)
print(f"Rendered: {rendered}")

print("\n--- Grouping ON ---")
post = process_text_standalone(text, group_citations=True, leave_space=True)
print(f"Post-processed: {post}")
rendered = re.sub(r'\[\[CITE_GROUP:([^\]]+)\]\]', lambda m: flexible_renderer(m, enclosure="parenthesis"), post)
print(f"Rendered: {rendered}")
