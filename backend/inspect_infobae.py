import httpx
from bs4 import BeautifulSoup
import trafilatura
import json

URL = "https://www.infobae.com/colombia/ultimas-noticias/"

def inspect_infobae():
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    client = httpx.Client(headers=headers, follow_redirects=True)
    
    print(f"Fetching index: {URL}")
    try:
        response = client.get(URL)
        print(f"Status Code: {response.status_code}")
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'lxml')
        links = soup.find_all('a')
        print(f"Found {len(links)} links.")
        
    except Exception as e:
        print(f"Failed to fetch index: {e}")
        return

    count = 0
    for link in links:
        if count >= 5: break
        
        href = link.get('href')
        if not href: continue
        
        if href.startswith('http'):
            full_url = href
        else:
            full_url = str(httpx.URL(URL).join(href))
            
        # Filter
        if '/202' not in full_url and len(httpx.URL(full_url).path) < 20:
             continue
             
        print(f"\nChecking: {full_url}")
        try:
            downloaded = trafilatura.fetch_url(full_url)
            if not downloaded:
                print("Trafilatura failed to download.")
                continue
                
            result = trafilatura.extract(downloaded, output_format='json', with_metadata=True)
            if result:
                 data = json.loads(result)
                 print(f"SUCCESS: {data.get('title')}")
                 count += 1
            else:
                 print("FAILED extraction")
                 
        except Exception as e:
             print(f"Error: {e}")

if __name__ == "__main__":
    inspect_infobae()
