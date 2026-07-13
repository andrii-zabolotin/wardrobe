import asyncio
import uuid
from asgiref.sync import async_to_sync
from celery.utils.log import get_task_logger
from sqlalchemy import select

from app.tasks.celery_app import celery_app
from app.tasks.notifications import publish_ws_event
from app.core.database import AsyncSessionLocal
from app.models.garment import Garment, SourceImage
from app.services.file_storage import save_upload, read_file_bytes
from app.services.vector_store import upsert_garment
from app.agents.detection import detect_garments, crop_garment

logger = get_task_logger(__name__)

async def process_detection(source_image_ids: list[str], user_id: str) -> None:
    async with AsyncSessionLocal() as session:
        for source_image_id in source_image_ids:
            try:
                # Load original
                stmt = select(SourceImage).where(SourceImage.id == source_image_id)
                result = await session.execute(stmt)
                src_img = result.scalar_one_or_none()
                
                if not src_img:
                    continue
                    
                image_bytes = read_file_bytes(src_img.original_url)
                
                # Detect
                detection_result = await detect_garments(image_bytes)
                
                if not detection_result.garments:
                    publish_ws_event(user_id, "detection_done", source_image_id, {
                        "garments_added": 0, 
                        "message": "No garments found"
                    })
                    continue
                    
                garments_added = 0
                
                for item in detection_result.garments:
                    # Crop
                    crop_bytes = crop_garment(image_bytes, item.bounding_box)
                    
                    # Save crop
                    garment_id = str(uuid.uuid4())
                    filename = f"{garment_id}.jpg"
                    crop_url = save_upload(user_id, "garments", crop_bytes, filename)
                    
                    # Save to DB
                    garment = Garment(
                        id=garment_id,
                        user_id=user_id,
                        source_image_id=source_image_id,
                        bounding_box=item.bounding_box,
                        crop_url=crop_url,
                        category=item.category,
                        attributes={
                            "color": item.color,
                            "pattern": item.pattern,
                            "sleeve_length": item.sleeve_length,
                            "fit": item.fit,
                            "material_guess": item.material_guess
                        },
                        style_attributes=item.style_attributes.model_dump(),
                        embedding_id=garment_id
                    )
                    session.add(garment)
                    
                    # Upsert to Qdrant
                    await upsert_garment(
                        garment_id=garment_id,
                        user_id=user_id,
                        embedding_summary=item.embedding_summary,
                        payload={
                            "category": item.category,
                            "formality": item.style_attributes.formality,
                            "warmth_level": item.style_attributes.warmth_level,
                            "season": item.style_attributes.season_suitability,
                            "occasion_tags": item.style_attributes.occasion_tags,
                            "crop_url": crop_url
                        }
                    )
                    
                    garments_added += 1
                
                await session.commit()
                publish_ws_event(user_id, "detection_done", source_image_id, {
                    "garments_added": garments_added
                })
                
            except Exception as e:
                logger.error(f"Error in detection for {source_image_id}: {str(e)}")
                publish_ws_event(user_id, "detection_failed", source_image_id, {
                    "error": str(e)
                })

@celery_app.task(name="app.tasks.detection_tasks.detection_task")
def detection_task(source_image_ids: list[str], user_id: str):
    async_to_sync(process_detection)(source_image_ids, user_id)
