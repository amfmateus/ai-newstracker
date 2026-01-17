import feedparser
import httpx

URL = "https://www.portafolio.co/rss/economia.xml"

def debug_rss():
    print(f"Fetching RSS: {URL}")
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    try:
        # Try httpx first
        client = httpx.Client(headers=headers, follow_redirects=True)
        response = client.get(URL)
        print(f"Status: {response.status_code}")
        
        # Parse
        feed = feedparser.parse(response.content)
        print(f"Feed Title: {feed.feed.get('title', 'Unknown')}")
        print(f"Entries: {len(feed.entries)}")
        
        for entry in feed.entries[:3]:
            print(f"- {entry.title} ({entry.link})")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    debug_rss()
