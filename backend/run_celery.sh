#!/bin/bash
cd "$(dirname "$0")"
export PYTHONPATH=$PYTHONPATH:.
PYTHON="${PYTHON:-$(dirname "$0")/../.venv/bin/python}"
# Start worker in background with limited concurrency to avoid BrokenPipe/OOM
$PYTHON -m celery -A celery_app worker --loglevel=info --concurrency=2 &
# Start beat in foreground (this will keep the script alive)
$PYTHON -m celery -A celery_app beat --loglevel=info
