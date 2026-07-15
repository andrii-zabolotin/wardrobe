from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.dev_mode import get_prompt_logs, is_dev_mode, set_dev_mode

router = APIRouter(prefix="/settings", tags=["settings"])

class DevModeToggle(BaseModel):
    dev_mode: bool

@router.get("")
def get_settings():
    return {"dev_mode": is_dev_mode()}

@router.patch("")
def patch_settings(body: DevModeToggle):
    set_dev_mode(body.dev_mode)
    return {"dev_mode": is_dev_mode()}

@router.get("/logs")
def get_logs():
    if not is_dev_mode():
        raise HTTPException(status_code=403, detail="Dev mode is disabled")
    return get_prompt_logs()
