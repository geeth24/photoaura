from fastapi import (
    UploadFile,
    File,
    Query,
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from datetime import datetime
import os
from typing import List
import json
from uuid import uuid4
from sqlalchemy.orm import Session
from config import settings
from db.base import get_session, session_scope
from db.models import Album, FileMetadata, User
from services.aws_service import s3_client
from utils.face_recog import detect_and_store_faces
from utils.utils import get_file_metadata, add_album_to_user
from utils.image_utils import generate_blur_data_url
from services.cdn_warm import warm_key
from routers.websocket.websocket_router import manager
from dependencies import oauth2_scheme, get_current_user, require_admin
from services.gemini_service import analyze_image
from fastapi.responses import StreamingResponse
import asyncio
import io
import zipfile
import mimetypes

router = APIRouter()
AWS_BUCKET = settings.AWS_BUCKET
AWS_CLOUDFRONT_URL = settings.AWS_CLOUDFRONT_URL

_IMAGE_EXTS = {
    ".jpg", ".jpeg", ".png", ".heic", ".heif",
    ".webp", ".gif", ".tif", ".tiff", ".bmp",
}
_VIDEO_EXTS = {".mp4", ".mov", ".m4v", ".avi", ".mkv"}


class _BytesUpload:
    """Minimal stand-in for UploadFile so get_file_metadata can read exif
    from bytes (zip entries aren't UploadFile objects)."""

    def __init__(self, content: bytes):
        self.file = io.BytesIO(content)


def _guess_content_type(filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    if ext in _VIDEO_EXTS:
        return mimetypes.types_map.get(ext, "video/mp4")
    guessed, _ = mimetypes.guess_type(filename)
    return guessed or "image/jpeg"


def _is_media(filename: str) -> bool:
    ext = os.path.splitext(filename)[1].lower()
    return ext in _IMAGE_EXTS or ext in _VIDEO_EXTS


def _store_one_file(
    content: bytes,
    filename: str,
    content_type: str,
    album,
    session,
    face_detection: bool,
    face_targets: list,
    keys: list,
):
    """Save a single file to S3 + record metadata. Shared by the multi-file
    upload and the zip upload so both run the identical pipeline.
    Appends to face_targets / keys for the downstream faces + warm passes."""
    is_video = (content_type or "").startswith("video/")

    album_dir = os.path.join(settings.DATA_DIR, album.slug)
    os.makedirs(album_dir, exist_ok=True)
    local_path = os.path.join(album_dir, filename)
    with open(local_path, "wb") as f:
        f.write(content)

    s3_filename = f"{album.slug}/{filename}"
    s3_client.put_object(
        Bucket=AWS_BUCKET,
        Key=s3_filename,
        Body=content,
        ContentType=content_type,
    )

    try:
        if is_video:
            meta = FileMetadata(
                album_id=album.id,
                filename=filename,
                content_type=content_type,
                size=len(content),
                width=0,
                height=0,
                upload_date=datetime.now(),
            )
            session.add(meta)
            session.commit()
        else:
            keys.append(s3_filename)
            fm = get_file_metadata(album.id, local_path, _BytesUpload(content))
            meta = FileMetadata(
                album_id=album.id,
                filename=filename,
                content_type=content_type,
                size=fm["size"],
                width=fm["width"],
                height=fm["height"],
                upload_date=datetime.now(),
                exif_data=fm["exif_data"],
                orientation=fm["orientation"],
            )
            session.add(meta)
            session.commit()
            session.refresh(meta)

            meta.blur_data_url = generate_blur_data_url(content)
            session.commit()

            if face_detection:
                face_targets.append((s3_filename, meta.id))
    finally:
        if os.path.exists(local_path):
            os.remove(local_path)


async def _notify(stage: str, current: int = 0, total: int = 0):
    """Push a live stage update to the upload dialog over the websocket."""
    conns = manager.active_connections
    if not conns:
        return
    payload = json.dumps({"stage": stage, "current": current, "total": total})
    try:
        await conns[0].send_text(payload)
    except Exception:
        pass


# Upload files and handle DB logic
@router.post("/api/upload-files/")
async def create_upload_files(
    files: List[UploadFile] = File(...),
    album_name: str = Query(None),
    user_id: int = None,
    slug: str = None,
    update: bool = False,
    face_detection: bool = False,
    current_user=Depends(require_admin),
    session: Session = Depends(get_session),
):
    album_slug = album_name.lower().replace(" ", "-")
    album = session.query(Album).filter_by(slug=album_slug).first()

    if not album:
        album = Album(
            name=album_name,
            slug=album_slug,
            location=os.path.join(settings.DATA_DIR, album_slug),
            date=datetime.now(),
            image_count=len(files),
            shared=False,
            upload=False,
            secret=str(uuid4()),
            face_detection=face_detection,
        )
        session.add(album)
        session.commit()
        session.refresh(album)
    else:
        update = True

    if user_id and album:
        add_album_to_user(user_id, album.id)

    total = len(files)
    # (s3_key, file_metadata_id) for the faces pass
    face_targets = []
    keys = []  # image keys to warm (videos aren't transformed/warmed)

    # stage 1: save each file to S3 + (for images) record metadata + blur
    for i, file in enumerate(files):
        content = await file.read()
        ctype = file.content_type or _guess_content_type(file.filename)
        _store_one_file(
            content, file.filename, ctype, album,
            session, face_detection, face_targets, keys,
        )
        await _notify("saving", i + 1, total)

    # keep image_count exact (= actual stored rows), regardless of new/append
    album.image_count = (
        session.query(FileMetadata).filter_by(album_id=album.id).count()
    )
    session.commit()

    # stage 2: detect + index faces (off the event loop so progress can flush)
    if face_targets:
        n = len(face_targets)
        for i, (s3_key, meta_id) in enumerate(face_targets):
            # one bad photo (no detectable face, odd crop, etc.) must never
            # 500 the whole upload — log and keep going
            try:
                await asyncio.to_thread(
                    detect_and_store_faces, s3_key, meta_id, album.id, AWS_BUCKET
                )
            except Exception as e:
                print(f"face detection failed for {s3_key}: {e}")
            await _notify("faces", i + 1, n)

    # stage 3: pre-warm CDN derivatives so the first view isn't a cold SIH render
    done = 0
    tasks = [asyncio.create_task(asyncio.to_thread(warm_key, k)) for k in keys]
    await _notify("warming", 0, total)
    for task in asyncio.as_completed(tasks):
        await task
        done += 1
        await _notify("warming", done, total)

    await _notify("done", total, total)

    return {"filenames": [file.filename for file in files]}


@router.post("/api/upload-zip/")
async def create_upload_zip(
    file: UploadFile = File(...),
    album_name: str = Query(None),
    user_id: int = None,
    face_detection: bool = False,
    current_user=Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Bulk-upload an album from a single .zip of original files. Each entry
    runs through the same pipeline as /api/upload-files/ (S3, metadata, blur,
    faces, CDN warm)."""
    if not album_name:
        raise HTTPException(status_code=400, detail="album_name is required")

    album_slug = album_name.lower().replace(" ", "-")
    album = session.query(Album).filter_by(slug=album_slug).first()
    if not album:
        album = Album(
            name=album_name,
            slug=album_slug,
            location=os.path.join(settings.DATA_DIR, album_slug),
            date=datetime.now(),
            image_count=0,
            shared=False,
            upload=False,
            secret=str(uuid4()),
            face_detection=face_detection,
        )
        session.add(album)
        session.commit()
        session.refresh(album)

    if user_id and album:
        add_album_to_user(user_id, album.id)

    raw = await file.read()
    try:
        zf = zipfile.ZipFile(io.BytesIO(raw))
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="That file isn't a valid zip.")

    # skip directories, macOS junk (__MACOSX, ._AppleDouble), and non-media
    entries = [
        n for n in zf.namelist()
        if not n.endswith("/")
        and "__MACOSX" not in n
        and not os.path.basename(n).startswith("._")
        and _is_media(n)
    ]
    total = len(entries)
    if total == 0:
        raise HTTPException(
            status_code=400, detail="No photos or videos found in the zip."
        )

    face_targets = []
    keys = []

    # stage 1: extract + store each entry
    for i, name in enumerate(entries):
        content = zf.read(name)
        filename = os.path.basename(name)
        ctype = _guess_content_type(filename)
        _store_one_file(
            content, filename, ctype, album,
            session, face_detection, face_targets, keys,
        )
        await _notify("saving", i + 1, total)

    album.image_count = (
        session.query(FileMetadata).filter_by(album_id=album.id).count()
    )
    session.commit()

    # stage 2: faces
    if face_targets:
        n = len(face_targets)
        for i, (s3_key, meta_id) in enumerate(face_targets):
            # one bad photo (no detectable face, odd crop, etc.) must never
            # 500 the whole upload — log and keep going
            try:
                await asyncio.to_thread(
                    detect_and_store_faces, s3_key, meta_id, album.id, AWS_BUCKET
                )
            except Exception as e:
                print(f"face detection failed for {s3_key}: {e}")
            await _notify("faces", i + 1, n)

    # stage 3: warm CDN derivatives
    done = 0
    tasks = [asyncio.create_task(asyncio.to_thread(warm_key, k)) for k in keys]
    await _notify("warming", 0, total)
    for task in asyncio.as_completed(tasks):
        await task
        done += 1
        await _notify("warming", done, total)

    await _notify("done", total, total)

    return {"album": album.slug, "count": total}


@router.post("/api/label-photos")
async def label_all_photos(current_user=Depends(require_admin)):
    """batch label all photos that don't have descriptions yet"""

    async def stream():
        with session_scope() as session:
            unlabeled = (
                session.query(
                    FileMetadata.id, FileMetadata.album_id, FileMetadata.filename
                )
                .filter(FileMetadata.description.is_(None))
                .all()
            )
            total = len(unlabeled)
            yield json.dumps({"status": "started", "total": total}) + "\n"

            for i, (photo_id, album_id, filename) in enumerate(unlabeled):
                album = session.get(Album, album_id)
                if not album:
                    continue

                s3_key = f"{album.slug}/{filename}"
                try:
                    obj = s3_client.get_object(Bucket=AWS_BUCKET, Key=s3_key)
                    image_bytes = obj["Body"].read()

                    result = analyze_image(image_bytes)

                    session.query(FileMetadata).filter_by(id=photo_id).update(
                        {
                            "description": result["description"],
                            "tags": result["tags"],
                        }
                    )
                    session.commit()

                    yield json.dumps({
                        "progress": i + 1,
                        "total": total,
                        "filename": filename,
                        "description": result["description"],
                        "tags": result["tags"],
                    }) + "\n"
                except Exception as e:
                    session.rollback()
                    yield json.dumps({
                        "progress": i + 1,
                        "total": total,
                        "filename": filename,
                        "error": str(e),
                    }) + "\n"

                # small delay to avoid rate limits
                await asyncio.sleep(0.5)

            yield json.dumps({"status": "complete", "labeled": total}) + "\n"

    return StreamingResponse(stream(), media_type="application/x-ndjson")


@router.post("/api/label-photo/{photo_id}")
async def label_single_photo(
    photo_id: int,
    current_user=Depends(require_admin),
    session: Session = Depends(get_session),
):
    """label a single photo by id"""
    row = (
        session.query(FileMetadata.id, FileMetadata.filename, Album.slug)
        .join(Album, FileMetadata.album_id == Album.id)
        .filter(FileMetadata.id == photo_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Photo not found")

    _, filename, slug = row
    s3_key = f"{slug}/{filename}"
    obj = s3_client.get_object(Bucket=AWS_BUCKET, Key=s3_key)
    image_bytes = obj["Body"].read()

    result = analyze_image(image_bytes)

    session.query(FileMetadata).filter_by(id=photo_id).update(
        {"description": result["description"], "tags": result["tags"]}
    )

    return {
        "id": photo_id,
        "filename": filename,
        "description": result["description"],
        "tags": result["tags"],
    }
