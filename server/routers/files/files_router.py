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
from db.models import Album, FileMetadata, User, PhotoFaceLink, FaceEmbedding
from services.aws_service import s3_client, invalidate_cdn
from utils.face_recog import detect_and_store_faces, recluster_faces
from utils.utils import get_file_metadata, add_album_to_user
from utils.image_utils import generate_blur_data_url
from services.cdn_warm import warm_key
from services.video_transcode import transcode_to_web
from routers.websocket.websocket_router import manager
from services import upload_jobs
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


def _store_video_file(file, filename: str, content_type: str, album, session):
    """Stream a video to S3 in constant memory (no full read, no blur/exif/
    faces). A big video read into RAM OOM-killed the pod; videos just need to
    land in the album so the gallery + lightbox can play them."""
    s3_key = f"{album.slug}/{filename}"
    # measure size without loading the file into memory
    file.file.seek(0, os.SEEK_END)
    size = file.file.tell()
    file.file.seek(0)
    s3_client.upload_fileobj(
        file.file, AWS_BUCKET, s3_key, ExtraArgs={"ContentType": content_type}
    )

    existing = (
        session.query(FileMetadata)
        .filter_by(album_id=album.id, filename=filename)
        .first()
    )
    fields = dict(
        content_type=content_type,
        size=size,
        width=0,
        height=0,
        upload_date=datetime.now(),
    )
    if existing:
        for k, v in fields.items():
            setattr(existing, k, v)
        meta = existing
        session.query(PhotoFaceLink).filter_by(photo_id=meta.id).delete()
        session.query(FaceEmbedding).filter_by(photo_id=meta.id).delete()
    else:
        meta = FileMetadata(album_id=album.id, filename=filename, **fields)
        session.add(meta)
    session.commit()
    return s3_key, meta.id


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
        # re-uploading the same filename UPDATES the existing row (don't add a
        # duplicate); the bumped upload_date also versions the image URL so the
        # browser fetches the new file instead of its year-old cached copy
        existing = (
            session.query(FileMetadata)
            .filter_by(album_id=album.id, filename=filename)
            .first()
        )

        if is_video:
            fields = dict(
                content_type=content_type,
                size=len(content),
                width=0,
                height=0,
                upload_date=datetime.now(),
            )
        else:
            keys.append(s3_filename)
            fm = get_file_metadata(album.id, local_path, _BytesUpload(content))
            fields = dict(
                content_type=content_type,
                size=fm["size"],
                width=fm["width"],
                height=fm["height"],
                upload_date=datetime.now(),
                exif_data=fm["exif_data"],
                orientation=fm["orientation"],
            )

        if existing:
            for k, v in fields.items():
                setattr(existing, k, v)
            meta = existing
            # the photo changed — drop its old face data so it re-detects clean
            session.query(PhotoFaceLink).filter_by(photo_id=meta.id).delete()
            session.query(FaceEmbedding).filter_by(photo_id=meta.id).delete()
        else:
            meta = FileMetadata(album_id=album.id, filename=filename, **fields)
            session.add(meta)
        session.commit()
        session.refresh(meta)

        if not is_video:
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
    video_targets = []  # (s3_key, meta_id) to transcode to web-friendly mp4

    # stage 1: save each file to S3 + (for images) record metadata + blur.
    # This is the only work that needs the request body, so it stays inline.
    for i, file in enumerate(files):
        ctype = file.content_type or _guess_content_type(file.filename)
        if (ctype or "").startswith("video/"):
            # stream videos straight to S3 — reading a big one into the pod's
            # memory OOM-killed the backend. no blur/exif/faces for video.
            video_targets.append(
                _store_video_file(file, file.filename, ctype, album, session)
            )
        else:
            content = await file.read()
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
    image_count = album.image_count

    # faces + clustering + cdn warming can run for minutes on a big album —
    # well past any proxy timeout. Hand them to a background task and return
    # now so the admin gets routed to a live progress page instead of a 504.
    processing = bool(face_targets or keys or video_targets)
    if processing:
        upload_jobs.start_job(
            album_slug, face_detection=bool(face_targets), image_count=image_count
        )
        asyncio.create_task(
            _process_album(
                album.id, album_slug, face_targets, keys, update, image_count,
                video_targets,
            )
        )
    else:
        await _notify("done", total, total)

    return {
        "filenames": [file.filename for file in files],
        "album_slug": album_slug,
        "processing": processing,
    }


async def _process_album(
    album_id, album_slug, face_targets, keys, update, image_count, video_targets=None
):
    """Background: detect faces, regroup, warm the CDN, transcode videos.
    Updates the job registry (polled by the processing page) and the websocket
    as it goes."""
    try:
        # stage 2: detect + index faces (off the event loop so progress flushes)
        if face_targets:
            n = len(face_targets)
            upload_jobs.update_job(album_slug, phase="faces", current=0, total=n)
            await _notify("faces", 0, n)
            for i, (s3_key, meta_id) in enumerate(face_targets):
                # one bad photo must never abort the whole album — log & continue
                try:
                    await asyncio.to_thread(
                        detect_and_store_faces, s3_key, meta_id, album_id, AWS_BUCKET
                    )
                except Exception as e:
                    print(f"face detection failed for {s3_key}: {e}")
                upload_jobs.update_job(album_slug, phase="faces", current=i + 1, total=n)
                await _notify("faces", i + 1, n)

            # authoritative regroup (Chinese Whispers); never fatal — detect
            # already wrote consistent links, recluster only refines them.
            upload_jobs.update_job(album_slug, phase="clustering")
            await _notify("clustering", 0, 0)
            try:
                await asyncio.to_thread(recluster_faces)
            except Exception as e:
                print(f"recluster after upload failed (non-fatal): {e}")

        # stage 3: pre-warm CDN derivatives so the first view isn't a cold render
        warm_total = len(keys)
        done = 0
        upload_jobs.update_job(album_slug, phase="warming", current=0, total=warm_total)
        await _notify("warming", 0, warm_total)
        tasks = [asyncio.create_task(asyncio.to_thread(warm_key, k)) for k in keys]
        for task in asyncio.as_completed(tasks):
            await task
            done += 1
            upload_jobs.update_job(
                album_slug, phase="warming", current=done, total=warm_total
            )
            await _notify("warming", done, warm_total)

        # stage 4: transcode videos to a web-friendly faststart mp4. Phone/camera
        # clips are huge and stream poorly; re-encoding makes them load fast.
        for s3_key, meta_id in (video_targets or []):
            upload_jobs.update_job(album_slug, phase="transcoding")
            await _notify("transcoding", 0, 0)
            try:
                new_size = await asyncio.to_thread(transcode_to_web, s3_key)
                if new_size:
                    with session_scope() as s:
                        m = s.query(FileMetadata).filter_by(id=meta_id).first()
                        if m:
                            m.size = new_size
                    await asyncio.to_thread(invalidate_cdn)
            except Exception as e:
                print(f"video transcode failed for {s3_key}: {e}")

        # re-uploading can overwrite photos at the same key; purge stale CDN copies
        if update:
            await asyncio.to_thread(invalidate_cdn)

        upload_jobs.finish_job(album_slug)
        await _notify("done", image_count, image_count)
    except Exception as e:
        print(f"album processing failed for {album_slug}: {e}")
        upload_jobs.fail_job(album_slug, str(e))
        await _notify("error", 0, 0)


@router.get("/api/upload-status/{album_slug}")
async def upload_status(album_slug: str, current_user=Depends(require_admin)):
    """Live status for the admin processing page. Returns finished=True when
    there's no active job (already done, or the page was opened late)."""
    job = upload_jobs.get_job(album_slug)
    if not job:
        return {
            "album_slug": album_slug,
            "active": False,
            "finished": True,
            "phase": "done",
            "current": 0,
            "total": 0,
            "error": None,
            "face_detection": False,
        }
    return {"album_slug": album_slug, "active": not job["finished"], **job}


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
        # authoritative regroup (Chinese Whispers) so a new upload can't leave
        # people mis-merged; cheap on reruns (stable ids + chips reused)
        await asyncio.to_thread(recluster_faces)

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
