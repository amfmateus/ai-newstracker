import re
import os

path = '/Users/amfmateus/Documents/Development/Newstracker/backend/main.py'
with open(path, 'r') as f:
    content = f.read()

# 1. Remove ReportGenerateRequest
pattern = r'class ReportGenerateRequest\(BaseModel\):.*?scope: str'
content = re.sub(pattern, '', content, flags=re.DOTALL)

# 2. Update generate_report signature
content = content.replace('req: ReportGenerateRequest', 'req: schemas.ReportCreate')

# 3. Add template logic to generate_report
target_line = 'base_instruction = config_model.report_prompt if config_model and config_model.report_prompt else "You are an expert news analyst. Write a comprehensive report based ONLY on the provided articles."'
template_logic = """
    # Check for Template Override
    if req.template_id:
        from models import ReportTemplate
        template = db.query(ReportTemplate).filter(ReportTemplate.id == req.template_id, ReportTemplate.user_id == current_user.id).first()
        if template and template.prompt_override:
            base_instruction = f"{base_instruction}\\n\\nAdditional Template Instructions:\\n{template.prompt_override}"
"""

if target_line in content:
    content = content.replace(target_line, target_line + template_logic)
else:
    print("Warning: target_line not found for template logic insertion")

with open(path, 'w') as f:
    f.write(content)

print("Main.py updated successfully")
