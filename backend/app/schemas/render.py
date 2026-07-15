import uuid
from datetime import datetime

from pydantic import BaseModel


class RenderCreateRequest(BaseModel):
    outfit_id: uuid.UUID

class RenderResponse(BaseModel):
    id: uuid.UUID
    outfit_id: uuid.UUID
    status: str
    result_url: str | None
    prompt_used: str | None = None
    error_message: str | None = None
    is_saved: bool
    created_at: datetime
