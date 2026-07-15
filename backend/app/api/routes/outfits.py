import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.outfit import Outfit, OutfitGarment
from app.models.user import User
from app.schemas.outfit import OutfitCreateRequest, OutfitResponse

router = APIRouter()

@router.get("", response_model=list[OutfitResponse])
async def list_outfits(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Outfit).where(Outfit.user_id == current_user.id).order_by(Outfit.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("", response_model=OutfitResponse)
async def create_outfit(
    request: OutfitCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    outfit = Outfit(
        user_id=current_user.id,
        avatar_id=request.avatar_id,
        pose=request.pose,
        name=request.name
    )
    db.add(outfit)
    await db.flush()
    
    for garment_id in request.garment_ids:
        og = OutfitGarment(outfit_id=outfit.id, garment_id=garment_id)
        db.add(og)
        
    await db.commit()
    await db.refresh(outfit)
    
    return outfit

@router.get("/{id}", response_model=OutfitResponse)
async def get_outfit(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Outfit).where(Outfit.id == id, Outfit.user_id == current_user.id)
    result = await db.execute(stmt)
    outfit = result.scalar_one_or_none()
    if not outfit:
        raise HTTPException(status_code=404, detail="Outfit not found")
    return outfit

@router.delete("/{id}")
async def delete_outfit(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Outfit).where(Outfit.id == id, Outfit.user_id == current_user.id)
    result = await db.execute(stmt)
    outfit = result.scalar_one_or_none()
    if not outfit:
        raise HTTPException(status_code=404, detail="Outfit not found")
        
    await db.delete(outfit)
    await db.commit()
    
    return {"status": "deleted"}
