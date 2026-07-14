# Project Bible — Wardrobe Try-On

> Single source of truth. Read this file first, every time.

---

## Project

AI-powered virtual wardrobe and outfit try-on — portfolio project for an AI Engineer.
Users upload photos to create a personal avatar, fill their wardrobe via Gemini Vision detection, assemble outfits on a visual board, and generate photorealistic renders wearing those outfits. A conversational AI stylist with function calling helps users decide what to wear by searching their wardrobe semantically.

**Goals**
- Demonstrate a production-quality multi-agent Gemini pipeline: structured output, multimodal image generation (Interactions API), function calling, vector search — all in one cohesive product.
- Runnable demo via Docker Compose with a visually impressive UI suitable for a portfolio.
- Codebase is simple, readable, and well-structured — it will be read by potential employers.

**Non-Goals**
- CV-based virtual try-on (pose estimation, mesh warping)
- Preset/template avatars — users must upload their own photos
- Background removal from garment crops (BiRefNet is for avatars only)
- OAuth / social login / email verification
- Persistent stylist chat history across sessions
- Weather API, shopping recommendations, external product links
- Mobile app, cloud deployment, multi-language support

---

## Stack

| Layer | Choice |
|---|---|
| **Backend** | Python 3.12, FastAPI (async), Celery + Redis |
| **Database** | PostgreSQL 16, SQLAlchemy 2 (async) + Alembic |
| **Vector DB** | Qdrant |
| **AI SDK** | `google-genai` (official Python SDK) |
| **Background Removal** | BiRefNet (avatars only) |
| **Auth** | `passlib[bcrypt]` + `python-jose` (JWT) |
| **Package Manager** | `uv` |
| **Frontend** | Node 20 / TypeScript, React 19 + Vite |
| **UI** | Tailwind CSS v4 + shadcn/ui, Zustand, TanStack Query v5 |
| **Infra** | nginx (reverse proxy + `/media/` static), Docker Compose |
| **Quality** | pytest + pytest-asyncio, ruff, mypy, tsc --noEmit |

---

## Architecture

### Components

| Component | Responsibility |
|---|---|
| **FastAPI app** | HTTP API, WebSocket endpoints, auth middleware, request validation |
| **Celery worker** | Async execution: avatar generation, garment detection, render tasks |
| **Redis** | Celery broker + PubSub for real-time WS notifications |
| **PostgreSQL** | Primary persistence: users, avatars, garments, outfits, renders |
| **Qdrant** | Vector store for semantic garment search (collection `garments`, filtered by `user_id`) |
| **Detection Agent** | `gemini-2.5-flash` — structured output, detects garments with bbox + attributes |
| **Outfit Prompt Composer** | `gemini-2.5-flash` — garment list + pose → image prompt |
| **Image Generation** | `gemini-3.1-flash-image` (Interactions API) — avatar generation and outfit render |
| **Stylist Assistant** | `gemini-2.5-flash` with function calling — conversational wardrobe search |
| **nginx** | Reverse proxy, serves React SPA and `/media/` static files |

### Data Flow

```
React SPA → FastAPI (HTTP / WebSocket) → Services → Agents (Gemini API)
                                       → PostgreSQL
                                       → Qdrant
          → Celery Worker             → Agents (Gemini API)
                                       → PostgreSQL / Qdrant
                                       → Redis PubSub → FastAPI WS → React SPA
```

### Real-time Notifications (Redis PubSub)

```
Celery task completes
  → PUBLISH  channel: user:{user_id}:events
  → FastAPI WS handler forwards to client
  → Browser updates UI
```

WebSocket message format:
```json
{ "type": "avatar_ready | avatar_failed | detection_done | detection_failed | render_done | render_failed", "id": "<entity_id>", "data": {} }
```

---

## Domain Rules

- **Ownership enforced at service layer.** Users can only read/edit/delete their own garments, avatars, and renders.
- **Detection saves immediately.** No confirm step — garments are persisted to DB and Qdrant right away. Edit/delete is the correction mechanism.
- **Render is user-initiated only.** The stylist may propose a render via `trigger_render` tool but never fires `POST /renders` automatically.
- **PostgreSQL is the source of truth. Qdrant is a derived index.** Write PG first, Qdrant second. If Qdrant sync fails, retry — never leave stores permanently out of sync.
- **Layer order is AI-determined.** The Outfit Prompt Composer decides garment layering. Users do not set layer order manually.
- **Bounding boxes stored normalized** (0.0–1.0 relative to image dimensions). Pixel coordinates computed on-demand.
- **One active Celery task per entity.** Worker checks entity status ≠ `processing` before starting. Prevents duplicate execution on retry.
- **File paths stored as relative URLs** under `/media/` — e.g. `/media/garments/{user_id}/{id}.jpg`. No absolute OS paths in DB.
- **Secrets from environment only.** JWT secret and Gemini API key must never be hardcoded.
- **Max upload size: 20 MB per file.**

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

## Poses

| Key | Description |
|---|---|
| `studio_front` | Standing, facing camera, arms relaxed, full body — **default** |
| `studio_3q` | Standing at 3/4 angle, studio backdrop |
| `studio_casual` | Relaxed stance, hands in pockets, slight hip lean |
| `outdoor_walk` | Walking on urban street, natural daylight |
| `seated` | Seated on minimal white chair, legs crossed |

---

## Repository Structure

```
wardrobe/
├── PB.md
├── docker-compose.yml
├── .env.example
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── auth.py         ← register, login, logout, /me
│   │   │   │   ├── avatars.py      ← CRUD + generate
│   │   │   │   ├── garments.py     ← CRUD + detect
│   │   │   │   ├── outfits.py      ← CRUD
│   │   │   │   ├── renders.py      ← create, list, detail, save to gallery
│   │   │   │   ├── gallery.py      ← saved looks
│   │   │   │   └── stylist.py      ← WebSocket chat
│   │   │   └── deps.py             ← get_current_user, get_db, get_qdrant
│   │   ├── agents/
│   │   │   ├── detection.py        ← Detection Agent (structured output)
│   │   │   ├── outfit_composer.py  ← Outfit Prompt Composer
│   │   │   ├── image_gen.py        ← gemini-3.1-flash-image calls
│   │   │   └── stylist.py          ← Stylist with function calling loop
│   │   ├── models/                 ← SQLAlchemy ORM models
│   │   ├── schemas/                ← Pydantic request/response schemas
│   │   ├── tasks/
│   │   │   ├── celery_app.py
│   │   │   ├── avatar_tasks.py
│   │   │   ├── detection_tasks.py
│   │   │   └── render_tasks.py
│   │   ├── services/
│   │   │   ├── vector_store.py     ← Qdrant: embed, upsert, delete, search
│   │   │   ├── file_storage.py     ← save/delete files under /media
│   │   │   └── birefnet.py         ← background removal (avatars only)
│   │   └── core/
│   │       ├── config.py           ← pydantic-settings (Settings singleton)
│   │       ├── security.py         ← JWT, bcrypt
│   │       └── database.py         ← async engine, AsyncSession factory
│   ├── alembic/
│   ├── tests/
│   │   ├── unit/
│   │   └── integration/
│   ├── pyproject.toml
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── AvatarsPage.tsx
│   │   │   ├── WardrobePage.tsx
│   │   │   ├── OutfitBoardPage.tsx
│   │   │   ├── StylistPage.tsx
│   │   │   └── GalleryPage.tsx
│   │   ├── components/
│   │   ├── store/                  ← Zustand
│   │   ├── hooks/                  ← TanStack Query (one per resource)
│   │   ├── api/                    ← typed API client
│   │   └── ws/                     ← WebSocket context + notifications
│   ├── vite.config.ts
│   └── Dockerfile
│
├── media/                          ← Docker volume (gitignored)
│   ├── uploads/{user_id}/
│   ├── garments/{user_id}/
│   ├── avatars/{user_id}/
│   │   ├── sources/
│   │   └── {avatar_id}.jpg
│   └── renders/{user_id}/
│
└── nginx/
    └── nginx.conf
```

---

## Commands

```bash
# Backend (run from backend/)
uv sync
uv run fastapi dev app/main.py
uv run celery -A app.tasks.celery_app worker --loglevel=info
uv run alembic upgrade head
uv run alembic revision --autogenerate -m "description"
uv run pytest
uv run ruff check . && uv run ruff format .
uv run mypy app/

# Frontend (run from frontend/)
npm install && npm run dev
npm run typecheck && npm run lint && npm run build

# Docker
docker compose up --build
docker compose up --build api
docker compose exec api uv run alembic upgrade head
```

---

## Agent Working Rules

1. Read relevant code before editing. Reuse existing patterns.
2. Make the smallest change that fully solves the task. No unrelated refactoring.
3. Do not change public APIs without explicit requirement.
4. Never modify Alembic-generated migration files — generate new ones.
5. All Gemini calls go through `app/agents/` only — never call the SDK from routes or tasks.
6. New dependencies must update `pyproject.toml` and include a reason in the PR.
7. After every change: run tests, lint, typecheck. Report conflicts instead of guessing.

## Definition of Done

- [ ] Acceptance criteria fully satisfied
- [ ] `uv run pytest` passes
- [ ] `uv run ruff check .` — zero errors
- [ ] `uv run mypy app/` — zero errors
- [ ] `npm run typecheck` passes
- [ ] No unrelated files modified
- [ ] Public API change → schemas updated
- [ ] New env var → `.env.example` updated
- [ ] New DB column → Alembic migration included
