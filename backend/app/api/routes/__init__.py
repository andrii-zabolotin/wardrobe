from fastapi import APIRouter
from .auth import router as auth_router
from .ws import router as ws_router
from .avatars import router as avatars_router
from .garments import router as garments_router
from .outfits import router as outfits_router
from .renders import router as renders_router
from .gallery import router as gallery_router

api_router = APIRouter()
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(ws_router, prefix="/ws", tags=["ws"])
api_router.include_router(avatars_router, prefix="/avatars", tags=["avatars"])
api_router.include_router(garments_router, prefix="/garments", tags=["garments"])
api_router.include_router(outfits_router, prefix="/outfits", tags=["outfits"])
api_router.include_router(renders_router, prefix="/renders", tags=["renders"])
api_router.include_router(gallery_router, prefix="/gallery", tags=["gallery"])
