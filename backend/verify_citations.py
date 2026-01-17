from pipeline_service import PipelineExecutor
from models import FormattingLibrary, Article
import asyncio
import json

# Mock Context
class MockContext:
    def __init__(self):
        self.user_id = "test-user"
        self.pipeline_name = "Test Pipeline"
    def update(self, key, value):
        print(f"Update: {key} -> {value}")

async def test_citations():
    executor = PipelineExecutor(None) # No DB needed for pure processing
    
    # 1. Mock Articles
    articles = [
        Article(id="art-123-abc-456", raw_title="Economic Growth", url="http://example.com/1"),
        Article(id="art-789-def-012", raw_title="Inflation Data", url="http://example.com/2")
    ]
    
    # 2. Mock AI Content with leading spaces and single brackets
    ai_content = {
        "title": "Monthly Report",
        "summary": "The economy is stable [[REF:art-123-abc-456]].", # Space before
        "key_findings": [
            "Inflation rose by 2% [REF:art-789-def-012].", # Single bracket + space before
            "Employment is high[[REF:art-123-abc-456]] and [[CITATION:art-789-def-012]]." # No space
        ]
    }
    
    context = MockContext()
    
    # 3. Test Post-Processing (Spacing & Recursion)
    print("\n--- Testing Post-Processing (Spacing & Recursion) ---")
    import copy
    # We must use copies because the method modifies in-place
    processed = executor._post_process_report_content(copy.deepcopy(ai_content), articles, context)
    print("Processed Content Snippets:")
    print(f"Summary: {processed['summary']}")
    print(f"Finding 0: {processed['key_findings'][0]}")
    print(f"Finding 1: {processed['key_findings'][1]}")
    
    # Check if leading spaces were swallowed (default behavior: leave_space=False)
    assert "stable[[CITE_GROUP:art-123-abc-456]]" in processed["summary"]
    assert "2%[[CITE_GROUP:art-789-def-012]]" in processed["key_findings"][0]
    print("Spacing Swallowing & Single Bracket Capture: Success!")
    
    # Finding 1 has non-contiguous citations: [[REF:A]] and [[CITATION:B]]
    # They stay separate because they were separate in text, but leading space on second one is swallowed
    assert "high[[CITE_GROUP:art-123-abc-456]]" in processed["key_findings"][1]
    assert "and[[CITE_GROUP:art-789-def-012]]" in processed["key_findings"][1]
    print("Non-contiguous Spacing Swallowing: Success!")
    
    # 4. Test Formatting (Styles & No Margin)
    print("\n--- Testing Formatting (Default Params: Superscript, Square Brackets, No Space) ---")
    fmt_lib = FormattingLibrary(
        structure_definition="<h1>{{ title }}</h1><p>{{ summary }}</p>",
        citation_type="numeric_superscript",
        parameters={
            "leave_space": False,
            "display_style": "superscript",
            "enclosure": "square_brackets",
            "group_citations": True,
            "link_target": "external"
        }
    )
    
    html = executor._execute_formatting(fmt_lib, processed, context)
    print("HTML Snippet (Default):", html)
    assert 'vertical-align: super' in html
    assert '[<a' in html # Part of [1]
    
    print("\n--- Testing Formatting (Custom Params: Regular, Parenthesis, Space, No Group) ---")
    processed_spaced = executor._post_process_report_content(
        copy.deepcopy(ai_content), 
        articles, 
        context, 
        formatting_params={"leave_space": True, "group_citations": False}
    )
    
    fmt_lib_custom = FormattingLibrary(
        structure_definition="<p>{{ summary }}</p>",
        citation_type="numeric_superscript",
        parameters={
            "display_style": "regular",
            "enclosure": "parenthesis",
            "link_target": "internal"
        }
    )
    html_custom = executor._execute_formatting(fmt_lib_custom, processed_spaced, context)
    print("HTML Snippet (Custom):", html_custom)
    assert 'vertical-align: super' not in html_custom
    assert ' (#' in html_custom or '(<a href="#ref-' in html_custom # Part of (1)
    
    # Check for space (leave_space=True)
    # The summary was "The economy is stable [[REF:art-123-abc-456]]."
    # Result should be "The economy is stable <span...>(1)</span>."
    assert "stable <span" in html_custom
    print("Verification Script Updated: Success!")

if __name__ == "__main__":
    asyncio.run(test_citations())
