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
from services.database import get_db, data_dir
from services.aws_service import s3_client
from uuid import uuid4
from utils.face_recog import detect_and_store_faces
from utils.utils import get_file_metadata, add_album_to_user
from utils.image_utils import generate_blur_data_url
from routers.websocket.websocket_router import manager
from fastapi.security import OAuth2PasswordBearer
from routers.auth.auth_router import verify_token

router = APIRouter()
AWS_BUCKET = os.environ.get("AWS_BUCKET")
AWS_CLOUDFRONT_URL = os.environ.get("AWS_CLOUDFRONT_URL")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Upload files and handle DB logic
@router.post("/api/upload-files/")
async def create_upload_files(
    files: List[UploadFile] = File(...),
    album_name: str = Query(None),
    user_id: int = None,
    slug: str = None,
    update: bool = False,
    face_detection: bool = False,
    token: str = Depends(oauth2_scheme),
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    verify_token(token, credentials_exception)

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

    db, cursor = get_db()
    print("Uploading files")

    user_name = None
    if user_id:
        cursor.execute("SELECT * FROM users WHERE id=%s", (user_id,))
        user = cursor.fetchone()
        user_name = user[1]
    else:
        user_name = slug.split("/")[0]

    # Check for album existence or create new one
    album_slug = f"{user_name}/{album_name.lower().replace(' ', '-')}"
    cursor.execute("SELECT * FROM album WHERE slug = %s", (album_slug,))
    album = cursor.fetchone()  # or cursor.fetchall() if expecting multiple rows

    print("Upload complete")
    if not album:
        # Insert new album into DB if not exists
        cursor.execute(
            "INSERT INTO album (name, slug, location, date, image_count, shared, upload, secret, face_detection) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
            (
                album_name,
                album_slug,
                os.path.join(data_dir, album_slug),
                datetime.now(),
                len(files),
                False,
                False,
                str(uuid4()),
                face_detection,
            ),
        )

        db.commit()

        # Get the album ID
        cursor.execute("SELECT id FROM album WHERE slug = %s", (album_slug,))
        album = cursor.fetchone()
    else:
        # Update the image count if the album already exists
        print("album exists")
        update = True

    # add album to user
    if user_id:
        add_album_to_user(user_id, album[0])

    for file in files:
        # Read file content
        content = await file.read()

        # Save file to disk
        album_dir = os.path.join(data_dir, album_slug)
        if not os.path.exists(album_dir):
            os.makedirs(album_dir)

        with open(album_dir + "/" + file.filename, "wb") as f:
            f.write(content)

        # Generate unique filename for S3
        s3_filename = f"{album_slug}/{file.filename}"
        s3_client.put_object(
            Bucket=AWS_BUCKET,
            Key=s3_filename,
            Body=content,
            ContentType=file.content_type,
        )

        # get file metadata
        album_dir = os.path.join(data_dir, album_slug)
        file_metadata = get_file_metadata(
            album[0], album_dir + "/" + file.filename, file
        )

        # Save file metadata to DB, including EXIF
        cursor.execute(
            "INSERT INTO file_metadata (album_id, filename, content_type, size, width, height, upload_date, exif_data) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
            (
                album[0],
                file.filename,
                file.content_type,
                file_metadata["size"],
                file_metadata["width"],
                file_metadata["height"],
                datetime.now(),
                json.dumps(file_metadata["exif_data"]),
            ),
        )
        db.commit()

        # get file metadata
        cursor.execute("SELECT * FROM file_metadata WHERE album_id=%s", (album[0],))
        file_metadata = cursor.fetchall()
        # get id for the file just uploaded
        file_metadata = file_metadata[-1]

        if face_detection:
            # Detect and store faces
            detect_and_store_faces(
                s3_filename,
                file_metadata[0],
                album[0],
                AWS_BUCKET,
            )

        # delete all files from disk
        os.remove(album_dir + "/" + file.filename)

        if update:
            images_count = len(files) + album[5]
            if album[5] != images_count:
                cursor.execute(
                    "UPDATE album SET image_count=%s WHERE name=%s",
                    (images_count, album_name),
                )
                db.commit()

        # generate blur data URL based on the regular file
        blur_data_url = generate_blur_data_url(content)

        cursor.execute(
            "UPDATE file_metadata SET blur_data_url=%s WHERE id=%s",
            (blur_data_url, file_metadata[0]),
        )
        db.commit()

    return {"filenames": [file.filename for file in files]}
