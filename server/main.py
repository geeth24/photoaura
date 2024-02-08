from fastapi import (
    FastAPI,
)
import os
from starlette.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from db_config import create_table, data_dir
from auth import router as auth_router
from routers.user import router as user_router
from routers.album import router as album_router
import time

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
app.mount("/api/static", StaticFiles(directory=data_dir), name="static")

# wait for db to start for 10 seconds
# time.sleep(10)
create_table()

os.makedirs(data_dir, exist_ok=True)


@app.get("/api")
async def root():
    return {"message": "PhotoAura API"}
