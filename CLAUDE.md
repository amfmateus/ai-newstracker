# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (FastAPI)
```bash
cd backend
source venv/bin/activate
python run.py                   # Start API server on :8000 (auto-kills prior process)
bash run_celery.sh              # Start Celery worker + Beat scheduler
pytest test_crawler.py -v       # Run a single test file
pytest -k "test_name"           # Run a specific test by name
```

### Frontend (Next.js)
```bash
cd frontend
npm run dev                     # Dev server on :3000
npm run build                   # Production build
npm run lint                    # ESLint check
```

### Full Stack
```bash
bash manage.sh                  # Kill existing processes, start Redis + all services via nohup
docker-compose up               # Containerized full stack (PostgreSQL + Redis)
```

Log files created by `manage.sh`: `backend.log`, `celery.log`, `frontend.log`

## Architecture

AI Newstracker is a multi-tenant news intelligence platform. Users configure sources, and the system crawls them on a schedule, clusters articles into stories, and generates AI-powered reports via configurable pipelines.

### Data Flow

```
Sources → Crawl (Playwright/feedparser) → Articles
Articles → Cluster (Gemini AI) → Stories
Stories + Config → Pipeline → Reports → Email/Notion
```

**Scheduler** (`celery_app.py` + `tasks.py`): Celery Beat runs every minute, checking for due crawls, clustering runs, and pipeline executions per user configuration.

### Backend Structure

| File | Responsibility |
|------|---------------|
| `main.py` | FastAPI app, route includes, CORS, startup |
| `models.py` | SQLAlchemy ORM (25+ models); `User`, `Source`, `Article`, `Story`, `Report`, `ReportPipeline`, `SystemConfig` |
| `schemas.py` | Pydantic v2 request/response schemas |
| `crawler.py` | Multi-format ingestion: RSS (`feedparser`), HTML (`trafilatura` + `BeautifulSoup4`), PDF (`Playwright`) |
| `ai_service.py` | Google Gemini integration — language detection, translation, relevance scoring, sentiment, tag/entity extraction |
| `clustering.py` | Groups related articles into `Story` objects with AI-generated headlines and summaries |
| `pipeline_service.py` | 5-step pipeline executor: source selection → AI processing → formatting → output config → delivery |
| `pipeline_endpoints.py` | Pipeline CRUD + library management (prompts, formatters, outputs, delivery configs) |
| `tasks.py` | Celery task wrappers for crawl/cluster/pipeline |
| `auth.py` | JWT validation; `get_current_user` dependency used on all protected routes |
| `database.py` | SQLAlchemy engine; defaults to SQLite, switches to PostgreSQL via `DATABASE_URL` env var |

### Frontend Structure

Next.js 16 App Router (`frontend/app/`). Pages: `sources/`, `stories/`, `reports/`, `pipelines/`, `settings/`. Shared components are in `app/components/`. API calls are centralized in `lib/api.ts`.

`middleware.ts` guards all routes with NextAuth; unauthenticated requests redirect to `/login`. Authentication uses Google OAuth via NextAuth with an optional `ALLOWED_EMAILS` env var allowlist.

### Key Patterns

**Multi-tenancy:** All major models carry `user_id`. Every query filters by `current_user.id` from the JWT.

**Per-user API keys:** Users supply their own Google Gemini API key (stored in DB); `ai_service.py` falls back to the system key if absent.

**Database portability:** SQLite for local dev; PostgreSQL for production. Search uses `ILIKE` (not `GLOB`) for cross-DB compatibility.

**Crawl config:** Each `Source` has a JSON `crawl_config` column controlling `max_articles`, `min_relevance`, `min_length`, `timeout`. The `SourceResponse` schema maps this to `crawl_config`.

**Pipeline library:** Reusable assets (prompts, formatting templates, output configs, delivery configs) are stored separately and referenced by pipelines, enabling composition.

**Celery + Redis:** Supports `redis://` and `rediss://` (Railway SSL). Beat schedule is defined in `celery_app.py`. Health endpoint at `/api/health/scheduler` exposes scheduler diagnostics.

**Datetime handling:** All datetimes stored as UTC. Crawlers enforce UTC-aware datetimes to prevent scheduler drift.

## Production Merge Checklist

Before merging any branch to `main`, beyond structural checks (migrations, git divergence), audit all **new code paths** for these risks:

**AI response normalization:** Any code that consumes AI output (`_execute_processing`, `ai_service.call`, clustering) must validate the type at the boundary. AI models can return JSON arrays, empty strings, or malformed JSON regardless of what the prompt asks for. Never assume `json.loads(ai_response)` returns a dict — always assert or normalize immediately after parsing.

**Type assumptions on external data:** Functions that receive data from AI, external APIs, or JSON DB columns must not assume the type. A JSON column can return `None`, a list, or a dict depending on what was stored. Any function that does `obj["key"] = value` must verify `isinstance(obj, dict)` first.

**Test coverage gap:** Dev/test pipelines with short prompts often return well-formed responses. Production pipelines with complex prompts, large article sets, or different language content can cause AI to return differently-structured output. A fix that works in dev is not proven safe for production until tested against real data.

**Pre-merge code path audit:** For every new function or significantly modified function, ask: what happens if the input is `None`, an empty list, a non-empty list, or a dict with missing keys? If any of those cases would crash, add a guard.

## Environment Variables

Key variables (see `.env` for full list):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL URL; omit for SQLite |
| `REDIS_URL` | Redis broker URL |
| `GOOGLE_CLIENT_ID/SECRET` | NextAuth Google OAuth |
| `NEXTAUTH_SECRET` | JWT signing key |
| `GOOGLE_AI_API_KEY` | System-level Gemini key |
| `RESEND_API_KEY` | Email delivery |
| `ALLOWED_EMAILS` | Comma-separated signup allowlist (optional) |
