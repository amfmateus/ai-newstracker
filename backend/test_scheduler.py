import asyncio
import os
import sys

# Ensure backend path is in sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, engine, Base
from models import ReportPipeline, User
from scheduler_service import SchedulerService
from datetime import datetime, timedelta, timezone

async def test_scheduler():
    scheduler = SchedulerService()
    scheduler.start() # Starts async loop

    db = SessionLocal()
    try:
        # 1. Setup Data
        # Ensure tables exist
        Base.metadata.create_all(bind=engine)
        
        # Get or Create User
        user = db.query(User).first()
        if not user:
            user = User(email="scheduler_test@example.com")
            db.add(user)
            db.commit()
            
        print(f"User ID: {user.id}")

        # Create Scheduled Pipeline (due 1 second ago)
        due_time = datetime.now(timezone.utc) - timedelta(seconds=1)
        pipeline = ReportPipeline(
            user_id=user.id,
            name="Scheduled Test Pipeline",
            schedule_enabled=True,
            schedule_cron="* * * * *", # Every minute
            next_run_at=due_time,
            source_config={"test": True}
        )
        db.add(pipeline)
        db.commit()
        db.refresh(pipeline)
        
        print(f"Created Pipeline {pipeline.id} scheduled for {pipeline.next_run_at}")

        # 2. Trigger Scheduler Check Manually (or wait)
        # We call the method directly to verify logic without waiting 60s
        print("Triggering check_scheduled_pipelines...")
        await scheduler.check_scheduled_pipelines()
        
        # 3. Verify Update
        db.refresh(pipeline)
        
        # Ensure aware comparison
        next_run = pipeline.next_run_at
        if next_run and next_run.tzinfo is None:
            next_run = next_run.replace(tzinfo=timezone.utc)
            
        print(f"Pipeline updated next_run_at: {next_run}")
        
        if next_run > due_time:
            print("SUCCESS: Pipeline reschedule success.")
        else:
            print(f"FAILURE: Pipeline next_run_at ({next_run}) not updated (due: {due_time}).")
            
        # Optional: Wait for background execution log to appear (hard to test programmatically without mocking logger)
        await asyncio.sleep(1) 
            
    finally:
        # Cleanup
        db.query(ReportPipeline).filter(ReportPipeline.name == "Scheduled Test Pipeline").delete()
        db.commit()
        db.close()
        scheduler.stop()

if __name__ == "__main__":
    asyncio.run(test_scheduler())
