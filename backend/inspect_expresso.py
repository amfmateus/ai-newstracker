import httpx
from bs4 import BeautifulSoup
import trafilatura
import json

URL = "https://expresso.pt/ultimas"

def inspect_expresso():
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    client = httpx.Client(headers=headers, follow_redirects=True)
    
    print(f"Fetching index: {URL}")
    response = client.get(URL)
    soup = BeautifulSoup(response.text, 'lxml')
    
    links = soup.find_all('a')
    print(f"Found {len(links)} links.")
    
    count = 0
    for link in links:
        if count >= 10: break
        
        href = link.get('href')
        if not href: continue
        
        full_url = str(httpx.URL(URL).join(href))
        
        # Simple skip
        if any(x in full_url for x in ['/tag/', '/category/', '/author/', '/login', '/signup', 'javascript:', '#']):
            continue

        print(f"\nChecking: {full_url}")
        try:
            downloaded = trafilatura.fetch_url(full_url)
            if not downloaded:
                print("Trafilatura failed to download.")
                continue
                
            result = trafilatura.extract(
                downloaded, 
                include_comments=False, 
                include_tables=False,
                favor_precision=True,
                output_format='json',
                with_metadata=True
            )
            
            if result:
                data = json.loads(result)
                print(f"SUCCESS: {data.get('title')}")
                print(f"Date: {data.get('date')}")
                print(f"Text length: {len(data.get('text', ''))}")
                count += 1
            else:
                 print("FAILED: Trafilatura could not extract article.")

        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    inspect_expresso()
