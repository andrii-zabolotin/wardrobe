# Wardrobe Try-On

AI-powered virtual wardrobe and outfit try-on — portfolio project demonstrating a production-quality multi-agent Gemini pipeline.

Users upload photos to generate a personal avatar, fill their wardrobe via Gemini Vision detection, assemble outfits on an interactive board, and generate photorealistic renders. A conversational AI stylist with function calling helps find the perfect outfit.

---

## 1. Key Features

- **Avatar Generation** — upload 1–5 reference photos; Gemini generates a photorealistic character sheet.
- **Garment Detection** — upload clothing images; Gemini Vision detects, crops, and categorizes each item with bounding boxes.
- **Outfit Board** — drag-and-drop outfit assembly with pose selection.
- **AI Render** — Gemini image generation produces a photorealistic photo of the avatar wearing the outfit.
- **Stylist Chat** — WebSocket-based conversational assistant with function calling, semantic wardrobe search (Qdrant), and outfit creation.

---

## 2. Architecture

```
React SPA → nginx → FastAPI (HTTP + WebSocket)
                  → Celery Worker (avatar, detection, render tasks)
                       → Gemini API (vision, image gen, embeddings)
                       → PostgreSQL (primary store)
                       → Qdrant (vector search)
                  → Redis (Celery broker + PubSub for WS notifications)
```

- **Celery for long-running AI tasks:** Avatar generation and renders can take 10–30 seconds. Offloading these to Celery prevents HTTP timeouts and keeps the API responsive.
- **Redis PubSub for real-time notifications:** Celery workers publish processing updates and completion events to Redis. FastAPI WebSocket handlers subscribe to these channels and immediately push updates to the browser.
- **PostgreSQL is the source of truth, Qdrant is a derived index:** Garments are written to Postgres first to guarantee data integrity, then indexed into Qdrant for semantic search.

---

## 3. Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Python 3.12, FastAPI (async), Celery + Redis |
| **Database** | PostgreSQL 16, SQLAlchemy 2 (async) + Alembic |
| **Vector DB** | Qdrant |
| **AI** | Google Gemini (`gemini-3-flash-preview`, `gemini-3.1-flash-image`, `gemini-embedding-2`) |
| **Auth** | JWT (python-jose) + bcrypt |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, Zustand, TanStack Query v5 |
| **Infra** | nginx, Docker Compose |

---

## 4. Quickstart

### Prerequisites
- Docker and Docker Compose
- A Google Gemini API key ([get one here](https://aistudio.google.com/))

### Setup

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd wardrobe
   ```

2. Copy and configure the environment variables:
   ```bash
   cp .env.example .env
   # Edit .env and set GEMINI_API_KEY and JWT_SECRET
   ```

3. Spin up the containers:
   ```bash
   docker compose up --build
   ```

| Endpoint | URL |
|----------|-----|
| **App** | [http://localhost](http://localhost) |
| **API docs** | [http://localhost:8000/docs](http://localhost:8000/docs) |

---

## 5. Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | ✅ | — | Google Gemini API key |
| `JWT_SECRET` | ✅ | — | Secret for signing JWT tokens |
| `DATABASE_URL` | — | `postgresql+asyncpg://postgres:postgres@postgres:5432/wardrobe` | Database connection URL |
| `REDIS_URL` | — | `redis://redis:6379/0` | Redis connection URL |
| `QDRANT_URL` | — | `http://qdrant:6333` | Qdrant connection URL |
| `MAX_UPLOAD_SIZE_MB` | — | `20` | Maximum file upload size limit |
| `DEV_MODE` | — | `false` | Skips Gemini API calls and mocks results |
| `JWT_EXPIRE_MINUTES` | — | `10080` | JWT expiration limit (7 days) |

---

## 6. Local Development (without Docker)

### Backend

1. Install dependencies and activate the virtual environment:
   ```bash
   cd backend
   uv sync
   ```

2. Run database migrations:
   ```bash
   uv run alembic upgrade head
   ```

3. Start the FastAPI development server:
   ```bash
   uv run fastapi dev app/main.py
   ```

4. In a separate terminal, start the Celery worker:
   ```bash
   uv run celery -A app.tasks.celery_app worker --loglevel=info
   ```

### Frontend

1. Install frontend packages and start the Vite dev server:
   ```bash
   cd frontend
   npm ci
   npm run dev
   ```

---

## 7. Project Structure

```
backend/app/
├── agents/       # Gemini API wrappers (detection, image gen, stylist, outfit composer)
├── api/routes/   # FastAPI endpoint routers (thin layer, delegates to services/tasks)
├── core/         # Settings, database, security, and dev mode tools
├── models/       # SQLAlchemy ORM model definitions
├── schemas/      # Pydantic request/response validation schemas
├── services/     # Qdrant vector store integrations, local file storage
└── tasks/        # Celery asynchronous tasks + Redis WS notification publishers
```

---

## 8. Design Decisions

- **Strict Agent Separation:** All Gemini SDK calls are isolated within `app/agents/`. Route handlers and Celery tasks never interact with the AI models directly, ensuring clean boundaries.
- **Asynchronous Task Architecture:** Since generating avatars or rendering try-ons takes 10–30 seconds, these operations are processed by Celery to avoid locking HTTP connections.
- **PubSub Event Dispatching:** Celery workers run in separate OS processes and cannot easily share state with the FastAPI ASGI process. Redis PubSub bridges this gap, allowing tasks to publish events that WebSockets immediately forward.
- **Database Engine Separation:** The Celery tasks spawn a dedicated database engine instead of sharing the API connection pool to prevent event loop reuse conflicts inside `async_to_sync` blocks.
- **WebSocket Auth via Query Params:** Standard browser WebSocket client APIs do not support setting custom headers (like `Authorization: Bearer`). To bypass this, JWT tokens are securely verified from query parameters on socket upgrade.
- **Normalized Bounding Boxes:** Bounding boxes returned by Gemini are stored as normalized ratios (0.0–1.0) and denormalized based on the container image size at runtime, ensuring crop safety.

---

## 9. Known Limitations

- **BiRefNet Stub:** Background removal is currently stubbed to return the original bytes. Running native background removal would require a separate GPU container, which is omitted for local deployment simplicity.
- **Ephemeral Stylist History:** Conversation logs for the AI Stylist are kept in-memory for the current WebSocket session and do not persist to a database.
- **Single-Tenant Hardening:** Rate limiting and multi-tenancy access-level isolation are omitted to focus on the core AI pipeline.

---

## 10. Future Roadmap

- **External Background Removal:** Connect the BiRefNet stub to a lightweight serverless GPU endpoint (e.g., RunPod or Replicate).
- **Persistent Chat History:** Move stylist conversation storage to PostgreSQL or Redis JSON cache for cross-session recovery.
- **CI/CD Integration:** Configure GitHub Actions for running Ruff, Mypy type-checking, and pytest suites.
- **Rate Limiting:** Secure routes and WebSocket endpoints with slow-limits using a Redis token-bucket system.
