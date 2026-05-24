from fastapi import UploadFile, File, Query, APIRouter, Depends, HTTPException, status
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
from routers.websocket.websocket_router import manager
from dependencies import oauth2_scheme, get_current_user
from services.gemini_service import analyze_image
from fastapi.responses import StreamingResponse
import asyncio
import io

router = APIRouter()
AWS_BUCKET = settings.AWS_BUCKET
AWS_CLOUDFRONT_URL = settings.AWS_CLOUDFRONT_URL

# Upload files and handle DB logic
@router.post("/api/upload-files/")
async def create_upload_files(
    files: List[UploadFile] = File(...),
    album_name: str = Query(None),
    user_id: int = None,
    slug: str = None,
    update: bool = False,
    face_detection: bool = False,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):

    # Send upload progress to client
    websocket = manager.active_connections[0]
    total_bytes = 0
    for file in files:
        content = await file.read()
        total_bytes += len(content)
        # Rewind the file pointer if you plan to read the file again later
        file.file.seek(0)  # Reset the file pointer to the beginning after reading
    uploaded_bytes = 0
    for file in files:
        content = await file.read()
        uploaded_bytes += len(content)
        # Send progress update to the WebSocket connection
        await websocket.send_text(
            json.dumps({"uploaded_bytes": uploaded_bytes, "total_bytes": total_bytes})
        )
        # Reset file pointer if necessary
        file.file.seek(0)

    user_name = None
    if user_id:
        user = session.get(User, user_id)
        if user:
            user_name = user.user_name
    else:
        user_name = slug.split("/")[0]

    album_slug = f"{user_name}/{album_name.lower().replace(' ', '-')}"
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

    for file in files:
        content = await file.read()

        album_dir = os.path.join(settings.DATA_DIR, album_slug)
        if not os.path.exists(album_dir):
            os.makedirs(album_dir)

        with open(os.path.join(album_dir, file.filename), "wb") as f:
            f.write(content)

        s3_filename = f"{album_slug}/{file.filename}"
        s3_client.put_object(
            Bucket=AWS_BUCKET,
            Key=s3_filename,
            Body=content,
            ContentType=file.content_type,
        )

        file_metadata = get_file_metadata(
            album.id, os.path.join(album_dir, file.filename), file
        )

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

        if face_detection and uploaded_file_metadata:
            detect_and_store_faces(
                s3_filename,
                uploaded_file_metadata.id,
                album.id,
                AWS_BUCKET,
            )

        os.remove(os.path.join(album_dir, file.filename))

        if update:
            images_count = len(files) + album.image_count
            if album.image_count != images_count:
                album.image_count = images_count
                session.commit()

        blur_data_url = generate_blur_data_url(content)

        if uploaded_file_metadata:
            uploaded_file_metadata.blur_data_url = blur_data_url
            session.commit()

    return {"filenames": [file.filename for file in files]}


@router.post("/api/label-photos")
async def label_all_photos(current_user=Depends(get_current_user)):
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
    current_user=Depends(get_current_user),
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
