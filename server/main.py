from fastapi import (
    FastAPI,
)
import os
from starlette.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from services.database import create_table, data_dir
from routers.auth.auth_router import router as auth_router
from routers.user.user import router as user_router
from routers.album.album_routes import router as album_router
from routers.files.files_router import router as files_router
from routers.category.category import router as category_router
from routers.face.face_router import router as face_router
from routers.websocket.websocket_router import router as websocket_router
from routers.danger.danger_router import router as danger_router
from services.database import get_db


app = FastAPI()
# origins = ["http://localhost:3000", "https://aura.reactiveshots.com"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
app.mount("/api/static", StaticFiles(directory=data_dir), name="static")

# wait for db to start for 10 seconds
# time.sleep(10)
create_table()

os.makedirs(data_dir, exist_ok=True)


@app.get("/")
async def root():
    return {"message": "PhotoAura API Root"}


@app.get("/api")
async def api_root():
    return {"message": "PhotoAura API"}


@app.get("/api/dashboard/")
async def get_dashboard():
    db, cursor = get_db()
    cursor.execute("SELECT * FROM album")
    albums = cursor.fetchall()

    cursor.execute("SELECT * FROM users")
    users = cursor.fetchall()

    # return number of photos
    cursor.execute("SELECT * FROM file_metadata")
    photos = cursor.fetchall()

    return {
        "albums": len(albums),
        "users": len(users),
        "photos": len(photos),
    }
