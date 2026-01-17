from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from croniter import croniter
from typing import List, Optional
import shutil
import os
from pathlib import Path

from database import get_db
from models import (
    ReportPipeline, PromptLibrary, FormattingLibrary,
    OutputConfigLibrary, DeliveryConfigLibrary, SourceConfigLibrary, Asset, User
)
from schemas import (
    ReportPipelineResponse, ReportPipelineCreate, ReportPipelineUpdate,
    PromptLibraryResponse, PromptLibraryCreate, PromptLibraryUpdate,
    FormattingLibraryResponse, FormattingLibraryCreate, FormattingLibraryUpdate,
    OutputConfigLibraryResponse, OutputConfigLibraryCreate, OutputConfigLibraryUpdate,
    DeliveryConfigLibraryResponse, DeliveryConfigLibraryCreate, DeliveryConfigLibraryUpdate,
    SourceConfigLibraryResponse, SourceConfigLibraryCreate, SourceConfigLibraryUpdate,
    AssetResponse, AssetCreate
)
from auth import get_current_user, get_current_user_relaxed
from pipeline_service import PipelineExecutor

def _update_next_run(pipeline: ReportPipeline):
    """Internal helper to calculate next_run_at based on cron."""
    if pipeline.schedule_enabled and pipeline.schedule_cron:
        try:
            now = datetime.now(timezone.utc)
            iter = croniter(pipeline.schedule_cron, now)
            next_run = iter.get_next(datetime)
            if next_run.tzinfo is None:
                next_run = next_run.replace(tzinfo=timezone.utc)
            pipeline.next_run_at = next_run
        except Exception as e:
            # On error, we don't block the save but we might log it
            print(f"Error calculating next run: {e}")
            pipeline.next_run_at = None
    else:
        pipeline.next_run_at = None
from ai_service import AIService

router = APIRouter(prefix="/pipeline", tags=["pipeline"])

@router.post("/test-step/{step_number}")
async def test_pipeline_step(
    step_number: int,
    input_context: dict,
    step_config_id: Optional[str] = None,
    force_refresh: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    executor = PipelineExecutor(db)
    
    # Inject pipeline name if available
    pipeline_id = input_context.get("pipeline_id")
    if pipeline_id:
        pipeline = db.query(ReportPipeline).filter(ReportPipeline.id == pipeline_id).first()
        if pipeline:
            input_context["pipeline_name"] = pipeline.name

    try:
        result = await executor.test_step(step_number, input_context, step_config_id, current_user.id, force_refresh)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/test-report/view")
async def view_test_report(
    path: str,
    download: bool = False,
    current_user: User = Depends(get_current_user_relaxed)
):
    """
    Serves a generated test report for preview or download.
    Strictly limited to /tmp/reports for security.
    """
    if not path.startswith("/tmp/reports/"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    file_path = Path(path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
        
    # Determine media type
    media_type = "application/octet-stream"
    suffix = file_path.suffix.lower()
    if suffix == ".pdf":
        media_type = "application/pdf"
    elif suffix == ".html":
        media_type = "text/html"
    
    headers = {}
    if download:
        # Force download with correct filename
        headers["Content-Disposition"] = f'attachment; filename="{file_path.name}"'
        
    return FileResponse(path, media_type=media_type, filename=file_path.name, headers=headers)

# --- 1. Assets ---

@router.post("/assets", response_model=AssetResponse)
def upload_asset(
    file: UploadFile = File(...),
    name: str = Form(...),
#    asset_type: str = Form("image"), # Optional, default to image
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Ensure assets directory exists
    ASSET_DIR = Path("assets")
    ASSET_DIR.mkdir(exist_ok=True)
    
    # Save file
    file_id = f"{current_user.id}_{file.filename}"
    file_path = ASSET_DIR / file_id
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Create DB Entry
    # For now, URL is purely local path or assume served via static
    # In production, this would be an S3 URL or /static/ URL
    url = f"/static/assets/{file_id}" 
    
    asset = Asset(
        user_id=current_user.id,
        name=name,
        file_path=str(file_path),
        url=url,
        asset_type="image" 
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset

@router.get("/assets", response_model=List[AssetResponse])
def get_assets(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Asset).filter(Asset.user_id == current_user.id).all()

@router.delete("/assets/{asset_id}")
def delete_asset(asset_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    asset = db.query(Asset).filter(Asset.id == asset_id, Asset.user_id == current_user.id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
        
    # Try deleting file
    try:
        os.remove(asset.file_path)
    except:
        pass # File might be missing
        
    db.delete(asset)
    db.commit()
    return {"ok": True}

    return {"ok": True}



@router.get("/models")
def get_available_models(current_user: User = Depends(get_current_user)):
    """Returns list of available AI models for selection."""
    try:
        # Use user-specific key if available, otherwise system default
        api_key = current_user.google_api_key
        service = AIService(api_key=api_key)
        
        models = service.list_models()
        
        if not models:
             # Fallback if API fails or no key
            return [
                {"id": "gemini-2.0-flash-lite-preview-02-05", "name": "Gemini 2.0 Flash Lite (Preview)"},
                {"id": "gemini-2.0-flash", "name": "Gemini 2.0 Flash"}, # Standard 2.0 Flash
                {"id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash"},
                {"id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro"},
                {"id": "gemini-2.0-pro-exp-02-05", "name": "Gemini 2.0 Pro Experimental"},
                {"id": "gemini-1.5-flash-8b", "name": "Gemini 1.5 Flash 8B"},
            ]
        return models
    except Exception as e:
        print(f"Error fetching models: {e}")
        # Fallback
        return [
            {"id": "gemini-2.0-flash-lite-preview-02-05", "name": "Gemini 2.0 Flash Lite (Preview)"},
            {"id": "gemini-2.0-flash", "name": "Gemini 2.0 Flash"},
            {"id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash"},
            {"id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro"},
        ]


# --- 2. Prompt Library ---

@router.get("/libraries/prompts", response_model=List[PromptLibraryResponse])
def get_prompts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(PromptLibrary).filter(PromptLibrary.user_id == current_user.id).all()

@router.post("/libraries/prompts", response_model=PromptLibraryResponse)
def create_prompt(item: PromptLibraryCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db_item = PromptLibrary(**item.dict(), user_id=current_user.id)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.put("/libraries/prompts/{item_id}", response_model=PromptLibraryResponse)
def update_prompt(item_id: str, item: PromptLibraryUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db_item = db.query(PromptLibrary).filter(PromptLibrary.id == item_id, PromptLibrary.user_id == current_user.id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    for key, value in item.dict(exclude_unset=True).items():
        setattr(db_item, key, value)
    
    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/libraries/prompts/{item_id}")
def delete_prompt(item_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    item = db.query(PromptLibrary).filter(PromptLibrary.id == item_id, PromptLibrary.user_id == current_user.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"ok": True}


# --- 3. Formatting Library ---

@router.get("/libraries/formatting", response_model=List[FormattingLibraryResponse])
def get_formattings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(FormattingLibrary).filter(FormattingLibrary.user_id == current_user.id).all()

@router.post("/libraries/formatting", response_model=FormattingLibraryResponse)
def create_formatting(item: FormattingLibraryCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db_item = FormattingLibrary(**item.dict(), user_id=current_user.id)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.put("/libraries/formatting/{item_id}", response_model=FormattingLibraryResponse)
def update_formatting(item_id: str, item: FormattingLibraryUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db_item = db.query(FormattingLibrary).filter(FormattingLibrary.id == item_id, FormattingLibrary.user_id == current_user.id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    for key, value in item.dict(exclude_unset=True).items():
        setattr(db_item, key, value)
    
    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/libraries/formatting/{item_id}")
def delete_formatting(item_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    item = db.query(FormattingLibrary).filter(FormattingLibrary.id == item_id, FormattingLibrary.user_id == current_user.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"ok": True}


# --- 4. Output Config Library ---

@router.get("/libraries/output", response_model=List[OutputConfigLibraryResponse])
def get_outputs(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(OutputConfigLibrary).filter(OutputConfigLibrary.user_id == current_user.id).all()

@router.post("/libraries/output", response_model=OutputConfigLibraryResponse)
def create_output(item: OutputConfigLibraryCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db_item = OutputConfigLibrary(**item.dict(), user_id=current_user.id)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.put("/libraries/output/{item_id}", response_model=OutputConfigLibraryResponse)
def update_output(item_id: str, item: OutputConfigLibraryUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db_item = db.query(OutputConfigLibrary).filter(OutputConfigLibrary.id == item_id, OutputConfigLibrary.user_id == current_user.id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    for key, value in item.dict(exclude_unset=True).items():
        setattr(db_item, key, value)
    
    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/libraries/output/{item_id}")
def delete_output(item_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    item = db.query(OutputConfigLibrary).filter(OutputConfigLibrary.id == item_id, OutputConfigLibrary.user_id == current_user.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"ok": True}


# --- 5. Delivery Config Library ---

@router.get("/libraries/delivery", response_model=List[DeliveryConfigLibraryResponse])
def get_deliveries(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(DeliveryConfigLibrary).filter(DeliveryConfigLibrary.user_id == current_user.id).all()

@router.post("/libraries/delivery", response_model=DeliveryConfigLibraryResponse)
def create_delivery(item: DeliveryConfigLibraryCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db_item = DeliveryConfigLibrary(**item.dict(), user_id=current_user.id)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.put("/libraries/delivery/{item_id}", response_model=DeliveryConfigLibraryResponse)
def update_delivery(item_id: str, item: DeliveryConfigLibraryUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db_item = db.query(DeliveryConfigLibrary).filter(DeliveryConfigLibrary.id == item_id, DeliveryConfigLibrary.user_id == current_user.id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    for key, value in item.dict(exclude_unset=True).items():
        setattr(db_item, key, value)
    
    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/libraries/delivery/{item_id}")
def delete_delivery(item_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    item = db.query(DeliveryConfigLibrary).filter(DeliveryConfigLibrary.id == item_id, DeliveryConfigLibrary.user_id == current_user.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"ok": True}


# --- 5.1 Source Config Library ---

@router.get("/libraries/source-configs", response_model=List[SourceConfigLibraryResponse])
def get_source_configs(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(SourceConfigLibrary).filter(SourceConfigLibrary.user_id == current_user.id).all()

@router.post("/libraries/source-configs", response_model=SourceConfigLibraryResponse)
def create_source_config(item: SourceConfigLibraryCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db_item = SourceConfigLibrary(**item.dict(), user_id=current_user.id)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.put("/libraries/source-configs/{item_id}", response_model=SourceConfigLibraryResponse)
def update_source_config(item_id: str, item: SourceConfigLibraryUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db_item = db.query(SourceConfigLibrary).filter(SourceConfigLibrary.id == item_id, SourceConfigLibrary.user_id == current_user.id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    for key, value in item.dict(exclude_unset=True).items():
        setattr(db_item, key, value)
    
    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/libraries/source-configs/{item_id}")
def delete_source_config(item_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    item = db.query(SourceConfigLibrary).filter(SourceConfigLibrary.id == item_id, SourceConfigLibrary.user_id == current_user.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"ok": True}


# --- 6. Report Pipelines ---

@router.get("/pipelines", response_model=List[ReportPipelineResponse])
def get_pipelines(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(ReportPipeline).filter(ReportPipeline.user_id == current_user.id).all()

@router.post("/pipelines", response_model=ReportPipelineResponse)
def create_pipeline(item: ReportPipelineCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db_item = ReportPipeline(**item.dict(), user_id=current_user.id)
    _update_next_run(db_item)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.put("/pipelines/{item_id}", response_model=ReportPipelineResponse)
def update_pipeline(item_id: str, item: ReportPipelineUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db_item = db.query(ReportPipeline).filter(ReportPipeline.id == item_id, ReportPipeline.user_id == current_user.id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    for key, value in item.dict(exclude_unset=True).items():
        setattr(db_item, key, value)
    
    _update_next_run(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/pipelines/{item_id}")
def delete_pipeline(item_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    item = db.query(ReportPipeline).filter(ReportPipeline.id == item_id, ReportPipeline.user_id == current_user.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"ok": True}

@router.post("/pipelines/{pipeline_id}/run")
async def run_pipeline_endpoint(pipeline_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Executes the pipeline immediately"""
    try:
        from pipeline_service import PipelineExecutor
        executor = PipelineExecutor(db)
        result = await executor.run_pipeline(pipeline_id, current_user.id)
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{pipeline_id}/export")
async def export_pipeline(
    pipeline_id: str, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """Exports the full configuration of a pipeline as JSON."""
    executor = PipelineExecutor(db)
    try:
        config = await executor.export_pipeline_config(pipeline_id, current_user.id)
        return config
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/import")
async def import_pipeline(
    config: dict, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """Imports a pipeline configuration from JSON."""
    executor = PipelineExecutor(db)
    try:
        new_pipeline = await executor.import_pipeline_config(config, current_user.id)
        return new_pipeline # Will return the ReportPipelineResponse structure
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"Import failed: {str(e)}")
