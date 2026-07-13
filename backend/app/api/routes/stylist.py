import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from app.api.routes.ws import get_user_id_from_token
from app.agents.stylist import StylistSession

router = APIRouter()

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
                async for event in session.send_message(message["text"]):
                    await websocket.send_json(event)
                    
    except WebSocketDisconnect:
        pass
