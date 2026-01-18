# AI Newstracker v1.0 - User Documentation

Welcome to **AI Newstracker**, an intelligent news aggregation and analysis platform. This application monitors your favorite news sources, uses Google Gemini AI to cluster related articles into meaningful "Stories," and can generate automated PDF/Email reports based on your interests.

---

## 🚀 Getting Started

### 1. Initial Setup
When you first access the application, you must configure the core AI service:
1.  Click the **Profile / Settings** icon in the top right.
2.  Enter your **Google Gemini API Key**.
    *   *Need a key? Get one for free at [Google AI Studio](https://aistudio.google.com/).*
3.  Click **Save**.
4.  You should see a green "AI Features Active" banner.

### 2. Email Setup (Required for Reports)
To send automated email reports, you must configure the email service:
1.  In **Settings**, scroll to **Email Configuration**.
2.  Enter your **Resend API Key**.
    *   *Sign up at [Resend.com](https://resend.com) to get a key.*
3.  Set your "From Email" (e.g., `news@yourdomain.com`).
4.  Click **Save**.

---

## 📚 Core Features

### 1. Dashboard
The landing page provides a high-level overview of the system:
*   **Total Articles:** Number of unique articles crawled (last 24h).
*   **Active Sources:** Number of sources being monitored.
*   **Stories Generated:** Number of AI-clustered narratives active.
*   **System Status:** Real-time health check of the API, Database, and Scheduler.

### 2. Sources Management
Control where your news comes from.
*   **Targeted Sources:** Specific websites you want to track (e.g., "TechCrunch", "nytimes.com").
    *   **RSS:** Best for standard blogs and news sites. Fast and reliable.
    *   **Dynamic (Crawl):** Uses a headless browser to read Javascript-heavy sites that don't satisfy RSS. Slower but more powerful.
*   **Discovery:** (Optional) Search for new feeds to add.

### 3. News Feed
The raw stream of all incoming articles.
*   **Search & Filter:** Find articles by keyword, date, or source.
*   **Read:** Click any article to view its AI-generated summary, sentiment score, and key entities.

### 4. Stories (AI Clustering) 🧠
This is the heart of the application. The system automatically groups related articles into "Stories."
*   **Example:** 10 different articles about a specific election event will be grouped into one "Story."
*   **Scores:** Each story is given a "Strength" score (importance) and a "Sentiment" score.
*   **updates:** Stories are updated automatically by the background scheduler (typically every hour).

### 5. Pipelines (Reporting)
Create automated workflows to deliver news to your inbox.
*   **Capabilities:**
    *   **Filter:** Select news by Topic, Date Range, or Keyword.
    *   **Format:** Choose **Email** (HTML summary) or **PDF** (downloadable report).
    *   **Schedule:** Run immediately or set a recurring schedule (e.g., "Every Morning at 8 AM").
*   **Delivery:** Reports are sent to the email configured in your Profile Settings.

---

## ⚙️ Advanced Configuration (Settings Page)

You can fine-tune how the AI agents behave in the **Settings** tab.

### Crawling
*   **Lookback Hours:** How far back in time to search for news on the first crawl (Default: 24h).
*   **Min Text Length:** Articles shorter than this (e.g., 200 chars) are ignored as "noise."
*   **Crawl Interval:** How often sources are checked (Default: 15 mins).

### AI & Analysis
*   **Models:** Select which Gemini model to use for Analysis vs. Clustering (e.g., `gemini-1.5-flash`).
*   **Prompts:** reliable default prompts are provided, but you can override them to change the "personality" or focus of the summaries.

### Scheduling
*   **Enable Stories:** Toggle automatic story generation on/off.
*   **Clustering Interval:** How often the AI re-groups articles into stories.

---

## ❓ Troubleshooting

### "Failed to save settings"
*   Ensure you are connected to the internet.
*   Verify your API Key format (starts with `AIza...` for Google, `re_...` for Resend).
*   Refresh the page to ensure you have the latest application code.

### "Schedulers not working" / No new news
*   Check the **System Status** on the Dashboard.
*   If on Railway, ensure you have deployed the **Background Worker** service (see `RAILWAY_DEPLOY.md`).
*   Check that your Sources are not in "Error" state.

### Email not received
*   Check your Spam folder.
*   Verify your **Resend API Key** is valid and has permission to send.
*   Ensure the "From Email" domain is verified in your Resend dashboard.
