import os
from pathlib import Path
from app.core.config import settings

def _get_abs_path(url_path: str) -> Path:
    if url_path.startswith("/media/"):
        rel_path = url_path[len("/media/"):]
        return Path(settings.media_root) / rel_path
    return Path(settings.media_root) / url_path

def save_upload(user_id: str, subfolder: str, data: bytes, filename: str) -> str:
    """Save file to media folder and return URL path"""
    dir_path = Path(settings.media_root) / subfolder / str(user_id)
    dir_path.mkdir(parents=True, exist_ok=True)
    
    file_path = dir_path / filename
    with open(file_path, "wb") as f:
        f.write(data)
        
    return f"/media/{subfolder}/{user_id}/{filename}"

def delete_file(url_path: str) -> None:
    """Delete file if it exists"""
    if not url_path:
        return
    file_path = _get_abs_path(url_path)
    if file_path.exists():
        os.remove(file_path)

def read_file_bytes(url_path: str) -> bytes:
    """Read file content"""
    file_path = _get_abs_path(url_path)
    with open(file_path, "rb") as f:
        return f.read()
