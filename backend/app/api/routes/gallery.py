from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.user import User
from app.models.render import Render
from app.schemas.render import RenderResponse
from app.api.deps import get_current_user

router = APIRouter()

@router.get("", response_model=list[RenderResponse])
async def list_gallery(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Render).where(
        Render.user_id == current_user.id,
        Render.is_saved == True
    ).order_by(Render.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()
