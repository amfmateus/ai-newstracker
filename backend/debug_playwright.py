import asyncio
from playwright.async_api import async_playwright

URL = "https://example.com"

async def run():
    print(f"Launching browser to crawl {URL}...")
    async with async_playwright() as p:
        try:
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--disable-gpu",
                    "--no-sandbox",
                    "--disable-dev-shm-usage"
                ]
            )
            # Set user agent in context
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            page = await context.new_page()
            print("Page created. Navigating...")
            
            # Use same timeout and wait_until as production
            await page.goto(URL, wait_until="networkidle", timeout=30000)
            
            content = await page.content()
            print(f"Content retrieved. Length: {len(content)}")
            
            await browser.close()
            print("Browser closed successfully.")
            
        except Exception as e:
            print(f"ERROR: {e}")

if __name__ == "__main__":
    asyncio.run(run())
