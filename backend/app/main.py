from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.api.routes import api_router
from app.services.vector_store import init_collection

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize Qdrant collection on startup
    try:
        await init_collection()
    except Exception as e:
        print(f"Failed to initialize collection: {e}")
    yield

app = FastAPI(title="Wardrobe Try-On API", lifespan=lifespan)

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
