from celery import shared_task
from celery.utils.log import get_task_logger
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Source, User, SystemConfig, ReportPipeline
from pipeline_service import PipelineExecutor
from croniter import croniter
from sqlalchemy import or_
from crawler import run_crawler
from clustering import analyze_clusters

logger = get_task_logger(__name__)

@shared_task(name="tasks.crawl_source_task")
def crawl_source_task(source_id: str):
    logger.info(f"Starting crawl task for source {source_id}")
    try:
        run_crawler(source_id)
        return f"Crawl completed for {source_id}"
    except Exception as e:
        logger.error(f"Crawl task failed for {source_id}: {e}")
        raise e

@shared_task(name="tasks.clustering_task")
def clustering_task(user_id: str, api_key: str):
    logger.info(f"Starting clustering task for user {user_id}")
    db: Session = SessionLocal()
    try:
        result = analyze_clusters(db, user_id, api_key)
        
        # Update last_clustering_at
        config = db.query(SystemConfig).filter(SystemConfig.user_id == user_id).first()
        if config:
            config.last_clustering_at = datetime.now(timezone.utc)
            db.commit()
            
        return f"Clustering completed for user {user_id}: {result}"
    except Exception as e:
        logger.error(f"Clustering task failed for user {user_id}: {e}")
        db.rollback()
        raise e
    finally:
        db.close()

@shared_task(name="tasks.check_scheduled_clustering")
def check_scheduled_clustering():
    """
    Checks for users that are due for a story generation (clustering).
    Logic: last_clustering_at + story_generation_interval_mins <= now
    """
    db: Session = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        
        # Get all users with an API Key (clustering needs it)
        users = db.query(User).filter(User.google_api_key != None).all()
        
        triggered_count = 0
        for user in users:
            config = db.query(SystemConfig).filter(SystemConfig.user_id == user.id).first()
            if not config:
                continue
                
            if not config.enable_stories:
                continue

            interval_mins = config.story_generation_interval_mins or 60
            
            should_cluster = False
            if not config.last_clustering_at:
                should_cluster = True
            else:
                last = config.last_clustering_at
                # Ensure last is aware
                if last.tzinfo is None:
                    last = last.replace(tzinfo=timezone.utc)
                
                next_clustering = last + timedelta(minutes=interval_mins)
                if next_clustering <= now:
                    should_cluster = True
            
            if should_cluster:
                logger.info(f"Triggering scheduled clustering for user {user.email} (ID: {user.id})")
                clustering_task.delay(user.id, user.google_api_key)
                triggered_count += 1
                
        return f"Triggered {triggered_count} clustering tasks"
    except Exception as e:
        logger.error(f"Error checking clustering schedule: {e}")
    finally:
        db.close()

@shared_task(name="tasks.check_scheduled_crawls")
def check_scheduled_crawls():
# ... (existing content below)
    """
    Checks for sources that are due for a crawl.
    Logic: last_crawled_at + crawl_interval (minutes) <= now
    """
    db: Session = SessionLocal()
    try:
        now = datetime.now()
        
        # Get all active or error sources (retry errors at normal interval)
        sources = db.query(Source).filter(Source.status.in_(['active', 'error'])).all()
        
        triggered_count = 0
        for source in sources:
            # Default to 15 mins if not set (though we plan to verify this is always set)
            interval_mins = source.crawl_interval if source.crawl_interval else 15
            
            should_crawl = False
            
            if not source.last_crawled_at:
                # Never crawled -> Crawl now
                should_crawl = True
            else:
                # Check interval
                # Ensure last_crawled_at is offset-naive or aware matching 'now'
                # In models.py we use DateTime(timezone=True), so we get aware datetimes.
                # We should prefer using UTC or consistently aware datetimes.
                
                last = source.last_crawled_at
                if last.tzinfo:
                   # Convert 'now' to aware if 'last' is aware
                   now_aware = now.astimezone(last.tzinfo)
                   next_crawl = last + timedelta(minutes=interval_mins)
                   if next_crawl <= now_aware:
                       should_crawl = True
                else:
                    # 'last' is naive (legacy data?), compare with naive 'now'
                    next_crawl = last + timedelta(minutes=interval_mins)
                    if next_crawl <= now:
                        should_crawl = True
            
            if should_crawl:
                # Double check we aren't already crawling? 
                # Ideally we shouldn't trigger if it's already 'crawling', but state might get stuck.
                # For now, let's just trigger. Celery usually handles queueing.
                
                # Check if already queued to avoid storm? 
                # (Simple version: Just trigger)
                
                logger.info(f"Triggering scheduled crawl for {source.name or source.url} (ID: {source.id})")
                crawl_source_task.delay(source.id)
                triggered_count += 1
                
        return f"Triggered {triggered_count} crawls"
    
    except Exception as e:
        logger.error(f"Error checking schedule: {e}")
    finally:
        db.close()

@shared_task(name="tasks.execute_pipeline_task")
def execute_pipeline_task(pipeline_id: str, user_id: str, run_type: str = "manual"):
    """Executes a report pipeline."""
    logger.info(f"Starting execution for pipeline {pipeline_id}")
    db: Session = SessionLocal()
    try:
        from pipeline_service import PipelineExecutor
        executor = PipelineExecutor(db)
        # We wrap in asyncio because execute_pipeline is async
        import asyncio
        result = asyncio.run(executor.execute_pipeline(db, pipeline_id, user_id, run_type=run_type))
        logger.info(f"Pipeline {pipeline_id} completed. Report ID: {result.get('report_id')}")
        return f"Pipeline {pipeline_id} completed"
    except Exception as e:
        logger.error(f"Pipeline {pipeline_id} execution failed: {e}")
        raise e
    finally:
        db.close()

@shared_task(name="tasks.check_scheduled_pipelines")
def check_scheduled_pipelines():
    """
    Checks for pipelines that are due for execution based on their cron schedule.
    """
    db: Session = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        
        # 1. Find due pipelines (including those never run)
        due_pipelines = db.query(ReportPipeline).filter(
            ReportPipeline.schedule_enabled == True,
            or_(
                ReportPipeline.next_run_at <= now,
                ReportPipeline.next_run_at == None
            )
        ).all()
        
        if not due_pipelines:
            return "No pipelines due"

        triggered_count = 0
        for pipeline in due_pipelines:
            # 2. Update next_run_at (IMMEDIATELY to prevent double execution)
            if pipeline.schedule_cron:
                try:
                    now = datetime.now(timezone.utc)
                    iter = croniter(pipeline.schedule_cron, now)
                    next_run = iter.get_next(datetime)
                    if next_run.tzinfo is None:
                        next_run = next_run.replace(tzinfo=timezone.utc)
                    pipeline.next_run_at = next_run
                    db.commit()
                except Exception as e:
                    logger.error(f"Error calculating next run for pipeline {pipeline.id}: {e}")
                    pipeline.schedule_enabled = False
                    db.commit()
                    continue
            else:
                # One-off run or invalid config
                pipeline.schedule_enabled = False
                db.commit()

            # 3. Trigger Execution via Celery task
            logger.info(f"Triggering scheduled execution for pipeline {pipeline.id}")
            execute_pipeline_task.delay(pipeline.id, pipeline.user_id, run_type="scheduled")
            triggered_count += 1
            
        return f"Triggered {triggered_count} scheduled pipelines"
    except Exception as e:
        logger.error(f"Error checking pipeline schedule: {e}")
    finally:
        db.close()
