from fastapi import APIRouter
from .auth import router as auth_router
from .ws import router as ws_router

api_router = APIRouter()
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(ws_router, prefix="/ws", tags=["ws"])
