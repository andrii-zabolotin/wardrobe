import uuid
from datetime import datetime
from pydantic import BaseModel

class GarmentAttributes(BaseModel):
    color: str
    pattern: str
    sleeve_length: str | None
    fit: str
    material_guess: str

class GarmentStyleAttributes(BaseModel):
    warmth_level: str
    formality: str
    occasion_tags: list[str]
    season_suitability: list[str]

class GarmentResponse(BaseModel):
    id: uuid.UUID
    crop_url: str
    category: str
    attributes: GarmentAttributes
    style_attributes: GarmentStyleAttributes
    created_at: datetime

class GarmentUpdateRequest(BaseModel):
    category: str | None = None
    attributes: GarmentAttributes | None = None
    style_attributes: GarmentStyleAttributes | None = None
