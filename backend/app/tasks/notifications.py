import json
import redis
from app.core.config import settings

# Create a synchronous redis client for celery tasks to use
redis_client = redis.from_url(settings.redis_url)

def publish_ws_event(user_id: str, event_type: str, entity_id: str, data: dict = None, dev_prompt: dict = None) -> None:
    """
    Publish an event to the Redis PubSub channel for a specific user.
    The WebSocket endpoint will listen to this channel and forward to the client.
    """
    if data is None:
        data = {}
        
    message = {
        "type": event_type,
        "id": str(entity_id),
        "data": data
    }
    
    if dev_prompt is not None:
        message["dev_prompt"] = dev_prompt
        
    channel = f"user:{user_id}:events"
    redis_client.publish(channel, json.dumps(message))
