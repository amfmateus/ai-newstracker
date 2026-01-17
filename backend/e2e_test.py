import requests
import time
import sys

BASE_URL = "http://127.0.0.1:8000"

def run_e2e():
    print("1. Checking API health...")
    try:
        r = requests.get(f"{BASE_URL}/")
        r.raise_for_status()
        print("   API is UP!")
    except Exception as e:
        print(f"   API is DOWN: {e}")
        sys.exit(1)

    print("\n2. Adding Infobae Source...")
    source_payload = {
        "url": "https://www.infobae.com/colombia/ultimas-noticias/",
        "type": "html_generic"
    }
    r = requests.post(f"{BASE_URL}/sources", json=source_payload)
    if r.status_code == 200:
        source_data = r.json()
        source_id = source_data['id']
        print(f"   Source added: {source_id}")
    else:
        print(f"   Failed to add source: {r.text}")
        # iterate existing to find it if it exists
        r = requests.get(f"{BASE_URL}/sources")
        sources = r.json()
        existing = next((s for s in sources if s['url'] == source_payload['url']), None)
        if existing:
            source_id = existing['id']
            print(f"   Using existing source: {source_id}")
        else:
            sys.exit(1)

    print(f"\n3. Triggering Crawl for {source_id}...")
    r = requests.post(f"{BASE_URL}/crawl/{source_id}")
    if r.status_code == 200:
        print("   Crawl triggered successfully.")
    else:
        print(f"   Failed to trigger crawl: {r.text}")
        sys.exit(1)

    print("\n4. Waiting for articles (20s)...")
    time.sleep(20)

    print("\n5. Verifying Articles...")
    r = requests.get(f"{BASE_URL}/articles?limit=5")
    articles = r.json()
    if len(articles) > 0:
        print(f"   SUCCESS! Found {len(articles)} articles.")
        for a in articles:
            print(f"   - {a['raw_title']} ({a['url']})")
            print(f"     Summary: {a.get('generated_summary', '')[:50]}...")
    else:
        print("   FAILURE: No articles found.")
        sys.exit(1)

if __name__ == "__main__":
    run_e2e()
