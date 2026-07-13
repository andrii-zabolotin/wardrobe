# Project Bible — Wardrobe Try-On

> Single source of truth. All architectural and product decisions are recorded here.
> When in doubt — read this file first.

---

## Project

AI-powered virtual wardrobe and outfit try-on, built as a portfolio project for an AI Engineer.
Users upload their photos to create a personal avatar, fill their wardrobe with clothing items detected by Gemini Vision, assemble outfits on a visual board, and generate photorealistic renders of themselves wearing those outfits.
A conversational AI stylist with function calling helps users decide what to wear by searching their actual wardrobe semantically.

---

## Goals

- Demonstrate a production-quality multi-agent Gemini pipeline: structured output, multimodal image generation (Interactions API), function calling, and vector search — all in one cohesive product.
- Deliver a working, runnable demo via Docker Compose with a visually impressive UI suitable for a portfolio.
- Keep the codebase simple, readable, and well-structured — it will be read by potential employers.

---

## Non-Goals

- CV-based virtual try-on (pose estimation, mesh warping).
- Preset/template avatars — users must upload their own photos.
- Background removal from garment crops — only avatar gets white background (BiRefNet).
- OAuth / social login / email verification.
- Persistent stylist chat history across sessions.
- Weather API integration.
- Shopping recommendations or external product links.
- Mobile application.
- Cloud deployment (local Docker Compose only).
- Multi-language support.

---

## Stack

| Layer | Choice |
|---|---|
| **Backend Runtime** | Python 3.12 |
| **Backend Framework** | FastAPI (async) |
| **Task Queue** | Celery + Redis |
| **Primary Database** | PostgreSQL 16 |
| **ORM + Migrations** | SQLAlchemy 2 (async) + Alembic |
| **Vector Database** | Qdrant |
| **Embeddings** | Gemini `text-embedding-004` |
| **AI SDK** | `google-genai` (official Python SDK) |
| **Background Removal** | BiRefNet (avatars only) |
| **Auth** | Custom: `passlib[bcrypt]` + `python-jose` (JWT) |
| **Package Manager** | `uv` |
| **Frontend Runtime** | Node 20 / TypeScript |
| **Frontend Framework** | React 19 + Vite |
| **UI Styling** | Tailwind CSS v4 + shadcn/ui |
| **State Management** | Zustand |
| **Server State / Cache** | TanStack Query v5 |
| **File Serving** | nginx (reverse proxy + `/media/` static) |
| **Container Orchestration** | Docker Compose |
| **Tests (Backend)** | pytest + pytest-asyncio |
| **Lint / Format** | ruff |
| **Typecheck (Backend)** | mypy |
| **Typecheck (Frontend)** | tsc --noEmit |

---

## Architecture

### Components

| Component | Responsibility |
|---|---|
| **FastAPI app** | HTTP API, WebSocket endpoints, auth middleware, request validation |
| **Celery worker** | Async execution of avatar generation, garment detection, and render tasks |
| **Redis** | Celery broker + Redis PubSub for real-time WS notifications |
| **PostgreSQL** | Primary persistence: users, avatars, garments, outfits, renders |
| **Qdrant** | Vector store for semantic garment search (collection `garments`, filtered by `user_id`) |
| **Detection Agent** | `gemini-2.5-flash` — structured output, detects all garments in a photo with bbox + attributes |
| **Outfit Prompt Composer** | `gemini-2.5-flash` — takes garment list + pose → generates image prompt for the render |
| **Image Generation** | `gemini-3.1-flash-image` (Interactions API) — avatar generation and outfit render |
| **Stylist Assistant** | `gemini-2.5-flash` with function calling — conversational wardrobe search and outfit assembly |
| **nginx** | Reverse proxy, serves React SPA and `/media/` static files |

### Dependency Flow

```
React SPA → FastAPI (HTTP / WebSocket) → Services → Agents (Gemini API)
                                       → PostgreSQL
                                       → Qdrant
          → Celery Worker             → Agents (Gemini API)
                                       → PostgreSQL
                                       → Qdrant
                                       → Redis PubSub → FastAPI WS → React SPA
```

### Real-time Notification Pattern

```
Celery task completes
  → Redis PUBLISH  channel: user:{user_id}:events
  → FastAPI WS handler subscribes and forwards to client
  → Browser updates UI
```

WebSocket message format:
```json
{
  "type": "avatar_ready | avatar_failed | detection_done | detection_failed | render_done | render_failed",
  "id": "<entity_id>",
  "data": {}
}
```

---

## Domain Rules

- **Garments belong to users.** A user can only read, edit, or delete their own garments. Enforced at the service layer, not only at the DB layer.
- **Avatars belong to users.** Renders reference an avatar; if the avatar is deleted, associated renders become invalid.
- **Detection saves immediately.** There is no confirm step — detected garments are persisted to DB and Qdrant right away. Users edit or delete incorrect items post-hoc.
- **Render requires user consent.** The stylist may propose a render but never triggers it automatically. The user always initiates `POST /renders`.
- **Qdrant is a projection of PostgreSQL.** Qdrant is not the source of truth. On garment create/edit/delete, PostgreSQL is written first, Qdrant second. If Qdrant sync fails, the task retries.
- **Layer order is AI-determined.** The Outfit Prompt Composer decides which garment goes over which based on category and attributes. Users do not set layer order manually.
- **Bounding boxes are stored normalized** (0.0–1.0 relative to image dimensions). Pixel coordinates are computed on-demand.
- **One active Celery task per entity.** Before starting a task, the worker checks the entity status is not already `processing`. Prevents duplicate execution on retry.

---

## Repository Structure

```
wardrobe/
├── PB.md                           ← This file
├── docker-compose.yml
├── .env.example
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── auth.py         ← register, login, logout, /me
│   │   │   │   ├── avatars.py      ← CRUD + generate endpoint
│   │   │   │   ├── garments.py     ← CRUD + detect endpoint
│   │   │   │   ├── outfits.py      ← CRUD
│   │   │   │   ├── renders.py      ← create, list, detail, save to gallery
│   │   │   │   ├── gallery.py      ← saved looks
│   │   │   │   └── stylist.py      ← WebSocket chat endpoint
│   │   │   └── deps.py             ← get_current_user, get_db, get_qdrant
│   │   ├── agents/
│   │   │   ├── detection.py        ← Detection Agent (structured output)
│   │   │   ├── outfit_composer.py  ← Outfit Prompt Composer
│   │   │   ├── image_gen.py        ← gemini-3.1-flash-image calls
│   │   │   └── stylist.py          ← Stylist with function calling loop
│   │   ├── models/                 ← SQLAlchemy ORM models
│   │   ├── schemas/                ← Pydantic request/response schemas
│   │   ├── tasks/
│   │   │   ├── celery_app.py       ← Celery instance + config
│   │   │   ├── avatar_tasks.py     ← generate_avatar_task
│   │   │   ├── detection_tasks.py  ← detection_task
│   │   │   └── render_tasks.py     ← render_task
│   │   ├── services/
│   │   │   ├── vector_store.py     ← Qdrant client, embed, upsert, delete, search
│   │   │   ├── file_storage.py     ← save/delete files under /media
│   │   │   └── birefnet.py         ← background removal (avatars only)
│   │   └── core/
│   │       ├── config.py           ← pydantic-settings (Settings singleton)
│   │       ├── security.py         ← JWT encode/decode, bcrypt hash/verify
│   │       └── database.py         ← async engine, AsyncSession factory
│   ├── alembic/                    ← DB migrations
│   ├── tests/
│   │   ├── unit/                   ← agent logic, service helpers
│   │   └── integration/            ← API routes (TestClient)
│   ├── pyproject.toml
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── AvatarsPage.tsx     ← avatar list + generation flow
│   │   │   ├── WardrobePage.tsx    ← garment grid + upload + edit/delete
│   │   │   ├── OutfitBoardPage.tsx ← visual collage board + pose picker + render
│   │   │   ├── StylistPage.tsx     ← chat interface
│   │   │   └── GalleryPage.tsx     ← saved looks
│   │   ├── components/             ← reusable UI components
│   │   ├── store/                  ← Zustand stores
│   │   ├── hooks/                  ← TanStack Query hooks (one per resource)
│   │   ├── api/                    ← typed API client functions
│   │   └── ws/                     ← WebSocket context + notification handler
│   ├── vite.config.ts
│   └── Dockerfile
│
├── media/                          ← Docker volume (gitignored)
│   ├── uploads/{user_id}/          ← original uploaded photos
│   ├── garments/{user_id}/         ← bbox crops (JPEG)
│   ├── avatars/{user_id}/
│   │   ├── sources/                ← reference photos (1–5)
│   │   └── {avatar_id}.jpg         ← generated avatar (white bg)
│   └── renders/{user_id}/          ← outfit render results
│
└── nginx/
    └── nginx.conf
```

---

## Poses (Fixed List)

| Key | Prompt Description |
|---|---|
| `studio_front` | Standing, facing camera, arms relaxed, full body — **default** |
| `studio_3q` | Standing at 3/4 angle, studio backdrop |
| `studio_casual` | Relaxed stance, hands in pockets, slight hip lean |
| `outdoor_walk` | Walking on urban street, natural daylight |
| `seated` | Seated on minimal white chair, legs crossed |

---

## Gemini Models

| Agent | Model | Temp | Why |
|---|---|---|---|
| Detection Agent | `gemini-2.5-flash` | 0.1 | Structured JSON, vision, deterministic |
| Outfit Prompt Composer | `gemini-2.5-flash` | 0.7 | Creative text, layer reasoning |
| Avatar Generation | `gemini-3.1-flash-image` | — | Multimodal image gen (Interactions API) |
| Outfit Render | `gemini-3.1-flash-image` | — | Avatar + garment crops → rendered photo |
| Stylist Assistant | `gemini-2.5-flash` | 0.5 | Function calling, in-session context |
| Embeddings | `text-embedding-004` | — | Garment semantic search |

---

## Agent Rules

- Read relevant code before editing.
- Reuse existing patterns before creating new abstractions.
- Make the smallest change that fully solves the task.
- Do not change public APIs without explicit requirement.
- Do not perform unrelated refactoring.
- Never modify Alembic-generated migration files manually — generate new ones instead.
- Run relevant tests, lint, and typecheck after every change.
- If requirements conflict or critical context is missing, report it instead of guessing.
- Do not add new dependencies without updating `pyproject.toml` and documenting the reason in the PR.
- All Gemini calls must go through `app/agents/` — never call the SDK directly from routes or tasks.
- PostgreSQL is the source of truth. Qdrant is a derived index. Write PG first, Qdrant second.

---

## Commands

### Backend
```bash
# Install dependencies
uv sync

# Run dev server
uv run fastapi dev app/main.py

# Run Celery worker
uv run celery -A app.tasks.celery_app worker --loglevel=info

# Migrations
uv run alembic upgrade head
uv run alembic revision --autogenerate -m "description"

# Tests
uv run pytest

# Lint + format
uv run ruff check .
uv run ruff format .

# Typecheck
uv run mypy app/
```

### Frontend
```bash
# Install
npm install

# Dev server
npm run dev

# Typecheck
npm run typecheck

# Lint
npm run lint

# Build
npm run build
```

### Docker
```bash
# Start everything
docker compose up --build

# Rebuild a single service
docker compose up --build api

# Run migrations inside container
docker compose exec api uv run alembic upgrade head
```

---

## Definition of Done

- Acceptance criteria from the task are fully satisfied.
- Relevant unit and integration tests pass (`uv run pytest`).
- Ruff lint and format pass with zero errors.
- mypy passes with zero errors.
- Frontend typecheck (`npm run typecheck`) passes.
- No unrelated files are modified.
- If public API shape changed — schemas updated and documented.
- If a new env variable is added — `.env.example` is updated.
- If a new DB column is added — an Alembic migration is included.

---

## Critical Constraints

- **No garment background removal.** Garment crops are raw rectangular bbox cuts. BiRefNet is used exclusively for avatars.
- **No drag-and-drop layer ordering.** Layer order in outfits is AI-determined by the Outfit Prompt Composer.
- **No persistent stylist chat history.** Conversation context lives in memory for the duration of a WebSocket session only.
- **No two-step detection confirm flow.** Detected garments are saved immediately. Edit/delete is the correction mechanism.
- **Render is user-initiated only.** The stylist may suggest a render via `trigger_render` tool but never fires `POST /renders` automatically.
- **All file paths stored as relative URLs** under `/media/` — e.g. `/media/garments/{user_id}/{id}.jpg`. No absolute OS paths in the DB.
- **JWT secret and Gemini API key must come from environment variables.** Never hardcode secrets.
- **Max upload size: 20 MB per file.**
- **Qdrant must stay in sync with PostgreSQL.** If sync fails, retry — never leave the two stores permanently out of sync.
