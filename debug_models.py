import sys
import os

# Manual .env loading
def load_env_manual():
    env_path = os.path.join(os.getcwd(), '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                if line.strip() and not line.startswith('#'):
                    key, val = line.strip().split('=', 1)
                    os.environ[key] = val

load_env_manual()

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from backend.ai_service import AIService
import json

def test_list_models():
    print("Initializing AIService...")
    try:
        service = AIService()
        if not service.enabled:
            print("AIService is NOT enabled (check GOOGLE_API_KEY).")
            return

        print("Calling list_models()...")
        models = service.list_models()
        print(f"Result count: {len(models)}")
        print("Models found:")
        print(json.dumps(models, indent=2))
        
        # Debug raw listing if empty
        if not models:
            print("\nDEBUG: Dumping raw client.models.list() output...")
            try:
                raw_models = service.client.models.list()
                for m in raw_models:
                    print(f"Name: {m.name}, Display: {getattr(m, 'display_name', 'N/A')}")
            except Exception as e:
                print(f"Error fetching raw models: {e}")

    except Exception as e:
        print(f"Exception occurred: {e}")

if __name__ == "__main__":
    test_list_models()
