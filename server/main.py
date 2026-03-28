from fastapi import FastAPI, Depends, HTTPException, status
from contextlib import asynccontextmanager
from starlette.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from config import settings
from services.database import create_table
from dependencies import oauth2_scheme, verify_token
from routers.auth.auth_router import router as auth_router
from routers.user.user import router as user_router
from routers.album.album_routes import router as album_router
from routers.files.files_router import router as files_router
from routers.category.category import router as category_router
from routers.face.face_router import router as face_router
from routers.websocket.websocket_router import router as websocket_router
from routers.danger.danger_router import router as danger_router
from routers.booking.booking_router import router as booking_router
from routers.video.video_router import router as video_router
from routers.event.event_router import router as event_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("🚀 PhotoAura API starting up...")

    # Run the blur data URL migration
    try:
        from migration_blur_data_url import migrate_blur_data_urls

        print("🔄 Running blur data URL migration...")
        migrate_blur_data_urls()
        print("✅ Migration completed!")
    except Exception as e:
        print(f"⚠️  Migration failed (this is okay if no photos need updating): {e}")

    # Backfill orientation for any photos missing it
    try:
        from services.database import get_db
        with get_db() as (db, cursor):
            cursor.execute(
                "UPDATE file_metadata SET orientation = CASE WHEN height > width THEN 'portrait' WHEN width > height THEN 'landscape' ELSE 'square' END WHERE orientation IS NULL AND width IS NOT NULL AND height IS NOT NULL"
            )
            if cursor.rowcount > 0:
                print(f"🔄 Backfilled orientation for {cursor.rowcount} photos")
            db.commit()
    except Exception as e:
        print(f"⚠️  Orientation backfill skipped: {e}")

    yield

    # Shutdown
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
app.include_router(booking_router)
app.include_router(video_router)
app.include_router(event_router)
app.mount("/api/static", StaticFiles(directory=settings.DATA_DIR), name="static")

create_table()
os.makedirs(settings.DATA_DIR, exist_ok=True)


@app.get("/")
async def root():
    return {"message": "PhotoAura API Root"}


@app.get("/api")
async def api_root():
    return {"message": "PhotoAura API"}


from services.database import get_db

@app.get("/api/dashboard/")
async def get_dashboard(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    verify_token(token, credentials_exception)

    with get_db() as (db, cursor):
        cursor.execute("SELECT COUNT(*) FROM album")
        albums_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM users")
        users_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM file_metadata")
        photos_count = cursor.fetchone()[0]

        return {
            "albums": albums_count,
            "users": users_count,
            "photos": photos_count,
        }
