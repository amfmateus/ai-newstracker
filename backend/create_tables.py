from database import engine, Base
from models import SystemConfig

print("Creating tables...")
Base.metadata.create_all(bind=engine)
print("Tables created.")
