# Wardrobe Try-On MVP

A full-stack application for digital wardrobe management, AI-powered outfit creation, and photorealistic try-on rendering.

## Architecture

- **Backend**: FastAPI (Python), Celery (Background Tasks), PostgreSQL (Relational DB), Qdrant (Vector DB), Redis (Task Broker / PubSub).
- **Frontend**: React, Vite, Tailwind CSS v4, Zustand, React Query.
- **AI Pipelines**: Google Gemini `gemini-2.5-flash` (Detection & Stylist), `gemini-3.1-flash-image` (Image Generation).

## Setup & Running

1. Clone the repository.
2. Copy `.env.example` to `.env` and fill in your `GEMINI_API_KEY`.
   ```bash
   cp .env.example .env
   ```
3. Run the application via Docker Compose:
   ```bash
   docker compose up --build
   ```
4. Access the application:
   - Frontend: `http://localhost:80`
   - API: `http://localhost:80/api/v1`
   - Interactive API Docs: `http://localhost:8000/docs`

## Usage Flow

1. **Register/Login**.
2. **Avatars**: Upload 1-5 reference photos to generate your digital twin.
3. **Wardrobe**: Upload your clothes. The system uses AI vision to crop, categorize, and tag them.
4. **Outfit Board**: Mix and match items on an interactive board, select a pose, and save the outfit.
5. **Stylist**: Chat with your AI personal stylist to find the perfect outfit for any occasion.
6. **Gallery**: View photorealistic renders of your outfits and save your favorites.
