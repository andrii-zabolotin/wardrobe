import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.user import User
from app.models.avatar import Avatar, AvatarSourceImage
from app.schemas.avatar import AvatarResponse
from app.api.deps import get_current_user
from app.services.file_storage import save_upload, delete_file
from app.tasks.avatar_tasks import generate_avatar_task

router = APIRouter()

@router.get("", response_model=list[AvatarResponse])
async def list_avatars(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Avatar).where(Avatar.user_id == current_user.id).order_by(Avatar.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("/generate")
async def generate_avatar(
    files: list[UploadFile] = File(...),
    custom_prompt: str = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if len(files) < 1 or len(files) > 5:
        raise HTTPException(status_code=400, detail="Must provide between 1 and 5 reference images")
        
    avatar = Avatar(user_id=current_user.id, status="pending")
    db.add(avatar)
    await db.flush()
    
    for file in files:
        data = await file.read()
        filename = f"{uuid.uuid4()}.jpg"
        url = save_upload(str(current_user.id), "avatars/sources", data, filename)
        
        src_img = AvatarSourceImage(avatar_id=avatar.id, file_url=url)
        db.add(src_img)
        
    await db.commit()
    await db.refresh(avatar)
    
    generate_avatar_task.delay(str(avatar.id), custom_prompt)
    
    return {"avatar_id": avatar.id, "status": avatar.status}

@router.get("/{id}", response_model=AvatarResponse)
async def get_avatar(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Avatar).where(Avatar.id == id, Avatar.user_id == current_user.id)
    result = await db.execute(stmt)
    avatar = result.scalar_one_or_none()
    if not avatar:
        raise HTTPException(status_code=404, detail="Avatar not found")
    return avatar

@router.delete("/{id}")
async def delete_avatar(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Avatar).where(Avatar.id == id, Avatar.user_id == current_user.id)
    result = await db.execute(stmt)
    avatar = result.scalar_one_or_none()
    if not avatar:
        raise HTTPException(status_code=404, detail="Avatar not found")
        
    await db.refresh(avatar, ["source_images"])
    
    # Delete files
    if avatar.canonical_url:
        delete_file(avatar.canonical_url)
    for src in avatar.source_images:
        delete_file(src.file_url)
        
    await db.delete(avatar)
    await db.commit()
    
    return {"status": "deleted"}
