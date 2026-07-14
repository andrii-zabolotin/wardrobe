import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

class OutfitCreateRequest(BaseModel):
    avatar_id: uuid.UUID
    garment_ids: list[uuid.UUID]
    pose: str = "studio_front"
    name: str | None = None

class OutfitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    avatar_id: uuid.UUID
    pose: str
    name: str | None
    created_at: datetime
    garment_ids: list[uuid.UUID] = Field(default_factory=list)
