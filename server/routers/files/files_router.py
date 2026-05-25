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

router = APIRouter()
AWS_BUCKET = settings.AWS_BUCKET
AWS_CLOUDFRONT_URL = settings.AWS_CLOUDFRONT_URL


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
        is_video = (file.content_type or "").startswith("video/")

        album_dir = os.path.join(settings.DATA_DIR, album_slug)
        if not os.path.exists(album_dir):
            os.makedirs(album_dir)

        local_path = os.path.join(album_dir, file.filename)
        with open(local_path, "wb") as f:
            f.write(content)

        s3_filename = f"{album_slug}/{file.filename}"
        s3_client.put_object(
            Bucket=AWS_BUCKET,
            Key=s3_filename,
            Body=content,
            ContentType=file.content_type,
        )

        if is_video:
            # videos: store as-is, no image metadata / blur / faces / warming
            uploaded_file_metadata = FileMetadata(
                album_id=album.id,
                filename=file.filename,
                content_type=file.content_type,
                size=len(content),
                width=0,
                height=0,
                upload_date=datetime.now(),
            )
            session.add(uploaded_file_metadata)
            session.commit()
        else:
            keys.append(s3_filename)
            file_metadata = get_file_metadata(album.id, local_path, file)
            uploaded_file_metadata = FileMetadata(
                album_id=album.id,
                filename=file.filename,
                content_type=file.content_type,
                size=file_metadata["size"],
                width=file_metadata["width"],
                height=file_metadata["height"],
                upload_date=datetime.now(),
                exif_data=file_metadata["exif_data"],
                orientation=file_metadata["orientation"],
            )
            session.add(uploaded_file_metadata)
            session.commit()
            session.refresh(uploaded_file_metadata)

            blur_data_url = generate_blur_data_url(content)
            uploaded_file_metadata.blur_data_url = blur_data_url
            session.commit()

            if face_detection:
                face_targets.append((s3_filename, uploaded_file_metadata.id))

        os.remove(local_path)
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
            await asyncio.to_thread(
                detect_and_store_faces, s3_key, meta_id, album.id, AWS_BUCKET
            )
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
