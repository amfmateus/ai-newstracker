#!/bin/bash
cd "$(dirname "$0")"
export PYTHONPATH=$PYTHONPATH:.
# Start worker in background with limited concurrency to avoid BrokenPipe/OOM
python -m celery -A celery_app worker --loglevel=info --concurrency=2 &
# Start beat in foreground (this will keep the script alive)
python -m celery -A celery_app beat --loglevel=info
