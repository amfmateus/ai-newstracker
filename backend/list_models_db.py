import google.generativeai as genai
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import User

DATABASE_URL = "sqlite:///./news_aggregator.db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

user = db.query(User).filter(User.google_api_key != None).first()
if user:
    print(f"Using API Key for user: {user.email}")
    genai.configure(api_key=user.google_api_key)
    print("Listing models...")
    try:
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                print(m.name)
    except Exception as e:
        print(f"Error: {e}")
else:
    print("No user with API key found.")
db.close()
