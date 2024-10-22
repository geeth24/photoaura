from fastapi import (
    WebSocket,
    WebSocketDisconnect,
    APIRouter,
    Depends,
    HTTPException,
    status,
)
import os
from typing import List
from fastapi.security import OAuth2PasswordBearer
from routers.auth.auth_router import verify_token

router = APIRouter()
AWS_BUCKET = os.environ.get("AWS_BUCKET")
AWS_CLOUDFRONT_URL = os.environ.get("AWS_CLOUDFRONT_URL")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


# WebSocket connection manager
class ConnectionManager:

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)


manager = ConnectionManager()


@router.websocket("/api/ws/")
async def websocket_endpoint(websocket: WebSocket, token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    verify_token(token, credentials_exception)
    await manager.connect(websocket)
    # print if connection is established
    print("connection established")
    try:
        while True:
            data = await websocket.receive_text()
            for connection in manager.active_connections:
                await manager.send_message(data, connection)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
