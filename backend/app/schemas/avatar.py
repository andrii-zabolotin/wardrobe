import uuid
from datetime import datetime
from pydantic import BaseModel

class AvatarGenerateRequest(BaseModel):
    custom_prompt: str | None = None

class AvatarResponse(BaseModel):
    id: uuid.UUID
    canonical_url: str | None
    status: str
    physical_description: str | None = None
    created_at: datetime
