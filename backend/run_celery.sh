#!/bin/bash
cd "$(dirname "$0")"
export PYTHONPATH=$PYTHONPATH:.
# Use venv python if available (local dev), otherwise fall back to system python (Railway)
VENV_PYTHON="$(dirname "$0")/../.venv/bin/python"
if [ -f "$VENV_PYTHON" ]; then
    PYTHON="${PYTHON:-$VENV_PYTHON}"
else
    PYTHON="${PYTHON:-python3}"
fi
# Start worker in background with limited concurrency to avoid BrokenPipe/OOM
$PYTHON -m celery -A celery_app worker --loglevel=info --concurrency=2 &
# Start beat in foreground (this will keep the script alive)
$PYTHON -m celery -A celery_app beat --loglevel=info
