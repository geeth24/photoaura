from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db.base import get_session
from db.models import AppVersion
from dependencies import require_admin

router = APIRouter()
PLATFORMS = ("ios", "android")


def _json(row: Optional[AppVersion]):
    if not row:
        return None
    return {
        "min_version": row.min_version,
        "latest_version": row.latest_version,
        "store_url": row.store_url,
        "message": row.message,
        "updated_at": row.updated_at,
    }


@router.get("/api/app-config")
def app_config(session: Session = Depends(get_session)):
    """Public: the update policy each mobile app checks on launch. Below
    min_version the app blocks until updated; below latest_version it nudges."""
    rows = {r.platform: r for r in session.query(AppVersion).all()}
    return {p: _json(rows.get(p)) for p in PLATFORMS}


class AppVersionBody(BaseModel):
    min_version: Optional[str] = None
    latest_version: Optional[str] = None
    store_url: Optional[str] = None
    message: Optional[str] = None


def _valid(v: Optional[str]) -> bool:
    return v is None or (v != "" and all(part.isdigit() for part in v.split(".")))


@router.put("/api/admin/app-config/{platform}")
def update_app_config(
    platform: str,
    body: AppVersionBody,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    if platform not in PLATFORMS:
        raise HTTPException(status_code=404, detail="Unknown platform")
    min_v = (body.min_version or "").strip() or None
    latest_v = (body.latest_version or "").strip() or None
    if not (_valid(min_v) and _valid(latest_v)):
        raise HTTPException(status_code=400, detail="Versions look like 2.3 or 2.3.1")

    row = session.get(AppVersion, platform) or AppVersion(platform=platform)
    row.min_version = min_v
    row.latest_version = latest_v
    if body.store_url is not None:
        row.store_url = body.store_url.strip() or None
    row.message = (body.message or "").strip() or None
    row.updated_at = datetime.now()
    session.add(row)
    session.commit()
    return {platform: _json(row)}
