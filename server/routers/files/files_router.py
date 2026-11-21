from fastapi import (
    UploadFile,
    File,
    Query,
    APIRouter,
    Depends,
    HTTPException,
)
from datetime import datetime
import os
from typing import List
import json
from uuid import uuid4
from sqlalchemy import or_
from sqlalchemy.orm import Session
from config import settings
from db.base import get_session, session_scope
from db.models import Album, FileMetadata, PhotoFaceLink, FaceEmbedding
from services.aws_service import s3_client, invalidate_cdn
from utils.face_recog import detect_and_store_faces, recluster_faces
from services import smart_gallery
from utils.utils import get_file_metadata, add_album_to_user, slugify, base_name_of
from utils.image_utils import generate_blur_data_url
from services.cdn_warm import warm_key
from services.video_transcode import transcode_to_web
from routers.websocket.websocket_router import manager
from services import proof_service, upload_jobs, upload_sessions
from services.upload_sessions import Batch
from dependencies import require_admin
from services.gemini_service import analyze_image
from fastapi.responses import StreamingResponse
import asyncio
import io
from concurrent.futures import ThreadPoolExecutor
import zipfile
import mimetypes

router = APIRouter()
AWS_BUCKET = settings.AWS_BUCKET
AWS_CLOUDFRONT_URL = settings.AWS_CLOUDFRONT_URL

# one S3 PUT is a single stream and tops out near 90 Mbps to us-east-1 from
# here; several at once fill the uplink
S3_PUT_CONCURRENCY = int(os.environ.get("S3_PUT_CONCURRENCY", "6"))
_put_pool = ThreadPoolExecutor(max_workers=S3_PUT_CONCURRENCY, thread_name_prefix="s3-put")


class _ParallelPuts:
    """An upload's S3 writes, at most S3_PUT_CONCURRENCY in flight so the
    photo bytes waiting on them stay bounded."""

    def __init__(self):
        self.futures = []

    def put(self, key, body, content_type):
        self.futures.append(
            _put_pool.submit(
                s3_client.put_object,
                Bucket=AWS_BUCKET, Key=key, Body=body, ContentType=content_type,
            )
        )

    async def room(self):
        while True:
            pending = [f for f in self.futures if not f.done()]
            if len(pending) < S3_PUT_CONCURRENCY:
                return
            await asyncio.wait(
                [asyncio.wrap_future(f) for f in pending],
                return_when=asyncio.FIRST_COMPLETED,
            )

    async def finish(self):
        if self.futures:
            await asyncio.wait([asyncio.wrap_future(f) for f in self.futures])
        for f in self.futures:
            f.result()

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


async def _store_video_file(file, filename: str, content_type: str, album, session):
    """Stream a video to S3 in constant memory (no full read, no blur/exif/
    faces). A big video read into RAM OOM-killed the pod; videos just need to
    land in the album so the gallery + lightbox can play them.

    The S3 upload runs off the event loop — a synchronous multi-hundred-MB
    upload here blocks the loop long enough to fail the liveness probe, and
    k8s kills the pod mid-upload."""
    s3_key = f"{album.slug}/{filename}"
    # measure size without loading the file into memory
    file.file.seek(0, os.SEEK_END)
    size = file.file.tell()
    file.file.seek(0)
    await asyncio.to_thread(
        s3_client.upload_fileobj,
        file.file, AWS_BUCKET, s3_key, {"ContentType": content_type},
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
        meta = FileMetadata(album_id=album.id, filename=filename, base_name=base_name_of(filename), **fields)
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
    put=None,
):
    """Save a single file to S3 + record metadata. Shared by the multi-file
    upload and the zip upload so both run the identical pipeline.
    Appends to face_targets / keys for the downstream faces + warm passes."""
    is_video = (content_type or "").startswith("video/")
    # proof-locked albums keep the original under the hold path and show a proof
    held = bool(album.proof_locked) and not is_video

    # re-uploading the same filename UPDATES the existing row (don't add a
    # duplicate); the bumped upload_date also versions the image URL so the
    # browser fetches the new file instead of its year-old cached copy
    existing = (
        session.query(FileMetadata)
        .filter(
            FileMetadata.album_id == album.id,
            or_(FileMetadata.filename == filename, FileMetadata.original_filename == filename),
        )
        .first()
    )

    album_dir = os.path.join(settings.DATA_DIR, album.slug)
    os.makedirs(album_dir, exist_ok=True)
    local_path = os.path.join(album_dir, filename)
    with open(local_path, "wb") as f:
        f.write(content)

    s3_filename = f"{album.slug}/{filename}"
    face_key = s3_filename
    stale_clean = None
    if held:
        if existing and existing.held:
            stored_name = existing.filename
        else:
            stored_name = proof_service.proof_name(filename, proof_service.taken_names(session, album.id))
            if existing:
                stale_clean = s3_filename
        s3_filename, face_key = proof_service.store_held(album, filename, content, content_type, stored_name)
    else:
        stored_name = filename
        if put:
            put(s3_filename, content, content_type)
        else:
            s3_client.put_object(
                Bucket=AWS_BUCKET,
                Key=s3_filename,
                Body=content,
                ContentType=content_type,
            )

    try:
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
        fields.update(
            filename=stored_name,
            original_filename=filename if held else None,
            held=held,
        )

        if existing:
            for k, v in fields.items():
                setattr(existing, k, v)
            meta = existing
            # the photo changed — drop its old face data so it re-detects clean
            session.query(PhotoFaceLink).filter_by(photo_id=meta.id).delete()
            session.query(FaceEmbedding).filter_by(photo_id=meta.id).delete()
        else:
            meta = FileMetadata(album_id=album.id, base_name=base_name_of(filename), **fields)
            session.add(meta)
        session.commit()
        session.refresh(meta)

        if not is_video:
            meta.blur_data_url = generate_blur_data_url(content)
            session.commit()

            if face_detection:
                face_targets.append((face_key, meta.id))
        if stale_clean:
            s3_client.delete_object(Bucket=AWS_BUCKET, Key=stale_clean)
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


def _upload_target(session, album_name, slug, face_detection, image_count):
    """The album an upload lands in. A slug always means an existing album
    (names can change); a bare name finds-or-creates by its slug."""
    if slug:
        album = session.query(Album).filter_by(slug=slug).first()
        if not album:
            raise HTTPException(status_code=404, detail="Album not found")
        return album, True
    if not album_name or not album_name.strip():
        raise HTTPException(status_code=400, detail="album_name or slug is required")
    album_slug = slugify(album_name)
    album = session.query(Album).filter_by(slug=album_slug).first()
    if album:
        return album, True
    album = Album(
        name=album_name,
        slug=album_slug,
        location=os.path.join(settings.DATA_DIR, album_slug),
        date=datetime.now(),
        image_count=image_count,
        shared=False,
        upload=False,
        secret=str(uuid4()),
        face_detection=face_detection,
    )
    session.add(album)
    session.commit()
    session.refresh(album)
    return album, False


# albums with a processing pass in flight, and the targets that arrived
# for them meanwhile (merged into one follow-up pass)
_running: set[str] = set()
_queued: dict[str, Batch] = {}
_tasks: set[asyncio.Task] = set()


def _schedule_processing(batch: Batch) -> None:
    """Start processing for an album, or queue behind its running pass so two
    passes never interleave on one album (or run two reclusters at once)."""
    slug = batch.slug
    if slug in _running:
        queued = _queued.get(slug)
        if queued:
            queued.merge(batch)
        else:
            _queued[slug] = batch
        return
    _running.add(slug)
    upload_jobs.start_job(
        slug, face_detection=bool(batch.face_targets), image_count=batch.image_count
    )
    task = asyncio.create_task(_drain(batch))
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)


async def _drain(batch: Batch) -> None:
    slug = batch.slug
    try:
        while batch:
            await _process_album(
                batch.album_id, slug, batch.face_targets, batch.keys,
                batch.update, batch.image_count, batch.video_targets,
            )
            batch = _queued.pop(slug, None)
            if batch:
                upload_jobs.start_job(
                    slug,
                    face_detection=bool(batch.face_targets),
                    image_count=batch.image_count,
                )
    finally:
        _running.discard(slug)
        _queued.pop(slug, None)


# Upload files and handle DB logic
@router.post("/api/upload-files/")
async def create_upload_files(
    files: List[UploadFile] = File(...),
    album_name: str = Query(None),
    user_id: int = None,
    slug: str = None,
    update: bool = False,
    face_detection: bool = False,
    # a client-generated id shared by every batch of one upload; "final" marks
    # the last batch, which runs the single processing pass
    upload_session: str = Query(None, alias="session", max_length=64),
    final: bool = False,
    current_user=Depends(require_admin),
    session: Session = Depends(get_session),
):
    album, existed = _upload_target(session, album_name, slug, face_detection, len(files))
    if upload_session:
        held_slug = upload_sessions.slug_of(upload_session)
        if held_slug and held_slug != album.slug:
            raise HTTPException(status_code=409, detail="Upload session belongs to another album")
    album_slug = album.slug
    if existed:
        update = True

    if user_id and album:
        add_album_to_user(user_id, album.id)

    total = len(files)
    # (s3_key, file_metadata_id) for the faces pass
    face_targets = []
    keys = []  # image keys to warm (videos aren't transformed/warmed)
    video_targets = []  # (s3_key, meta_id) to transcode to web-friendly mp4

    # stage 1: save each file to S3 + (for images) record metadata + blur.
    # This is the only work that needs the request body, so it stays inline,
    # but off the event loop so other requests keep moving.
    puts = _ParallelPuts()
    for i, file in enumerate(files):
        ctype = file.content_type or _guess_content_type(file.filename)
        if (ctype or "").startswith("video/"):
            # stream videos straight to S3 — reading a big one into the pod's
            # memory OOM-killed the backend. no blur/exif/faces for video.
            video_targets.append(
                await _store_video_file(file, file.filename, ctype, album, session)
            )
        else:
            await puts.room()
            content = await file.read()
            await asyncio.to_thread(
                _store_one_file,
                content, file.filename, ctype, album,
                session, face_detection, face_targets, keys, puts.put,
            )
        await _notify("saving", i + 1, total)
    await puts.finish()

    # keep image_count exact (= actual stored rows), regardless of new/append
    album.image_count = (
        session.query(FileMetadata).filter_by(album_id=album.id).count()
    )
    session.commit()
    image_count = album.image_count

    # faces + clustering + cdn warming can run for minutes on a big album —
    # well past any proxy timeout. Hand them to a background task and return
    # now so the admin gets routed to a live progress page instead of a 504.
    batch = Batch(
        album.id, album_slug, update, image_count,
        face_targets, keys, video_targets,
    )
    if upload_session and not final:
        upload_sessions.hold(upload_session, batch, _schedule_processing)
        processing = False
    else:
        if upload_session:
            batch = upload_sessions.take(upload_session, batch)
        processing = batch.has_work
        if processing:
            _schedule_processing(batch)
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
            await asyncio.to_thread(smart_gallery.set_state, album_id, "scoring")
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

            # one pass per album, after the faces: stacks, review pile, highlights
            try:
                await asyncio.to_thread(smart_gallery.select_album, album_id)
            except Exception as e:
                print(f"smart selection failed (non-fatal): {e}")
                await asyncio.to_thread(smart_gallery.set_state, album_id, None)

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

        # another pass is queued for this album; it finishes the job
        if album_slug not in _queued:
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
    slug: str = None,
    face_detection: bool = False,
    current_user=Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Bulk-upload an album from a single .zip of original files. Each entry
    runs through the same pipeline as /api/upload-files/ (S3, metadata, blur,
    faces, CDN warm)."""
    album, _ = _upload_target(session, album_name, slug, face_detection, 0)

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
    puts = _ParallelPuts()
    for i, name in enumerate(entries):
        await puts.room()
        content = zf.read(name)
        filename = os.path.basename(name)
        ctype = _guess_content_type(filename)
        await asyncio.to_thread(
            _store_one_file,
            content, filename, ctype, album,
            session, face_detection, face_targets, keys, puts.put,
        )
        await _notify("saving", i + 1, total)
    await puts.finish()

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
