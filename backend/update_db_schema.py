from database import engine, Base
from models import ClusteringEvent

def update():
    print("Creating all tables...")
    Base.metadata.create_all(bind=engine)
    print("Done.")

if __name__ == "__main__":
    update()
