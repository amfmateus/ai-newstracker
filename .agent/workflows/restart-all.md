---
description: restart all application services (frontend, backend, celery/redis)
---

# Restart All Services

This workflow stops all running services, clears blocked ports, and restarts the backend, celery workers, and frontend development server.

// turbo
1. Run the management script:
```bash
./manage.sh
```

2. Monitor the logs to ensure everything started correctly:
```bash
tail -f backend.log frontend.log celery.log
```
