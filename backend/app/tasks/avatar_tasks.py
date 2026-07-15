from asgiref.sync import async_to_sync
from celery.utils.log import get_task_logger
from sqlalchemy import select

from app.llm.image_gen import DevMockResult, generate_avatar
from app.llm.outfit_composer import describe_avatar
from app.core.database import AsyncSessionLocal
from app.models.avatar import Avatar
from app.services.birefnet import apply_white_background
from app.services.file_storage import read_file_bytes, save_upload
from app.tasks.celery_app import celery_app
from app.tasks.notifications import publish_ws_event

logger = get_task_logger(__name__)

async def process_avatar(avatar_id: str, custom_prompt: str | None = None, height: int | None = None, weight: int | None = None) -> None:
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
            raw_bytes_or_mock = await generate_avatar(paths, custom_prompt, height, weight)
            
            if isinstance(raw_bytes_or_mock, DevMockResult):
                avatar.status = "dev_mock"
                avatar.canonical_url = None
                await session.commit()
                publish_ws_event(user_id, "avatar_ready", avatar_id, {"canonical_url": None}, dev_prompt=raw_bytes_or_mock.__dict__)
                logger.info(f"Avatar {avatar_id} dev mocked")
                return

            raw_bytes = raw_bytes_or_mock
            
            # Remove background
            clean_bytes = apply_white_background(raw_bytes)
            
            # Save
            filename = f"{avatar_id}.jpg"
            url = save_upload(user_id, "avatars", clean_bytes, filename)
            
            # Describe avatar for caching
            physical_description = await describe_avatar(clean_bytes)
            
            # Update DB
            avatar.status = "ready"
            avatar.canonical_url = url
            avatar.physical_description = physical_description
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
def generate_avatar_task(avatar_id: str, custom_prompt: str | None = None, height: int | None = None, weight: int | None = None):
    async_to_sync(process_avatar)(avatar_id, custom_prompt, height, weight)

async def process_manual_avatar_async(avatar_id: str) -> None:
    async with AsyncSessionLocal() as session:
        stmt = select(Avatar).where(Avatar.id == avatar_id)
        result = await session.execute(stmt)
        avatar = result.scalar_one_or_none()
        
        if not avatar or not avatar.canonical_url:
            return
            
        try:
            image_bytes = read_file_bytes(avatar.canonical_url)
            desc = await describe_avatar(image_bytes)
            
            avatar.physical_description = desc
            await session.commit()
            
            publish_ws_event(str(avatar.user_id), "avatar_updated", str(avatar.id), {"physical_description": desc})
            logger.info(f"Avatar {avatar_id} manually described successfully")
        except Exception as e:
            logger.error(f"Error describing manual avatar {avatar_id}: {str(e)}")

@celery_app.task(name="app.tasks.avatar_tasks.process_manual_avatar_task")
def process_manual_avatar_task(avatar_id: str):
    async_to_sync(process_manual_avatar_async)(avatar_id)
