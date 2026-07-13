import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.user import User
from app.models.render import Render
from app.schemas.render import RenderCreateRequest, RenderResponse
from app.api.deps import get_current_user
from app.services.file_storage import delete_file
from app.tasks.render_tasks import render_task

router = APIRouter()

@router.get("", response_model=list[RenderResponse])
async def list_renders(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Render).where(Render.user_id == current_user.id).order_by(Render.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("", response_model=RenderResponse)
async def create_render(
    request: RenderCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    render = Render(user_id=current_user.id, outfit_id=request.outfit_id, status="pending")
    db.add(render)
    await db.commit()
    await db.refresh(render)
    
    render_task.delay(str(render.id))
    
    return render

@router.get("/{id}", response_model=RenderResponse)
async def get_render(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Render).where(Render.id == id, Render.user_id == current_user.id)
    result = await db.execute(stmt)
    render = result.scalar_one_or_none()
    if not render:
        raise HTTPException(status_code=404, detail="Render not found")
    return render

@router.patch("/{id}/save", response_model=RenderResponse)
async def toggle_save_render(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Render).where(Render.id == id, Render.user_id == current_user.id)
    result = await db.execute(stmt)
    render = result.scalar_one_or_none()
    if not render:
        raise HTTPException(status_code=404, detail="Render not found")
        
    render.is_saved = not render.is_saved
    await db.commit()
    await db.refresh(render)
    return render

@router.delete("/{id}")
async def delete_render(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Render).where(Render.id == id, Render.user_id == current_user.id)
    result = await db.execute(stmt)
    render = result.scalar_one_or_none()
    if not render:
        raise HTTPException(status_code=404, detail="Render not found")
        
    if render.result_url:
        delete_file(render.result_url)
        
    await db.delete(render)
    await db.commit()
    
    return {"status": "deleted"}
