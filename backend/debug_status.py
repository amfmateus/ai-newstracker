from database import SessionLocal
from models import Source

db = SessionLocal()
s = db.query(Source).filter(Source.name == "Economist").first()
if s:
    print(f"Name: {s.name}")
    print(f"Status Raw: {repr(s.status)}")
    print(f"Is 'error'?: {s.status == 'error'}")
    
    # Test query
    q = db.query(Source).filter(Source.status.in_(['active', 'error'])).all()
    found = any(x.id == s.id for x in q)
    print(f"Found in query?: {found}")
else:
    print("Economist source not found")
db.close()
