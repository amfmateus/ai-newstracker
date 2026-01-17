import sys
sys.path.append("/Users/amfmateus/Documents/Development/AI_Newstracker/backend")

from database import SessionLocal
from models import PromptLibrary

def list_prompts():
    db = SessionLocal()
    try:
        prompts = db.query(PromptLibrary).all()
        print(f"Total Prompts: {len(prompts)}")
        for p in prompts:
            print(f"ID: {p.id}")
            print(f"Name: {p.name}")
            print(f"Text (first 200 chars): {p.prompt_text[:200]}")
            print("-" * 20)
    finally:
        db.close()

if __name__ == "__main__":
    list_prompts()
