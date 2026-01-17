from sqlalchemy.orm import Session
from database import SessionLocal
from models import User, ReportPipeline, PromptLibrary, FormattingLibrary, OutputConfigLibrary, DeliveryConfigLibrary
import json

def dump_pipeline_config(email: str):
    db: Session = SessionLocal()
    try:
        # 1. Find User
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print(f"User {email} not found in database.")
            return

        print(f"Found User: {user.full_name} (ID: {user.id})")

        # 2. Find Pipelines
        pipelines = db.query(ReportPipeline).filter(ReportPipeline.user_id == user.id).all()
        if not pipelines:
            print("No pipelines found for this user.")
            return

        print(f"\nFound {len(pipelines)} Pipelines:\n" + "="*50)

        for p in pipelines:
            print(f"PIPELINE: {p.name}")
            print(f"ID: {p.id}")
            print(f"Description: {p.description}")
            print("-" * 20)
            
            # Step 1: Source
            print("STEP 1: SOURCE CONFIG")
            print(json.dumps(p.source_config, indent=2))
            print("-" * 20)

            # Step 2: Processing (Prompt)
            if p.prompt_id:
                prompt = db.query(PromptLibrary).filter(PromptLibrary.id == p.prompt_id).first()
                if prompt:
                    print(f"STEP 2: PROCESSING (Prompt Library: {prompt.name})")
                    print(f"Model: {prompt.model}")
                    print("Prompt Text:")
                    print(prompt.prompt_text)
                else:
                     print(f"STEP 2: PROCESSING (Linked Prompt ID {p.prompt_id} not found)")
            else:
                print("STEP 2: PROCESSING (Not Configured)")
            print("-" * 20)

            # Step 3: Formatting
            if p.formatting_id:
                fmt = db.query(FormattingLibrary).filter(FormattingLibrary.id == p.formatting_id).first()
                if fmt:
                     print(f"STEP 3: FORMATTING (Library: {fmt.name})")
                     print(f"Type: {fmt.citation_type}")
                     print("Structure Definition (Jinja2):")
                     print(fmt.structure_definition)
                     if fmt.css:
                        print("CSS:")
                        print(fmt.css)
                else:
                    print(f"STEP 3: FORMATTING (Linked ID {p.formatting_id} not found)")
            else:
                 print("STEP 3: FORMATTING (Not Configured)")
            print("-" * 20)

            # Step 4: Output
            if p.output_config_id:
                out = db.query(OutputConfigLibrary).filter(OutputConfigLibrary.id == p.output_config_id).first()
                if out:
                    print(f"STEP 4: OUTPUT (Library: {out.name})")
                    print(f"Converter: {out.converter_type}")
                    print("Parameters:")
                    print(json.dumps(out.parameters, indent=2))
                else:
                     print(f"STEP 4: OUTPUT (Linked ID {p.output_config_id} not found)")
            else:
                 print("STEP 4: OUTPUT (Not Configured)")
            print("-" * 20)

            # Step 5: Delivery
            if p.delivery_config_id:
                dlv = db.query(DeliveryConfigLibrary).filter(DeliveryConfigLibrary.id == p.delivery_config_id).first()
                if dlv:
                    print(f"STEP 5: DELIVERY (Library: {dlv.name})")
                    print(f"Type: {dlv.delivery_type}")
                    print("Parameters:")
                    print(json.dumps(dlv.parameters, indent=2))
                else:
                    print(f"STEP 5: DELIVERY (Linked ID {p.delivery_config_id} not found)")
            else:
                 print("STEP 5: DELIVERY (Not Configured)")
            
            print("="*50 + "\n")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    dump_pipeline_config("amfmateus@gmail.com")
