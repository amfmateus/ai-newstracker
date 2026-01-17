# Deployment Guide for Railway

This guide outlines how to deploy the **AI Newstracker** to [Railway.app](https://railway.app/).

## Prerequisites
- A Railway account (GitHub login recommended).
- The project pushed to a GitHub repository.

## Step 0: Setup GitHub (First Time User)

Since you want to use the "GitHub Method" (which is better for automatic updates), follow these steps to put your code online:

### 1. Create a GitHub Account
- Go to [github.com](https://github.com) and sign up for a free account.

### 2. Create a New Repository
1.  Log in to GitHub.
2.  Click the **+** icon in the top-right corner -> **New repository**.
3.  **Repository name:** `ai-newstracker` (or any name you like).
4.  **Visibility:** Choose **Private** (recommended since this has your code).
5.  Click **Create repository**.

### 3. Push Your Code (Run these in your terminal)
Now we need to send your local code to that new repository.

```bash
# 1. Initialize git in your project folder
git init

# 2. Add all your files
git add .

# 3. Commit (save) your files
git commit -m "Initial commit of AI Newstracker"

# 4. Connect to your new GitHub links
# REPLACE [YOUR_USERNAME] with your actual GitHub username
git remote add origin https://github.com/[YOUR_USERNAME]/ai-newstracker.git

# 5. Push the code
git branch -M main
git push -u origin main
```
*Note: It may ask for your GitHub username and password. If you have 2FA enabled, you might need a "Personal Access Token" instead of a password.*

## Step 1: Create a Project in Railway

## Step 2: Deploy Database & Redis
1.  In your project canvas, right-click and select **Add New Service** > **Database** > **PostgreSQL**.
2.  Right-click and select **Add New Service** > **Database** > **Redis**.

## Step 3: Deploy Backend
1.  Click **"Add New Service"** > **GitHub Repo** > Select your repo.
2.  Click on the new service card to open **Settings**.
3.  **General Settings:**
    - **Root Directory:** `/backend`
    - **Build Command:** (Leave empty, Dockerfile will handle it)
    - **Start Command:** (Leave empty, Dockerfile will handle it)
4.  **Environment Variables:**
    - `DATABASE_URL`: `${Postgres.DATABASE_URL}` (Railway auto-completes this reference)
    - `REDIS_URL`: `${Redis.REDIS_URL}`
    
    **Optional (System Defaults):**
    *These act as fallbacks if you don't configure them in the App Settings UI.*
    - `GOOGLE_API_KEY`: *[Your Google Gemini API Key]* (Required for AI to work out-of-the-box)
    - `OPENAI_API_KEY`: *[Your OpenAI API Key]*
    - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`: *[For email]*
5.  **Service Name:** Rename this service to `backend` for clarity.
6.  **Public Networking:**
    - Go to **Settings** > **Networking**.
    - Click **Generate Domain**. Note this URL (e.g., `backend-production.up.railway.app`).

## Step 4: Deploy Frontend
1.  Click **"Add New Service"** > **GitHub Repo** > Select your repo (again).
2.  Open **Settings** for this service.
3.  **General Settings:**
    - **Root Directory:** `/frontend`
4.  **Environment Variables:**
    - `NEXT_PUBLIC_API_URL`: `https://backend-production.up.railway.app` (The URL from Step 3, **MUST start with https://**)
    - `NEXTAUTH_URL`: (Wait until you generate a domain for the frontend in Step 4.6, e.g. `https://frontend-production.up.railway.app`)
    - `NEXTAUTH_SECRET`: Generate a random string (e.g., `openssl rand -base64 32`).
5.  **Service Name:** Rename to `frontend`.
6.  **Public Networking:**
    - Go to **Settings** > **Networking**.
    - Click **Generate Domain**. Copy this domain to update the `NEXTAUTH_URL` variable above.

## Step 5: Verify
1.  Wait for both services to build (green checkmarks).
2.  Open the **Frontend** URL.
3.  Try logging in or viewing reports. If data loads, the connection to the backend is successful!

## Troubleshooting
- **Build Fails:** Check the "Deploy Logs".
- **API Errors:** Check the Frontend browser console for CORS errors or 404s. Ensure `NEXT_PUBLIC_API_URL` is correct and redeploy the frontend if you change it (build arguments are baked in at build time).

## Alternative: Deploy via CLI (No GitHub)
If you prefer to deploy directly from your machine (using the Dockerfiles):

1.  **Install CLI:** `npm i -g @railway/cli`
2.  **Login:** `railway login`
3.  **Link:** `railway link` (Select your project)
4.  **Deploy Backend:**
    - `cd backend`
    - `railway up --service backend`
5.  **Deploy Frontend:**
    - `cd frontend`
    - `railway up --service frontend`


## Testing Dockerfiles Locally

Verify your containers work before deploying by running them on your machine.

### 1. Test Backend
Build and run the backend container. It needs your environment variables (create a `.env` file in root if you haven't).

```bash
# Build
docker build -t newscrawler-backend ./backend

# Run (assuming you have a .env file with DATABASE_URL etc)
docker run --env-file .env -p 8000:8000 newscrawler-backend
```
*Visit `http://localhost:8000/redoc` to verify it's running.*

### 2. Test Frontend
The frontend needs to know where the backend is during the build.

```bash
# Build (pointing to your local backend)
docker build -t newscrawler-frontend --build-arg NEXT_PUBLIC_API_URL=http://localhost:8000 ./frontend

# Run
docker run -p 3000:3000 newscrawler-frontend
```
*Visit `http://localhost:3000` to verify the UI.*
