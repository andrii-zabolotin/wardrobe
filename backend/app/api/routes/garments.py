import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.user import User
from app.models.garment import Garment, SourceImage
from app.schemas.garment import GarmentResponse, GarmentUpdateRequest
from app.api.deps import get_current_user
from app.services.file_storage import save_upload, delete_file
from app.services.vector_store import delete_garment, upsert_garment
from app.tasks.detection_tasks import detection_task

router = APIRouter()

@router.get("", response_model=list[GarmentResponse])
async def list_garments(
    category: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Garment).where(Garment.user_id == current_user.id)
    if category:
        stmt = stmt.where(Garment.category == category)
    stmt = stmt.order_by(Garment.created_at.desc())
    
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("/detect")
async def detect_garments(
    files: list[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    source_image_ids = []
    
    for file in files:
        data = await file.read()
        filename = f"{uuid.uuid4()}.jpg"
        url = save_upload(str(current_user.id), "uploads", data, filename)
        
        src_img = SourceImage(user_id=current_user.id, original_url=url)
        db.add(src_img)
        await db.flush()
        source_image_ids.append(str(src_img.id))
        
    await db.commit()
    
    detection_task.delay(source_image_ids, str(current_user.id))
    
    return {"message": "Detection started", "source_image_ids": source_image_ids}

@router.get("/{id}", response_model=GarmentResponse)
async def get_garment(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Garment).where(Garment.id == id, Garment.user_id == current_user.id)
    result = await db.execute(stmt)
    garment = result.scalar_one_or_none()
    if not garment:
        raise HTTPException(status_code=404, detail="Garment not found")
    return garment

@router.patch("/{id}", response_model=GarmentResponse)
async def update_garment(
    id: uuid.UUID,
    update_data: GarmentUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Garment).where(Garment.id == id, Garment.user_id == current_user.id)
    result = await db.execute(stmt)
    garment = result.scalar_one_or_none()
    if not garment:
        raise HTTPException(status_code=404, detail="Garment not found")
        
    if update_data.category:
        garment.category = update_data.category
    if update_data.attributes:
        garment.attributes = update_data.attributes.model_dump()
    if update_data.style_attributes:
        garment.style_attributes = update_data.style_attributes.model_dump()
        
    await db.commit()
    await db.refresh(garment)
    
    # Re-embed and upsert to Qdrant
    summary = f"{garment.attributes.get('color')} {garment.attributes.get('fit')} {garment.attributes.get('material_guess')} {garment.category}. "
    summary += f"Formality: {garment.style_attributes.get('formality')}. Occasions: {', '.join(garment.style_attributes.get('occasion_tags', []))}."
    
    await upsert_garment(
        garment_id=str(garment.id),
        user_id=str(current_user.id),
        embedding_summary=summary,
        payload={
            "category": garment.category,
            "formality": garment.style_attributes.get("formality"),
            "warmth_level": garment.style_attributes.get("warmth_level"),
            "season": garment.style_attributes.get("season_suitability", []),
            "occasion_tags": garment.style_attributes.get("occasion_tags", []),
            "crop_url": garment.crop_url
        }
    )
    
    return garment

@router.delete("/{id}")
async def delete_garment_route(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Garment).where(Garment.id == id, Garment.user_id == current_user.id)
    result = await db.execute(stmt)
    garment = result.scalar_one_or_none()
    if not garment:
        raise HTTPException(status_code=404, detail="Garment not found")
        
    delete_file(garment.crop_url)
    await delete_garment(str(garment.id))
    
    await db.delete(garment)
    await db.commit()
    
    return {"status": "deleted"}
