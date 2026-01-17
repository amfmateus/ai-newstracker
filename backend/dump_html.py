import json
from database import SessionLocal
from models import FormattingLibrary

def dump_html():
    from pipeline_service import PipelineExecutor, PipelineContext
    from debug_final_html import MOCK_ARTICLES, AI_CONTENT
    
    db = SessionLocal()
    try:
        executor = PipelineExecutor(db)
        context = PipelineContext("test-pipe", "test-user")
        import copy
        processed = executor._post_process_report_content(copy.deepcopy(AI_CONTENT), MOCK_ARTICLES, context)
        fmt = db.query(FormattingLibrary).filter(FormattingLibrary.name == "Default style").first()
        html = executor._execute_formatting(fmt, processed, context)
        
        print("\n--- FINAL HTML DUMP ---")
        print(html)
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    dump_html()
