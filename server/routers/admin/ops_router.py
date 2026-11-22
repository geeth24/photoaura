"""Admin ops dashboard — storage, counts, and live service health so the
admin can tell at a glance whether anything needs attention (e.g. resize S3,
a service is down)."""

import os

import requests
from fastapi import APIRouter, Depends
from sqlalchemy import desc, func, text
from sqlalchemy.orm import Session

from config import settings
from db.base import get_session
from db.models import FileMetadata, Album, User, ClientFile, FaceData, FaceEmbedding
from dependencies import require_admin

router = APIRouter()

FACE_SERVICE_URL = os.environ.get("FACE_SERVICE_URL", "http://photoaura-faces:8000")
CDN = settings.AWS_CLOUDFRONT_URL


def _reachable(url: str, timeout: float = 3.0, head: bool = False) -> bool:
    try:
        r = (requests.head if head else requests.get)(url, timeout=timeout)
        return r.status_code < 500
    except Exception:
        return False


def _cdn_ok(session) -> bool:
    """Fetch a real (tiny) derivative of an actual photo — the CDN root 404s/
    times out, so probe a key that genuinely exists."""
    row = (
        session.query(FileMetadata.filename, Album.slug)
        .join(Album, Album.id == FileMetadata.album_id)
        .filter(~FileMetadata.content_type.ilike("video/%"))
        .first()
    )
    if not row:
        return True
    try:
        r = requests.get(
            f"https://{CDN}/fit-in/64x0/{row.slug}/{row.filename}",
            timeout=6,
            headers={"Accept": "image/*"},
        )
        return r.status_code == 200
    except Exception:
        return False


def top_albums(session, limit: int = 6) -> list[dict]:
    """The albums holding the most media, biggest first, to see what's worth archiving."""
    is_video = FileMetadata.content_type.ilike("video/%")
    rows = (
        session.query(
            Album.slug,
            Album.name,
            func.coalesce(func.sum(FileMetadata.size), 0).label("bytes"),
            func.count(FileMetadata.id).label("files"),
            func.count(FileMetadata.id).filter(is_video).label("videos"),
        )
        .join(FileMetadata, FileMetadata.album_id == Album.id)
        .group_by(Album.id, Album.slug, Album.name)
        .order_by(desc("bytes"))
        .limit(limit)
        .all()
    )
    return [
        {
            "slug": r.slug,
            "name": r.name,
            "bytes": int(r.bytes),
            "photos": int(r.files) - int(r.videos),
            "videos": int(r.videos),
        }
        for r in rows
    ]


@router.get("/api/admin/ops")
def ops(_admin=Depends(require_admin), session: Session = Depends(get_session)):
    total = session.query(func.count(FileMetadata.id)).scalar() or 0
    videos = (
        session.query(func.count(FileMetadata.id))
        .filter(FileMetadata.content_type.ilike("video/%"))
        .scalar()
        or 0
    )
    media_bytes = (
        session.query(func.coalesce(func.sum(FileMetadata.size), 0)).scalar() or 0
    )
    deliverable_bytes = (
        session.query(func.coalesce(func.sum(ClientFile.size), 0)).scalar() or 0
    )
    db_size = (
        session.execute(text("SELECT pg_database_size(current_database())")).scalar()
        or 0
    )

    return {
        "counts": {
            "albums": session.query(func.count(Album.id)).scalar() or 0,
            "photos": total - videos,
            "videos": videos,
            "users": session.query(func.count(User.id)).scalar() or 0,
            "people": session.query(func.count(FaceData.id)).scalar() or 0,
            "faces": session.query(func.count(FaceEmbedding.id)).scalar() or 0,
        },
        "storage": {
            "media_bytes": int(media_bytes),
            "deliverables_bytes": int(deliverable_bytes),
            "total_bytes": int(media_bytes) + int(deliverable_bytes),
        },
        "db_size_bytes": int(db_size),
        "top_albums": top_albums(session),
        "services": {
            "backend": True,  # we're answering, so it's up
            "postgres": True,  # the queries above succeeded
            "face_service": _reachable(f"{FACE_SERVICE_URL}/health"),
            "cdn": _cdn_ok(session),
        },
    }
