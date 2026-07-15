import json
import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.agents.stylist import StylistSession
from app.api.routes.ws import get_user_id_from_token

router = APIRouter()
logger = logging.getLogger(__name__)

# NOTE: Pass JWT token via query parameter since standard browser WebSocket client APIs
# do not support custom request headers (like Authorization: Bearer).
@router.websocket("")
async def stylist_websocket(websocket: WebSocket, token: str = Query(...), avatar_id: str | None = Query(None)):
    user_id = await get_user_id_from_token(token)
    if not user_id:
        await websocket.close(code=1008)
        return

    await websocket.accept()
    
    session = StylistSession(user_id=user_id, active_avatar_id=avatar_id)

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if "text" in message:
                logger.debug(f"Received message from user: {message['text']}")
                async for event in session.send_message(message["text"]):
                    logger.debug(f"Sending event to user: {event}")
                    await websocket.send_json(event)
                    
    except WebSocketDisconnect:
        pass

