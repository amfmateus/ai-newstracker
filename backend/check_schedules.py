from database import SessionLocal
from models import ReportPipeline
from croniter import croniter
from datetime import datetime, timezone
import json

def check_schedules():
    db = SessionLocal()
    try:
        pipelines = db.query(ReportPipeline).all()
        print(f"Total pipelines found: {len(pipelines)}")
        
        scheduled_pipelines = [p for p in pipelines if p.schedule_cron]
        print(f"Scheduled pipelines found: {len(scheduled_pipelines)}")
        
        now = datetime.now(timezone.utc)
        
        for p in scheduled_pipelines:
            print(f"\nPipeline ID: {p.id}")
            print(f"Name: {p.name}")
            print(f"Cron: {p.schedule_cron}")
            print(f"Enabled: {p.is_enabled}")
            
            try:
                iter = croniter(p.schedule_cron, now)
                next_run = iter.get_next(datetime)
                print(f"Calculated Next Run (from now): {next_run}")
            except Exception as e:
                print(f"Error calculating next run: {e}")
                
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_schedules()
