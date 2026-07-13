import uuid
from datetime import datetime
from pydantic import BaseModel

class OutfitCreateRequest(BaseModel):
    avatar_id: uuid.UUID
    garment_ids: list[uuid.UUID]
    pose: str = "studio_front"
    name: str | None = None

class OutfitResponse(BaseModel):
    id: uuid.UUID
    avatar_id: uuid.UUID
    pose: str
    name: str | None
    created_at: datetime
