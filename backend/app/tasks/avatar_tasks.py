import asyncio
from asgiref.sync import async_to_sync
from celery.utils.log import get_task_logger

from app.tasks.celery_app import celery_app
from app.tasks.notifications import publish_ws_event
from app.core.database import AsyncSessionLocal
from app.models.avatar import Avatar
from app.services.file_storage import save_upload
from app.services.birefnet import apply_white_background
from app.agents.image_gen import generate_avatar
from sqlalchemy import select

logger = get_task_logger(__name__)

async def process_avatar(avatar_id: str, custom_prompt: str | None = None) -> None:
    async with AsyncSessionLocal() as session:
        # Load avatar
        stmt = select(Avatar).where(Avatar.id == avatar_id)
        result = await session.execute(stmt)
        avatar = result.scalar_one_or_none()
        
        if not avatar or avatar.status == "processing":
            logger.info(f"Avatar {avatar_id} not found or already processing")
            return
            
        avatar.status = "processing"
        await session.commit()
        
        user_id = str(avatar.user_id)
        
        try:
            # Load source paths
            await session.refresh(avatar, ["source_images"])
            paths = [img.file_url for img in avatar.source_images]
            
            # Generate image
            raw_bytes = await generate_avatar(paths, custom_prompt)
            
            # Remove background
            clean_bytes = apply_white_background(raw_bytes)
            
            # Save
            filename = f"{avatar_id}.jpg"
            url = save_upload(user_id, "avatars", clean_bytes, filename)
            
            # Update DB
            avatar.status = "ready"
            avatar.canonical_url = url
            await session.commit()
            
            # Notify
            publish_ws_event(user_id, "avatar_ready", avatar_id, {"canonical_url": url})
            logger.info(f"Avatar {avatar_id} generated successfully")
            
        except Exception as e:
            logger.error(f"Error processing avatar {avatar_id}: {str(e)}")
            avatar.status = "failed"
            await session.commit()
            publish_ws_event(user_id, "avatar_failed", avatar_id, {"error": str(e)})

@celery_app.task(name="app.tasks.avatar_tasks.generate_avatar_task")
def generate_avatar_task(avatar_id: str, custom_prompt: str = None):
    async_to_sync(process_avatar)(avatar_id, custom_prompt)
