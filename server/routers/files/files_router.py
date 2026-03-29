from fastapi import UploadFile, File, Query, APIRouter, Depends, HTTPException, status
from datetime import datetime
import os
from typing import List
import json
from uuid import uuid4
from config import settings
from services.database import get_db
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
    current_user = Depends(get_current_user),
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

    with get_db() as (db, cursor):
        user_name = None
        if user_id:
            cursor.execute("SELECT * FROM users WHERE id=%s", (user_id,))
            user = cursor.fetchone()
            if user:
                user_name = user[1]
        else:
            user_name = slug.split("/")[0]

        album_slug = f"{user_name}/{album_name.lower().replace(' ', '-')}"
        cursor.execute("SELECT * FROM album WHERE slug = %s", (album_slug,))
        album = cursor.fetchone()

        if not album:
            cursor.execute(
                "INSERT INTO album (name, slug, location, date, image_count, shared, upload, secret, face_detection) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
                (
                    album_name,
                    album_slug,
                    os.path.join(settings.DATA_DIR, album_slug),
                    datetime.now(),
                    len(files),
                    False,
                    False,
                    str(uuid4()),
                    face_detection,
                ),
            )
            db.commit()
            cursor.execute("SELECT id FROM album WHERE slug = %s", (album_slug,))
            album = cursor.fetchone()
        else:
            update = True

        if user_id and album:
            add_album_to_user(user_id, album[0])

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
                album[0], os.path.join(album_dir, file.filename), file
            )

            cursor.execute(
                "INSERT INTO file_metadata (album_id, filename, content_type, size, width, height, upload_date, exif_data, orientation) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
                (
                    album[0],
                    file.filename,
                    file.content_type,
                    file_metadata["size"],
                    file_metadata["width"],
                    file_metadata["height"],
                    datetime.now(),
                    json.dumps(file_metadata["exif_data"]),
                    file_metadata["orientation"],
                ),
            )
            db.commit()

            cursor.execute("SELECT * FROM file_metadata WHERE album_id=%s ORDER BY id DESC LIMIT 1", (album[0],))
            uploaded_file_metadata = cursor.fetchone()

            if face_detection and uploaded_file_metadata:
                detect_and_store_faces(
                    s3_filename,
                    uploaded_file_metadata[0],
                    album[0],
                    AWS_BUCKET,
                )

            os.remove(os.path.join(album_dir, file.filename))

            if update:
                images_count = len(files) + album[5]
                if album[5] != images_count:
                    cursor.execute(
                        "UPDATE album SET image_count=%s WHERE name=%s",
                        (images_count, album_name),
                    )
                    db.commit()

            blur_data_url = generate_blur_data_url(content)

            if uploaded_file_metadata:
                cursor.execute(
                    "UPDATE file_metadata SET blur_data_url=%s WHERE id=%s",
                    (blur_data_url, uploaded_file_metadata[0]),
                )
                db.commit()

        return {"filenames": [file.filename for file in files]}


@router.post("/api/label-photos")
async def label_all_photos(current_user=Depends(get_current_user)):
    """batch label all photos that don't have descriptions yet"""

    async def stream():
        with get_db() as (db, cursor):
            cursor.execute(
                "SELECT id, album_id, filename FROM file_metadata WHERE description IS NULL"
            )
            unlabeled = cursor.fetchall()
            total = len(unlabeled)
            yield json.dumps({"status": "started", "total": total}) + "\n"

            for i, (photo_id, album_id, filename) in enumerate(unlabeled):
                cursor.execute("SELECT slug FROM album WHERE id = %s", (album_id,))
                album = cursor.fetchone()
                if not album:
                    continue

                s3_key = f"{album[0]}/{filename}"
                try:
                    obj = s3_client.get_object(Bucket=AWS_BUCKET, Key=s3_key)
                    image_bytes = obj["Body"].read()

                    result = analyze_image(image_bytes)

                    cursor.execute(
                        "UPDATE file_metadata SET description = %s, tags = %s WHERE id = %s",
                        (result["description"], result["tags"], photo_id),
                    )
                    db.commit()

                    yield json.dumps({
                        "progress": i + 1,
                        "total": total,
                        "filename": filename,
                        "description": result["description"],
                        "tags": result["tags"],
                    }) + "\n"
                except Exception as e:
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
async def label_single_photo(photo_id: int, current_user=Depends(get_current_user)):
    """label a single photo by id"""
    with get_db() as (db, cursor):
        cursor.execute(
            "SELECT fm.id, fm.filename, a.slug FROM file_metadata fm JOIN album a ON fm.album_id = a.id WHERE fm.id = %s",
            (photo_id,),
        )
        photo = cursor.fetchone()
        if not photo:
            raise HTTPException(status_code=404, detail="Photo not found")

        s3_key = f"{photo[2]}/{photo[1]}"
        obj = s3_client.get_object(Bucket=AWS_BUCKET, Key=s3_key)
        image_bytes = obj["Body"].read()

        result = analyze_image(image_bytes)

        cursor.execute(
            "UPDATE file_metadata SET description = %s, tags = %s WHERE id = %s",
            (result["description"], result["tags"], photo_id),
        )
        db.commit()

        return {
            "id": photo_id,
            "filename": photo[1],
            "description": result["description"],
            "tags": result["tags"],
        }
