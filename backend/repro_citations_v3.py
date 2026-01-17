
import re

def get_or_assign_number(aid):
    mapping = {"id1": 1, "id2": 2, "id3": 3}
    return mapping.get(aid), aid

def process_text_v3(text, group_citations=True, leave_space=False):
    if not text or not isinstance(text, str): return text
    
    # 1. Flatten existing CITE_GROUP tags
    def flatten_cite_group(match):
        ids = match.group(1).split(',')
        return "".join([f"[[REF:{i.strip()}]]" for i in ids if i.strip()])
    
    text = re.sub(r'\[\[CITE_GROUP:([^\]]+)\]\]', flatten_cite_group, text)
    
    pattern = r'\[{1,2}(?:REF|CITATION|CITE|CIT):?\s*([a-zA-Z0-9\-\._\s]+)\s*\]{1,2}'
    
    def replace_single(match):
        aid = match.group(1).strip()
        num, resolved_id = get_or_assign_number(aid)
        if num:
            return f"[[CITE_GROUP:{resolved_id}]]"
        return ""

    if not group_citations:
        if leave_space:
            processed = re.sub(pattern, replace_single, text)
            processed = re.sub(r'([^\s\t\n])(\[\[CITE_GROUP:)', r'\1 \2', processed)
            return processed
        return re.sub(pattern, replace_single, text)

    def replace_group(match_full):
        ids = re.findall(pattern, match_full)
        valid_ids = []
        seen = set()
        for aid in ids:
            num, res_id = get_or_assign_number(aid)
            if num and res_id not in seen:
                valid_ids.append(res_id)
                seen.add(res_id)
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

# Test cases
text1 = "Analysis[[REF:id1]][[REF:id2]]"
print(f"Original: {text1}")
grouped = process_text_v3(text1, group_citations=True, leave_space=True)
print(f"Grouped (Space=T): {grouped}")

ungrouped = process_text_v3(grouped, group_citations=False, leave_space=True)
print(f"Re-processed Ungrouped (Space=T): {ungrouped}")

regrouped = process_text_v3(ungrouped, group_citations=True, leave_space=False)
print(f"Re-regrouped (Space=F): {regrouped}")
