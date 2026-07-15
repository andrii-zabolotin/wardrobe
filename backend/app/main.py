import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import api_router
from app.services.vector_store import init_collection

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize Qdrant collection on startup
    try:
        await init_collection()
    except Exception as e:
        logger.error(f"Failed to initialize collection: {e}")
    yield

app = FastAPI(title="Wardrobe Try-On API", lifespan=lifespan)

# NOTE: CORS is configured to allow all origins ("*") for ease of local portfolio demonstration.
# In a production environment, this should be restricted to the specific frontend domain.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"message": "An internal server error occurred.", "detail": str(exc)},
    )

app.include_router(api_router, prefix="/api/v1")

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
