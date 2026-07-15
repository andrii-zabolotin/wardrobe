from asgiref.sync import async_to_sync
from celery.utils.log import get_task_logger
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.agents.image_gen import DevMockResult, generate_outfit_render
from app.agents.outfit_composer import (
    ComposerGarmentInfo,
    OutfitComposerInput,
    compose_outfit_prompt,
    describe_avatar,
)
from app.core.database import AsyncSessionLocal
from app.models.outfit import Outfit, OutfitGarment
from app.models.render import Render
from app.services.file_storage import read_file_bytes, save_upload
from app.tasks.celery_app import celery_app
from app.tasks.notifications import publish_ws_event

logger = get_task_logger(__name__)

async def process_render(render_id: str) -> None:
    async with AsyncSessionLocal() as session:
        # Load render
        stmt = select(Render).options(
            selectinload(Render.outfit).selectinload(Outfit.garments).selectinload(OutfitGarment.garment),
            selectinload(Render.outfit).selectinload(Outfit.avatar)
        ).where(Render.id == render_id)
        
        result = await session.execute(stmt)
        render = result.scalar_one_or_none()
        
        if not render or render.status == "processing":
            logger.info(f"Render {render_id} not found or already processing")
            return
            
        render.status = "processing"
        await session.commit()
        
        user_id = str(render.user_id)
        
        try:
            outfit = render.outfit
            avatar = outfit.avatar
            garments = [og.garment for og in outfit.garments]
            
            if not avatar.canonical_url:
                raise ValueError("Avatar is not ready yet")
                
            avatar_desc = avatar.physical_description
            if not avatar_desc:
                # Fallback for older avatars without cached description
                avatar_bytes = read_file_bytes(avatar.canonical_url)
                avatar_desc = await describe_avatar(avatar_bytes)
                # We optionally could save it here, but avatar might not be in session properly for update, so just use it.
            
            # Compose prompt
            garment_infos = [
                ComposerGarmentInfo(
                    category=g.category,
                    color=g.attributes.get("color", ""),
                    pattern=g.attributes.get("pattern", ""),
                    fit=g.attributes.get("fit", ""),
                    material_guess=g.attributes.get("material_guess", ""),
                    formality=g.style_attributes.get("formality", "")
                )
                for g in garments
            ]
            
            input_data = OutfitComposerInput(
                avatar_description=avatar_desc,
                garments=garment_infos,
                pose=outfit.pose
            )
            
            garment_paths = [g.crop_url for g in garments]
            garment_bytes = [read_file_bytes(p) for p in garment_paths]
            
            prompt_result = await compose_outfit_prompt(input_data, garment_bytes)
            
            # Render
            garment_paths = [g.crop_url for g in garments]
            render_bytes_or_mock = await generate_outfit_render(
                avatar.canonical_url,
                garment_paths,
                prompt_result.image_prompt
            )
            
            if isinstance(render_bytes_or_mock, DevMockResult):
                render.status = "dev_mock"
                render.result_url = None
                render.prompt_used = prompt_result.image_prompt
                await session.commit()
                publish_ws_event(user_id, "render_done", render_id, {"result_url": None}, dev_prompt=render_bytes_or_mock.__dict__)
                logger.info(f"Render {render_id} dev mocked")
                return
                
            render_bytes = render_bytes_or_mock
            
            # Save
            filename = f"{render_id}.jpg"
            url = save_upload(user_id, "renders", render_bytes, filename)
            
            # Update DB
            render.status = "done"
            render.result_url = url
            render.prompt_used = prompt_result.image_prompt
            await session.commit()
            
            # Notify
            publish_ws_event(user_id, "render_done", render_id, {"result_url": url})
            logger.info(f"Render {render_id} completed successfully")
            
        except Exception as e:
            logger.error(f"Error processing render {render_id}: {str(e)}")
            render.status = "failed"
            render.error_message = str(e)
            await session.commit()
            publish_ws_event(user_id, "render_failed", render_id, {"error": str(e)})

@celery_app.task(name="app.tasks.render_tasks.render_task")
def render_task(render_id: str):
    async_to_sync(process_render)(render_id)
