import logging
import os
import shutil
import tempfile
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from urllib.parse import quote, unquote

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from config import settings
from db.base import get_session
from db.models import Album, AlbumReel, FileMetadata
from dependencies import require_admin
from services import reel_jobs
from services import reel_renderer as rr
from services.aws_service import invalidate_cdn, s3_client
from services.reel_service import (
    MAX_REEL_PHOTOS,
    MUSIC_KEY_RE,
    MUSIC_PREFIX,
    poster_key,
    public_url,
    start_reel_job,
)

router = APIRouter()
AWS_BUCKET = settings.AWS_BUCKET

MAX_MUSIC_BYTES = 20 * 1024 * 1024
MUSIC_TYPES = {"mp3": "audio/mpeg", "m4a": "audio/mp4", "wav": "audio/wav"}
MUSIC_LIST_LIMIT = 200


class ReelRequest(BaseModel):
    filenames: List[str] = Field(min_length=1, max_length=MAX_REEL_PHOTOS)
    aspect: str
    music_key: Optional[str] = None


def _album(session: Session, slug: str) -> Album:
    album = session.query(Album).filter_by(slug=slug).first()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    return album


def _iso(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat() if dt else None


def _reel_json(row: AlbumReel) -> dict:
    width, height = rr.ASPECTS.get(row.aspect, (0, 0))
    job = reel_jobs.job_for_reel(row.id)
    status = row.status
    # a render dies with the process; nothing live means it never finished
    if status == "rendering" and not (job and not job["finished"]):
        status = "failed"
    return {
        "id": row.id,
        "aspect": row.aspect,
        "status": status,
        "duration": row.duration,
        "width": width,
        "height": height,
        "created_at": _iso(row.created_at),
        "s3_key": row.s3_key,
        "poster_key": poster_key(row.s3_key),
        "url": public_url(row.s3_key),
        "poster_url": public_url(poster_key(row.s3_key)),
        "job_id": job["job_id"] if job else None,
        "phase": job["phase"] if job and not job["finished"] else None,
        "progress": job["progress"] if job else None,
        "error": job["error"] if job else None,
    }


@router.post("/api/album/{slug}/reels")
def create_reel(
    slug: str,
    body: ReelRequest,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    if body.aspect not in rr.ASPECTS:
        raise HTTPException(status_code=422, detail="aspect must be 9:16 or 16:9")
    if body.music_key:
        if not MUSIC_KEY_RE.match(body.music_key):
            raise HTTPException(status_code=422, detail="Unknown music track")
        try:
            s3_client.head_object(Bucket=AWS_BUCKET, Key=body.music_key)
        except Exception:
            raise HTTPException(status_code=422, detail="Unknown music track")

    album = _album(session, slug)
    filenames = list(dict.fromkeys(body.filenames))
    rows = {
        m.filename: m
        for m in session.query(FileMetadata).filter(
            FileMetadata.album_id == album.id, FileMetadata.filename.in_(filenames)
        )
    }
    missing = [f for f in filenames if f not in rows]
    if missing:
        raise HTTPException(
            status_code=400, detail=f"Not in this album: {', '.join(missing[:5])}"
        )
    videos = [f for f, m in rows.items() if (m.content_type or "").startswith("video/")]
    if videos:
        raise HTTPException(status_code=400, detail="Reels are made from photos only")
    if reel_jobs.active_count() >= reel_jobs.MAX_ACTIVE:
        raise HTTPException(status_code=429, detail="Too many reels rendering, try again soon")

    job_id, reel_id = start_reel_job(album.id, slug, filenames, body.aspect, body.music_key)
    return {"job_id": job_id, "reel_id": reel_id}


@router.get("/api/album/{slug}/reels")
def list_reels(
    slug: str,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    album = _album(session, slug)
    rows = (
        session.query(AlbumReel)
        .filter_by(album_id=album.id)
        .order_by(AlbumReel.created_at.desc(), AlbumReel.id.desc())
        .all()
    )
    jobs = [
        {k: v for k, v in j.items() if k != "album_id"}
        for j in reel_jobs.jobs_for_album(slug)
        if not j["finished"]
    ]
    return {"reels": [_reel_json(r) for r in rows], "jobs": jobs}


@router.delete("/api/album/{slug}/reels/{reel_id}")
def delete_reel(
    slug: str,
    reel_id: int,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    album = _album(session, slug)
    row = session.query(AlbumReel).filter_by(id=reel_id, album_id=album.id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Reel not found")
    if reel_jobs.is_reel_active(row.id):
        raise HTTPException(status_code=409, detail="This reel is still rendering")
    keys = [row.s3_key, poster_key(row.s3_key)]
    session.delete(row)
    session.commit()
    for key in keys:
        try:
            s3_client.delete_object(Bucket=AWS_BUCKET, Key=key)
        except Exception as e:
            logging.error(f"reel delete: could not remove {key}: {e}")
    invalidate_cdn(tuple(f"/{k}" for k in keys))
    return {"deleted": reel_id}


def _track_json(key: str, size: int, modified: Optional[datetime], meta: dict) -> dict:
    try:
        duration = float(meta.get("duration")) if meta.get("duration") else None
    except ValueError:
        duration = None
    return {
        "key": key,
        "name": unquote(meta.get("name", "")) or os.path.basename(key),
        "size": size,
        "duration": duration,
        "uploaded_at": _iso(modified),
        "url": public_url(key),
    }


@router.post("/api/reels/music")
def upload_music(
    request: Request,
    file: UploadFile = File(...),
    _admin=Depends(require_admin),
):
    ext = os.path.splitext(file.filename or "")[1].lower().lstrip(".")
    if ext not in MUSIC_TYPES:
        raise HTTPException(status_code=400, detail="Music must be an mp3, m4a or wav file")
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > MAX_MUSIC_BYTES + (1 << 20):
        raise HTTPException(status_code=413, detail="Music files can be up to 20 MB")

    tmpdir = tempfile.mkdtemp(prefix="music-")
    try:
        path = os.path.join(tmpdir, f"in.{ext}")
        size = 0
        with open(path, "wb") as fh:
            while True:
                chunk = file.file.read(1 << 20)
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_MUSIC_BYTES:
                    raise HTTPException(status_code=413, detail="Music files can be up to 20 MB")
                fh.write(chunk)
        if size == 0:
            raise HTTPException(status_code=400, detail="That file is empty")
        try:
            duration = rr.audio_duration(path)
        except rr.ReelError:
            raise HTTPException(status_code=400, detail="That doesn't look like an audio file")
        if duration < 3:
            raise HTTPException(status_code=400, detail="Music must be at least 3 seconds long")

        key = f"{MUSIC_PREFIX}{uuid.uuid4().hex}.{ext}"
        name = os.path.basename(file.filename or key)[:120]
        with open(path, "rb") as fh:
            s3_client.upload_fileobj(
                fh, AWS_BUCKET, key,
                ExtraArgs={
                    "ContentType": MUSIC_TYPES[ext],
                    "Metadata": {"name": quote(name), "duration": f"{duration:.2f}"},
                },
            )
        return _track_json(
            key, size, datetime.now(timezone.utc), {"name": quote(name), "duration": f"{duration:.2f}"}
        )
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


@router.get("/api/reels/music")
def list_music(_admin=Depends(require_admin)):
    objs = []
    for page in s3_client.get_paginator("list_objects_v2").paginate(
        Bucket=AWS_BUCKET, Prefix=MUSIC_PREFIX
    ):
        objs.extend(o for o in page.get("Contents", []) if MUSIC_KEY_RE.match(o["Key"]))
    objs.sort(key=lambda o: o["LastModified"], reverse=True)
    tracks = []
    for o in objs[:MUSIC_LIST_LIMIT]:
        try:
            meta = s3_client.head_object(Bucket=AWS_BUCKET, Key=o["Key"]).get("Metadata", {})
        except Exception:
            meta = {}
        tracks.append(_track_json(o["Key"], o["Size"], o["LastModified"], meta))
    return {"tracks": tracks}
