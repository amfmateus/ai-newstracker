from database import SessionLocal
from models import Source
from datetime import datetime
from tasks import check_scheduled_crawls

print("--- Checking Sources ---")
db = SessionLocal()
sources = db.query(Source).all()
print(f"Found {len(sources)} TOTAL sources.")
for s in sources:
    print(f"Source: {s.name} (ID: {s.id}), Status: '{s.status}', URL: {s.url}")

print("\n--- Running Scheduler check ---")
try:
    result = check_scheduled_crawls()
    print(f"Result: {result}")
except Exception as e:
    print(f"Error: {e}")
db.close()
