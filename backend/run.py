import os
import signal
import subprocess
import time
import sys
import uvicorn

def kill_process_on_port(port):
    """Finds and kills the process using the specified port."""
    try:
        # Initial check
        result = subprocess.run(['lsof', '-t', '-i', f':{port}'], capture_output=True, text=True)
        pids = result.stdout.strip().split('\n')
        
        if not pids or pids == ['']:
            print(f"Port {port} is free.")
            return

        print(f"Port {port} is in use by PIDs: {pids}. Cleaning up...")
        
        for pid in pids:
            if pid:
                try:
                    os.kill(int(pid), signal.SIGKILL)
                    print(f"Killed process {pid}")
                except ProcessLookupError:
                    pass
        
        # Double check
        time.sleep(1)
    except Exception as e:
        print(f"Error cleaning port {port}: {e}")

if __name__ == "__main__":
    # Get port from environment variable (Railway/Heroku/etc) or default to 8000
    PORT = int(os.environ.get("PORT", 8000))
    HOST = "0.0.0.0"
    
    # Only try to clean port if likely local dev (e.g. 8000)
    # On production, we assume environment manages this, and we might lack permissions/tools
    if PORT == 8000:
        print(f"Checking system status for {HOST}:{PORT}...")
        kill_process_on_port(PORT)
    
    print(f"Starting News Aggregator Backend on {HOST}:{PORT}...")
    # standard uvicorn run
    uvicorn.run("main:app", host=HOST, port=PORT, reload=False) # Reload false for prod stability
