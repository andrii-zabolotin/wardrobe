# Wardrobe Try-On

AI-powered virtual wardrobe and outfit try-on — portfolio project demonstrating a production-quality multi-agent Gemini pipeline.

Users upload photos to generate a personal avatar, fill their wardrobe via Gemini Vision detection, assemble outfits on an interactive board, and generate photorealistic renders. A conversational AI stylist with function calling helps find the perfect outfit.

## Key Features

- **Avatar generation** — upload 1–5 reference photos; Gemini generates a photorealistic character sheet
- **Garment detection** — upload clothing images; Gemini Vision detects, crops, and categorizes each item with bounding boxes
- **Outfit board** — drag-and-drop outfit assembly with pose selection
- **AI render** — Gemini image generation produces a photorealistic photo of the avatar wearing the outfit
- **Stylist chat** — WebSocket-based conversational assistant with function calling, semantic wardrobe search (Qdrant), and outfit creation

## Architecture

```
React SPA → nginx → FastAPI (HTTP + WebSocket)
                  → Celery Worker (avatar, detection, render tasks)
                       → Gemini API (vision, image gen, embeddings)
                       → PostgreSQL (primary store)
                       → Qdrant (vector search)
                  → Redis (Celery broker + PubSub for WS notifications)
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Python 3.12, FastAPI (async), Celery + Redis |
| Database | PostgreSQL 16, SQLAlchemy 2 (async) + Alembic |
| Vector DB | Qdrant |
| AI | Google Gemini (`gemini-3-flash-preview`, `gemini-3.1-flash-image`, `text-embedding-004`) |
| Auth | JWT (python-jose) + bcrypt |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, Zustand, TanStack Query v5 |
| Infra | nginx, Docker Compose |

## Quickstart

### Prerequisites
- Docker and Docker Compose
- A Google Gemini API key

### Setup

```bash
git clone <repo>
cd wardrobe
cp .env.example .env
# Edit .env — set GEMINI_API_KEY and JWT_SECRET
docker compose up --build
```

Open [http://localhost](http://localhost).

| Endpoint | URL |
|----------|-----|
| App | http://localhost |
| API docs | http://localhost:8000/docs |

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | ✅ | Google Gemini API key |
| `JWT_SECRET` | ✅ | Secret for signing JWT tokens |
| `DATABASE_URL` | — | Defaults to local PostgreSQL |
| `REDIS_URL` | — | Defaults to local Redis |
| `QDRANT_URL` | — | Defaults to local Qdrant |
| `MAX_UPLOAD_SIZE_MB` | — | Default: 20 |
| `DEV_MODE` | — | Enables prompt logging; skips Gemini API calls |
| `JWT_EXPIRE_MINUTES` | — | Default: 10080 (7 days) |

## Local Development (without Docker)

```bash
# Backend
cd backend
uv sync
uv run alembic upgrade head
uv run fastapi dev app/main.py
# In a separate terminal:
uv run celery -A app.tasks.celery_app worker --loglevel=info

# Frontend
cd frontend
npm ci && npm run dev
```

## Project Structure

```
backend/app/
├── agents/       # All Gemini API calls (detection, image gen, stylist, composer)
├── api/routes/   # FastAPI route handlers — thin, delegate to services/tasks
├── core/         # Config, database, security, dev mode
├── models/       # SQLAlchemy ORM models
├── schemas/      # Pydantic request/response schemas
├── services/     # Qdrant vector store, file storage
└── tasks/        # Celery tasks (avatar, detection, render) + Redis notifications
```

## Design Decisions

- **All Gemini calls are in `agents/`** — routes and tasks never touch the SDK directly
- **Celery for long-running AI tasks** — avatar generation and renders can take 10–30 seconds; async tasks prevent HTTP timeout
- **Redis PubSub for real-time notifications** — Celery workers publish events; FastAPI WebSocket handlers forward them to the browser
- **PostgreSQL is the source of truth; Qdrant is a derived index** — garments are written to PG first, then Qdrant
- **Bounding boxes stored normalized** (0.0–1.0) — pixel coordinates computed on demand
- **JWT passed as query param for WebSocket auth** — browsers do not support `Authorization` headers for WebSocket connections
- **Celery worker creates its own SQLAlchemy engine** — avoids asyncpg connection reuse across event loop boundaries when using `async_to_sync`

## Known Limitations

- BiRefNet background removal is stubbed (returns original image) — would require a separate GPU service in production
- No persistent stylist chat history across sessions
- Single-user demo; no rate limiting or multi-tenancy hardening

## Usage Flow

1. **Register / Login**
2. **Avatars** — upload reference photos to generate your digital twin
3. **Wardrobe** — upload clothing; AI detects and categorizes each garment
4. **Outfit Board** — assemble an outfit, select a pose
5. **Stylist** — chat with your AI stylist to get outfit recommendations
6. **Gallery** — view renders and save your favorites
