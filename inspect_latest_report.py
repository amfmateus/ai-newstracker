import sys
import os
import json
import re
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from backend.models import Report

def inspect_latest_report():
    # Explicitly connect to backend/news_aggregator.db
    db_path = os.path.join(os.getcwd(), "backend/news_aggregator.db")
    print(f"Connecting to DB: {db_path}")
    engine = create_engine(f"sqlite:///{db_path}")
    SessionLocal = sessionmaker(bind=engine)
    
    db = SessionLocal()
    try:
        # Get last 5 reports
        reports = db.query(Report).order_by(Report.created_at.desc()).limit(5).all()
        
        if not reports:
            print("No reports found.")
            return

        print(f"Found {len(reports)} reports. Inspecting...")
        
        for i, report in enumerate(reports):
            print(f"\n--- Report {i+1}: {report.id} ---")
            print(f"Title: {report.title}")
            print(f"Status: {report.status}")
            print(f"Created: {report.created_at}")
            
            if not report.meta_prompt:
                print("meta_prompt: EMPTY/NULL")
                continue

            try:
                debug_info = json.loads(report.meta_prompt)
                prompt = debug_info.get('debug_prompt', '')
                
                if not prompt:
                    print("meta_prompt: Valid JSON but 'debug_prompt' is empty.")
                    continue
                    
                print(f"Prompt Length: {len(prompt)} chars")
                id_count = prompt.count('"id":')
                print(f"Article Count (est. via 'id'): {id_count}")
                
                # Check for "Articles Found" context if available
                # Often logged in 'step_1_source' in context but that's not in meta_prompt usually
                # meta_prompt is context.get("step_2_processing")
                
                # Save the FIRST non-empty prompt found
                dump_filename = f"prompt_dump_{report.id[:8]}.txt"
                with open(dump_filename, "w") as f:
                    f.write(prompt)
                print(f"SAVED full prompt to '{dump_filename}'")
                
            except json.JSONDecodeError:
                print("meta_prompt: Invalid JSON")
                
    finally:
        db.close()

if __name__ == "__main__":
    inspect_latest_report()
