import os
from celery import Celery
from celery.schedules import crontab

# Default Redis URL
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "news_aggregator",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    broker_connection_retry_on_startup=True,
)

# Beat Schedule
celery_app.conf.beat_schedule = {
    "check-scheduled-crawls-every-minute": {
        "task": "tasks.check_scheduled_crawls",
        "schedule": crontab(minute="*"), # Run every minute
    },
    "check-scheduled-clustering-every-minute": {
        "task": "tasks.check_scheduled_clustering",
        "schedule": crontab(minute="*"), # Run every minute
    },
    "check-scheduled-pipelines-every-minute": {
        "task": "tasks.check_scheduled_pipelines",
        "schedule": crontab(minute="*"), # Run every minute
    },
}
