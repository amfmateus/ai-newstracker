from database import SessionLocal, engine, Base
from models import SystemConfig

# Ensure table exists (double check)
Base.metadata.create_all(bind=engine)

db = SessionLocal()
try:
    print("Querying settings...")
    config = db.query(SystemConfig).first()
    if not config:
        print("Not found, creating...")
        config = SystemConfig(id=1)
        db.add(config)
        db.commit()
    print("Success:", config.id)
except Exception as e:
    import traceback
    traceback.print_exc()
finally:
    db.close()
