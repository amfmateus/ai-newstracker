import os
import sys
from sqlalchemy import create_engine, text

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SQLALCHEMY_DATABASE_URL as DATABASE_URL, Base
from models import Report

def migrate():
    engine = create_engine(DATABASE_URL)
    print("Creating reports table...")
    
    # Create the table
    Report.__table__.create(engine)
    
    print("Migration complete!")

if __name__ == "__main__":
    migrate()
