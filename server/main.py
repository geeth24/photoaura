from fastapi import (
    FastAPI,
)
import os
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from db_config import create_table, data_dir
from auth import router as auth_router
from routers.user import router as user_router
from routers.album import router as album_router


app = FastAPI()
origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    expose_headers=["*"],
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(user_router)
app.include_router(auth_router)
app.include_router(album_router)
app.mount("/static", StaticFiles(directory=data_dir), name="static")

create_table()

os.makedirs(data_dir, exist_ok=True)


@app.get("/")
async def root():
    return {"message": "PhotoAura API"}
