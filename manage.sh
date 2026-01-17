#!/bin/bash

# Configuration
FRONTEND_PORT=3000
BACKEND_PORT=8000
PROJECT_ROOT=$(pwd)
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
VENV_DIR="$PROJECT_ROOT/.venv" # Based on previous search, the main venv seems to be at root
BACKEND_VENV="$BACKEND_DIR/venv" # There is also one in backend

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔍 Checking system status...${NC}"

# Function to kill process on port
kill_port() {
    local port=$1
    local name=$2
    local pids=$(lsof -t -i :$port)
    if [ -n "$pids" ]; then
        echo -e "${RED}Stopping $name on port $port (PIDs: $pids)...${NC}"
        kill -9 $pids 2>/dev/null
        sleep 1
    else
        echo -e "${GREEN}$name is not running on port $port.${NC}"
    fi
}

# 1. Stop Services
echo "--- Stopping Services ---"
kill_port $FRONTEND_PORT "Frontend"
kill_port $BACKEND_PORT "Backend"

# Stop Celery
CELERY_PIDS=$(pgrep -f "celery")
if [ -n "$CELERY_PIDS" ]; then
    echo -e "${RED}Stopping Celery (PIDs: $CELERY_PIDS)...${NC}"
    kill -9 $CELERY_PIDS 2>/dev/null
fi

# 2. Check for spuriously blocked ports
echo "--- Verifying Ports ---"
for port in $FRONTEND_PORT $BACKEND_PORT; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        echo -e "${RED}Critical: Port $port is still blocked. Please check manually.${NC}"
        # exit 1 # Should we exit? Let's try to proceed but warn.
    else
        echo -e "${GREEN}Port $port is free.${NC}"
    fi
done

# 3. Restart Services
echo "--- Starting Services ---"

# Start Redis (Background)
if ! pgrep -x "redis-server" > /dev/null; then
    echo "Starting Redis..."
    redis-server --daemonize yes || echo -e "${RED}Failed to start Redis. Celery might fail.${NC}"
else
    echo -e "${GREEN}Redis is already running.${NC}"
fi

# Start Backend
echo "Starting Backend API..."
cd "$BACKEND_DIR"
# Use the root venv
nohup "$VENV_DIR/bin/python" run.py > "$PROJECT_ROOT/backend.log" 2>&1 &
echo -e "${GREEN}Backend started (logging to backend.log)${NC}"

# Start Celery
echo "Starting Celery Worker/Beat..."
nohup bash run_celery.sh > "$PROJECT_ROOT/celery.log" 2>&1 &
echo -e "${GREEN}Celery started (logging to celery.log)${NC}"

# Start Frontend
echo "Starting Frontend..."
cd "$FRONTEND_DIR"
nohup npm run dev > "$PROJECT_ROOT/frontend.log" 2>&1 &
echo -e "${GREEN}Frontend started (logging to frontend.log)${NC}"

echo -e "${GREEN}Success: All services have been signaled to start.${NC}"
echo "Use 'tail -f *.log' to monitor progress."
