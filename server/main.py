from fastapi import FastAPI, Depends, HTTPException, status
from contextlib import asynccontextmanager
from starlette.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func
import os

from config import settings
from db.base import get_session, session_scope
from db.models import Album, User, FileMetadata
from sqlalchemy.orm import Session
from dependencies import oauth2_scheme, verify_token
from routers.auth.auth_router import router as auth_router
from routers.user.user import router as user_router
from routers.album.album_routes import router as album_router
from routers.files.files_router import router as files_router
from routers.category.category import router as category_router
from routers.face.face_router import router as face_router
from routers.websocket.websocket_router import router as websocket_router
from routers.danger.danger_router import router as danger_router
from routers.video.video_router import router as video_router
from routers.client_files.client_files_router import router as client_files_router
from routers.admin.ops_router import router as ops_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 PhotoAura API starting up...")
    yield
    print("👋 PhotoAura API shutting down...")


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if settings.CORS_ORIGINS != ["*"] else ["*"],
    allow_credentials=True,
    expose_headers=["*"],
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(user_router)
app.include_router(auth_router)
app.include_router(album_router)
app.include_router(files_router)
app.include_router(websocket_router)
app.include_router(category_router)
app.include_router(face_router)
app.include_router(danger_router)
app.include_router(video_router)
app.include_router(client_files_router)
app.include_router(ops_router)
os.makedirs(settings.DATA_DIR, exist_ok=True)
app.mount("/api/static", StaticFiles(directory=settings.DATA_DIR), name="static")


@app.get("/")
async def root():
    return {"message": "PhotoAura API Root"}


@app.get("/api")
async def api_root():
    return {"message": "PhotoAura API"}


@app.get("/api/dashboard/")
async def get_dashboard(
    token: str = Depends(oauth2_scheme), session: Session = Depends(get_session)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    verify_token(token, credentials_exception)

    albums_count = session.query(func.count(Album.id)).scalar()
    users_count = session.query(func.count(User.id)).scalar()
    photos_count = session.query(func.count(FileMetadata.id)).scalar()

    return {
        "albums": albums_count,
        "users": users_count,
        "photos": photos_count,
    }
