import json
import logging
import os
from datetime import UTC, datetime

import redis

from app.core.config import settings

logger = logging.getLogger(__name__)
DEV_MODE_FILE = os.path.join(settings.media_root, ".dev_mode")

def is_dev_mode() -> bool:
    if os.path.exists(DEV_MODE_FILE):
        try:
            with open(DEV_MODE_FILE) as f:
                return f.read().strip() == "1"
        except Exception:
            pass
    return settings.dev_mode

def set_dev_mode(value: bool) -> None:
    os.makedirs(settings.media_root, exist_ok=True)
    with open(DEV_MODE_FILE, "w") as f:
        f.write("1" if value else "0")

def append_prompt_log(log_data: dict) -> None:
    try:
        r = redis.from_url(settings.redis_url)
        log_data["timestamp"] = datetime.now(UTC).isoformat()
        r.lpush("dev:prompt_logs", json.dumps(log_data))
        r.ltrim("dev:prompt_logs", 0, 19)
    except Exception as e:
        logger.error(f"Error appending prompt log: {e}")

def get_prompt_logs() -> list:
    try:
        r = redis.from_url(settings.redis_url)
        logs = r.lrange("dev:prompt_logs", 0, 19)
        return [json.loads(log) for log in logs]
    except Exception as e:
        logger.error(f"Error getting prompt logs: {e}")
        return []
