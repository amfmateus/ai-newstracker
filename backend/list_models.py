import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()

key = os.environ.get("GOOGLE_API_KEY")
print(f"Key found: {bool(key)}")

if key:
    genai.configure(api_key=key)
    print("Listing models...")
    try:
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                print(m.name)
    except Exception as e:
        print(f"Error: {e}")
