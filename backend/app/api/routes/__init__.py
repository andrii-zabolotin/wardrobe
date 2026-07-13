from fastapi import APIRouter
from .auth import router as auth_router
from .ws import router as ws_router
from .avatars import router as avatars_router
from .garments import router as garments_router

api_router = APIRouter()
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(ws_router, prefix="/ws", tags=["ws"])
api_router.include_router(avatars_router, prefix="/avatars", tags=["avatars"])
api_router.include_router(garments_router, prefix="/garments", tags=["garments"])
