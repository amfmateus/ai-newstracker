#!/bin/bash
cd "$(dirname "$0")"
export PYTHONPATH=$PYTHONPATH:.
# Start worker in background
../.venv/bin/python -m celery -A celery_app worker --loglevel=info &
# Start beat in foreground (this will keep the script alive)
../.venv/bin/python -m celery -A celery_app beat --loglevel=info
