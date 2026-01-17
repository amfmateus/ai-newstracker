from models import User
from fastapi import Depends

async def get_current_user():
    # Returing a mock user to allow server startup
    return User(id="mock-id", email="admin@example.com", full_name="Admin", google_api_key="mock-key")
