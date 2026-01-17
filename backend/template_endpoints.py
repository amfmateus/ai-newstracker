from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from auth import get_current_user
from models import User, ReportTemplate
import schemas

router = APIRouter(prefix="/api/report-templates", tags=["report-templates"])

@router.get("", response_model=List[schemas.ReportTemplateResponse])
def read_report_templates(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(ReportTemplate).filter(ReportTemplate.user_id == current_user.id).order_by(ReportTemplate.name).all()

@router.post("", response_model=schemas.ReportTemplateResponse)
def create_report_template(template: schemas.ReportTemplateCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db_template = ReportTemplate(
        **template.model_dump(),
        user_id=current_user.id
    )
    db.add(db_template)
    db.commit()
    db.refresh(db_template)
    return db_template

@router.get("/{template_id}", response_model=schemas.ReportTemplateResponse)
def read_report_template(template_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    template = db.query(ReportTemplate).filter(ReportTemplate.id == template_id, ReportTemplate.user_id == current_user.id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template

@router.patch("/{template_id}", response_model=schemas.ReportTemplateResponse)
def update_report_template(template_id: str, template_update: schemas.ReportTemplateUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db_template = db.query(ReportTemplate).filter(ReportTemplate.id == template_id, ReportTemplate.user_id == current_user.id).first()
    if not db_template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    update_data = template_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_template, key, value)
    
    db.commit()
    db.refresh(db_template)
    return db_template

@router.delete("/{template_id}")
def delete_report_template(template_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    template = db.query(ReportTemplate).filter(ReportTemplate.id == template_id, ReportTemplate.user_id == current_user.id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    db.delete(template)
    db.commit()
    return {"message": "Template deleted"}
