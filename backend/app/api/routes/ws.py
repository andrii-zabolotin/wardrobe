import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from jose import jwt, JWTError
import redis.asyncio as aioredis

from app.core.config import settings

router = APIRouter()

async def get_user_id_from_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        return payload.get("sub")
    except JWTError:
        return None

@router.websocket("/notifications")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    user_id = await get_user_id_from_token(token)
    if not user_id:
        await websocket.close(code=1008)
        return

    await websocket.accept()

    # Async Redis client for pubsub
    redis = aioredis.from_url(settings.redis_url)
    pubsub = redis.pubsub()
    channel = f"user:{user_id}:events"
    
    await pubsub.subscribe(channel)

    try:
        # We need to both listen to pubsub and handle potential client disconnects
        async def reader():
            async for message in pubsub.listen():
                if message["type"] == "message":
                    data = message["data"].decode("utf-8")
                    await websocket.send_text(data)

        async def check_disconnect():
            try:
                while True:
                    await websocket.receive_text()
            except WebSocketDisconnect:
                pass

        # Run both tasks concurrently
        read_task = asyncio.create_task(reader())
        disconnect_task = asyncio.create_task(check_disconnect())

        done, pending = await asyncio.wait(
            [read_task, disconnect_task], 
            return_when=asyncio.FIRST_COMPLETED
        )

        for task in pending:
            task.cancel()

    finally:
        await pubsub.unsubscribe(channel)
        await redis.close()
