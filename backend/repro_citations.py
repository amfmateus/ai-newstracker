
import re
from typing import Dict, Any, List

class MockArticle:
    def __init__(self, id, source_name):
        self.id = id
        self.source = type('obj', (object,), {'name': source_name, 'reference_name': source_name})
        self.translated_title = f"Title {id}"
        self.raw_title = f"Title {id}"
        self.url = f"http://example.com/{id}"
        self.source_name_backup = source_name

def process_text_standalone(text, group_citations=True, leave_space=False):
    citation_mapping = {"1": 1, "2": 2, "3": 3}
    
    def get_or_assign_number(aid):
        return citation_mapping.get(aid), aid

    def replace_group(match_full):
        pattern = r'\[{1,2}(?:REF|CITATION|CITE|CIT):?\s*([a-zA-Z0-9\-\._\s]+)\s*\]{1,2}'
        ids = re.findall(pattern, match_full)
        valid_ids = []
        for aid in ids:
            num, resolved_id = get_or_assign_number(aid)
            if num:
                valid_ids.append(resolved_id)
        
        if not valid_ids:
            return ""
        
        if group_citations:
            return f"[[CITE_GROUP:{','.join(valid_ids)}]]"
        else:
            return "".join([f"[[CITE_GROUP:{aid}]]" for aid in valid_ids])

    contiguous_pattern = r'([ \t]*)((?:\[{1,2}(?:REF|CITATION|CITE|CIT):?\s*[a-zA-Z0-9\-\._\s]+\s*\]{1,2}[,; \t]*)*(?:\[{1,2}(?:REF|CITATION|CITE|CIT):?\s*[a-zA-Z0-9\-\._\s]+\s*\]{1,2}))'
    
    def sub_handler(match):
        leading_ws = match.group(1)
        citation_block = match.group(2)
        prefix = " " if leave_space else ""
        group_tag = replace_group(citation_block)
        if not group_tag:
            return leading_ws if leave_space else ""
        return prefix + group_tag

    return re.sub(contiguous_pattern, sub_handler, text)

# Test Cases
test_text = "Analysis [[CITATION:1]] [[CITATION:2]], [[CITATION:3]]"

print("--- Grouping ON, Space OFF ---")
print(process_text_standalone(test_text, group_citations=True, leave_space=False))

print("\n--- Grouping OFF, Space OFF ---")
print(process_text_standalone(test_text, group_citations=False, leave_space=False))

print("\n--- Grouping OFF, Space ON ---")
print(process_text_standalone(test_text, group_citations=False, leave_space=True))
