from fastapi import FastAPI, Request
import os
from starlette.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from db_config import create_table, data_dir
from auth import router as auth_router
from routers.user import router as user_router
from routers.album import router as album_router

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import RedirectResponse


class NormalizeSlashMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if not path.endswith("/") and not "." in path.split("/")[-1]:
            new_url = request.url.replace(path=path + "/")
            return RedirectResponse(url=str(new_url), status_code=301)
        response = await call_next(request)
        return response


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

app.add_middleware(NormalizeSlashMiddleware)

app.include_router(user_router)
app.include_router(auth_router)
app.include_router(album_router)
app.mount("/api/static", StaticFiles(directory=data_dir), name="static")

create_table()

os.makedirs(data_dir, exist_ok=True)


@app.get("/api")
async def root():
    return {"message": "PhotoAura API"}
