import logging
import asyncio
from datetime import datetime, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session
from sqlalchemy import or_
from croniter import croniter

from database import SessionLocal
from models import ReportPipeline
from pipeline_service import PipelineExecutor

logger = logging.getLogger(__name__)

class SchedulerService:
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        # self.executor not initialized here as it needs a DB session
        
    def start(self):
        """Starts the scheduler."""
        if not self.scheduler.running:
            # Check for due pipelines every 60 seconds
            self.scheduler.add_job(
                self.check_scheduled_pipelines, 
                trigger=IntervalTrigger(seconds=60),
                id='pipeline_checker',
                replace_existing=True
            )
            self.scheduler.start()
            print("SchedulerService started.", flush=True)
            logger.info("SchedulerService started.")

    def stop(self):
        """Stops the scheduler."""
        if self.scheduler.running:
            self.scheduler.shutdown()
            logger.info("SchedulerService stopped.")

    async def check_scheduled_pipelines(self):
        """
        Polls DB for pipelines where schedule_enabled=True and next_run_at <= NOW.
        Triggers execution and updates next_run_at.
        """
        db = SessionLocal()
        try:
            # 1. Find due pipelines (including those never run)
            due_pipelines = db.query(ReportPipeline).filter(
                ReportPipeline.schedule_enabled == True,
                or_(
                    ReportPipeline.next_run_at <= now,
                    ReportPipeline.next_run_at == None
                )
            ).all()

            if now.second < 5: # Log pulse once a minute (roughly)
                 logger.info(f"Scheduler pulse: {now} | Found {len(due_pipelines)} due")
            
            if not due_pipelines:
                return

            logger.info(f"Found {len(due_pipelines)} scheduled pipelines due for execution.")

            for pipeline in due_pipelines:
                # 2. Update next_run_at (IMMEDIATELY to prevent double execution)
                if pipeline.schedule_cron:
                    try:
                        iter = croniter(pipeline.schedule_cron, now)
                        pipeline.next_run_at = iter.get_next(datetime)
                        db.commit()
                    except Exception as e:
                        logger.error(f"Error calculating next run for pipeline {pipeline.id}: {e}")
                        # Disable schedule on error to prevent infinite loop
                        pipeline.schedule_enabled = False
                        db.commit()
                        continue
                else:
                    # One-off run or invalid config
                    pipeline.schedule_enabled = False
                    db.commit()

                # 3. Trigger Execution (Fire and Forget / Background Task)
                # We use asyncio.create_task so the scheduler loop doesn't block
                asyncio.create_task(self.run_pipeline_wrapper(pipeline.id, pipeline.user_id))

        except Exception as e:
            logger.error(f"Scheduler loop error: {e}")
        finally:
            db.close()

    async def run_pipeline_wrapper(self, pipeline_id: str, user_id: str):
        """Wrapper to run pipeline and log errors."""
        logger.info(f"Starting scheduled execution for pipeline {pipeline_id}")
        try:
            # Create a fresh DB session for the execution if needed, 
            # but PipelineExecutor generally manages its own or takes arguments.
            # Assuming execute_pipeline is the entry point
            db = SessionLocal()
            try:
                # We need to construct a placeholder request or context
                # For now, we assume standard execution with stored config
                executor = PipelineExecutor(db)
                result = await executor.execute_pipeline(db, pipeline_id, user_id)
                logger.info(f"Scheduled pipeline {pipeline_id} completed. Report ID: {result.get('report_id')}")
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Scheduled pipeline {pipeline_id} execution failed: {e}")
