from fastapi import (
    UploadFile,
    File,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
    Query,
    APIRouter,
)
from fastapi.staticfiles import StaticFiles
from datetime import datetime
import os
from typing import List
from PIL import Image
import json
import PIL.ExifTags
import logging
import random
from db_config import get_db, data_dir
from image_utils import compress_image, generate_blur_data_url
from s3 import s3_client
from uuid import uuid4
from io import BytesIO
from botocore.exceptions import ClientError

router = APIRouter()
AWS_BUCKET = os.environ.get("AWS_BUCKET")
AWS_CLOUDFRONT_URL = os.environ.get("AWS_CLOUDFRONT_URL")

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)


manager = ConnectionManager()


@router.websocket("/api/ws/")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    # print if connection is established
    print("connection established")
    try:
        while True:
            data = await websocket.receive_text()
            for connection in manager.active_connections:
                await manager.send_message(data, connection)
    except WebSocketDisconnect:
        manager.disconnect(websocket)


def add_album_to_user(user_id, album_id):
    db, cursor = get_db()
    # check if album already exists
    cursor.execute(
        "SELECT * FROM user_album_permissions WHERE user_id=%s AND album_id=%s",
        (user_id, album_id),
    )
    album = cursor.fetchone()
    if album:
        return
    cursor.execute(
        "INSERT INTO user_album_permissions (user_id, album_id) VALUES (%s, %s)",
        (user_id, album_id),
    )
    db.commit()
    cursor.close()


# Function to extract EXIF data
def extract_exif_data(file_content: bytes):
    image = Image.open(BytesIO(file_content))
    exif = {
        PIL.ExifTags.TAGS.get(tag, tag): value
        for tag, value in image._getexif().items()
        if tag in PIL.ExifTags.TAGS
    }
    return exif


# Upload files and handle DB logic
@router.post("/api/upload-files/")
async def create_upload_files(
    files: List[UploadFile] = File(...),
    album_name: str = Query(None),
    user_id: int = None,
    slug: str = None,
    update: bool = False,
):
    db, cursor = get_db()
    uploaded_image_count = len(files)

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

    if not album:
        # Insert new album into DB if not exists
        cursor.execute(
            "INSERT INTO album (name, slug, location, date, image_count, shared, upload, secret) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
            (
                album_name,
                album_slug,
                os.path.join(data_dir, album_slug),
                datetime.now(),
                len(files),
                False,
                False,
                str(uuid4()),
            ),
        )

        db.commit()

        # Get the album ID
        cursor.execute("SELECT id FROM album WHERE slug = %s", (album_slug,))
        album = cursor.fetchone()
    else:
        # Update the image count if the album already exists
        print("album exists")
        print(album)

    for file in files:
        # Read file content
        content = await file.read()

        # Save file to disk
        album_dir = os.path.join(data_dir, album_slug)
        if not os.path.exists(album_dir):
            os.makedirs(album_dir)

        with open(album_dir + "/" + file.filename, "wb") as f:
            f.write(content)

        compress_image(
            album_dir + "/" + file.filename,
            album_dir + "/compressed/" + file.filename,
        )

        # Generate unique filename for S3
        s3_filename = f"{album_slug}/{file.filename}"
        s3_client.put_object(
            Bucket=AWS_BUCKET,
            Key=s3_filename,
            Body=content,
            ContentType=file.content_type,
        )

        # upload cpmpressed image to s3
        s3_compressed_filename = f"{album_slug}/compressed/{file.filename}"
        with open(album_dir + "/compressed/" + file.filename, "rb") as f:
            s3_client.put_object(
                Bucket=AWS_BUCKET,
                Key=s3_compressed_filename,
                Body=f,
                ContentType=file.content_type,
            )

        # get file metadata
        album_dir = os.path.join(data_dir, album_slug)
        file_metadata = get_file_metadata(
            album[0], album_dir + "/" + file.filename, file
        )

        file_metadata["blur_data_url"] = generate_blur_data_url(
            album_dir + "/compressed/" + file.filename
        )
        # Save file metadata to DB, including EXIF
        cursor.execute(
            "INSERT INTO file_metadata (album_id, filename, content_type, size, width, height, upload_date, exif_data, blur_data_url) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
            (
                album[0],
                file.filename,
                file.content_type,
                file_metadata["size"],
                file_metadata["width"],
                file_metadata["height"],
                datetime.now(),
                json.dumps(file_metadata["exif_data"]),
                file_metadata["blur_data_url"],
            ),
        )

        # delete all files from disk
        os.remove(album_dir + "/" + file.filename)
        os.remove(album_dir + "/compressed/" + file.filename)

        if update:
            images_count = len(files) + album[5]
            if album[5] != images_count:
                cursor.execute(
                    "UPDATE album SET image_count=%s WHERE name=%s",
                    (images_count + uploaded_image_count, album_name),
                )

        # compress image and save it

        db.commit()

        message = f"File {file.filename} uploaded successfully!"
        for connection in manager.active_connections:
            await manager.send_message(message, connection)

    # add album to user
    if user_id:
        add_album_to_user(user_id, album[0])

    return {"filenames": [file.filename for file in files]}


def get_file_metadata(album_id: int, album_dir: str, file: UploadFile):
    def get_exif_data(file):
        exif_data = {}
        img = Image.open(file)
        exif = img._getexif()
        if exif:
            for tag, value in exif.items():
                decoded = PIL.ExifTags.TAGS.get(tag, tag)
                if isinstance(value, (int, float, str, list, dict, tuple)):
                    exif_data[decoded] = value
                # Optionally, handle specific non-serializable types (e.g., convert tuples to lists)
                elif isinstance(value, tuple):
                    exif_data[decoded] = list(value)
        return exif_data

    # get exif data
    exif_data = get_exif_data(file.file)

    # Serialize the exif data
    exif_data_json = json.dumps(
        exif_data, default=str
    )  # Use default=str to handle non-serializable data

    # get file size
    file_size = os.path.getsize(album_dir)

    # get image dimensions
    img = Image.open(album_dir)
    width, height = img.size

    return {
        "size": file_size,
        "exif_data": exif_data_json,
        "width": width,
        "height": height,
    }


@router.get("/api/album/{user_name}/{album_name}/")
async def get_album(user_name: str, album_name: str, secret: str = None):
    db, cursor = get_db()
    album_slug = f"{user_name}/{album_name.lower().replace(' ', '-')}"
    cursor.execute("SELECT * FROM album WHERE slug=%s", (album_slug,))
    album = cursor.fetchone()

    if album is None:
        raise HTTPException(status_code=404, detail="Album not found")

    # Fetch file metadata
    cursor.execute("SELECT * FROM file_metadata WHERE album_id=%s", (album[0],))
    file_metadata = cursor.fetchall()

    if not file_metadata:
        raise HTTPException(status_code=404, detail="No images found in the album")

    # Generate album photos with presigned URLs
    album_photos = create_album_photos_json(album_slug, file_metadata)

    # Fetch album permissions
    cursor.execute(
        "SELECT * FROM user_album_permissions WHERE album_id=%s", (album[0],)
    )
    album_permissions = cursor.fetchall()

    # Construct permissions list
    permissions_list = []
    for perm in album_permissions:
        cursor.execute("SELECT * FROM users WHERE id=%s", (perm[1],))
        user = cursor.fetchone()
        permissions_list.append(
            {
                "user_id": user[0],
                "user_name": user[1],
                "full_name": user[3],
                "user_email": user[4],
            }
        )

    return {
        "album_name": album[1],
        "slug": album[2],
        "image_count": album[5],
        "shared": album[6],
        "upload": album[7],
        "secret": album[8],
        "album_permissions": permissions_list,
        "album_photos": album_photos,
    }


def create_album_photos_json(album_slug, file_metadata):
    album_photos = []
    for meta in file_metadata:
        compressed_image_url = f"https://{AWS_CLOUDFRONT_URL}/{album_slug}/compressed/{meta[2]}"  # meta[2] should be the filename
        image_url = f"https://{AWS_CLOUDFRONT_URL}/{album_slug}/{meta[2]}"  # meta[2] should be the filename
        album_photos.append(
            {
                "image": image_url,
                "compressed_image": compressed_image_url,
                "file_metadata": {
                    "album_id": meta[1],
                    "filename": meta[2],
                    "content_type": meta[3],
                    "size": meta[4],
                    "width": meta[5],
                    "height": meta[6],
                    "upload_date": meta[7],
                    "exif_data": meta[8],
                    "blur_data_url": meta[9],
                },
            }
        )
    return album_photos


@router.get("/api/albums/")
async def get_all_albums(
    user_id: int = None,
):
    # get all ablnum names and first 4 images in each album
    db, cursor = get_db()
    cursor.execute("SELECT * FROM album")
    albums = cursor.fetchall()
    print(albums)

    all_albums = []
    for album in albums:
        album_slug = album[2]
        album_name = album[1]

        # get file metadata
        cursor.execute("SELECT * FROM file_metadata WHERE album_id=%s", (album[0],))

        file_metadata = cursor.fetchall()

        # limit images to 4
        file_metadata = file_metadata[:4]

        album_photos = create_album_photos_json(album_slug, file_metadata)

        all_albums.append(
            {
                "album_id": album[0],
                "album_name": album_name,
                "slug": album[2],
                "image_count": album[5],
                "shared": album[6],
                "upload": album[7],
                "album_photos": album_photos,
            }
        )

    # return all albums which userid has access to
    if user_id:
        cursor.execute(
            "SELECT * FROM user_album_permissions WHERE user_id=%s", (user_id,)
        )
        user_albums = cursor.fetchall()
        user_album_ids = [album[2] for album in user_albums]
        all_albums = [
            album for album in all_albums if album["album_id"] in user_album_ids
        ]

    return all_albums


@router.get("/api/photos/")
async def get_all_photos(
    user_id: int = None,
):
    # get all album names
    db, cursor = get_db()
    cursor.execute("SELECT * FROM album")
    albums = cursor.fetchall()

    all_photos = []
    for album in albums:
        print(album)
        album_slug = album[2]
        album_name = album[1]

        # get file metadata
        cursor.execute("SELECT * FROM file_metadata WHERE album_id=%s", (album[0],))

        file_metadata = cursor.fetchall()

        album_photos = create_album_photos_json(album_slug, file_metadata)
        all_photos.extend(album_photos)

    # return all albums which userid has access to
    if user_id:
        cursor.execute(
            "SELECT * FROM user_album_permissions WHERE user_id=%s", (user_id,)
        )
        user_albums = cursor.fetchall()
        user_album_ids = [album[2] for album in user_albums]
        all_photos = [
            photo
            for photo in all_photos
            if photo["file_metadata"]["album_id"] in user_album_ids
        ]

    return all_photos


@router.delete("/api/album/delete/{user_name}/{album_name}/")
async def delete_album(user_name: str, album_name: str):
    # album_name = album_name.lower().replace(" ", "-")
    db, cursor = get_db()

    # First, find the album ID
    cursor.execute("SELECT id FROM album WHERE name=%s", (album_name,))
    album = cursor.fetchone()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    album_id = album[0]

    # Delete references from user_album_permissions
    cursor.execute("DELETE FROM user_album_permissions WHERE album_id=%s", (album_id,))

    # Then, delete related file metadata records
    cursor.execute("DELETE FROM file_metadata WHERE album_id=%s", (album_id,))

    # Now, delete the album itself
    cursor.execute("DELETE FROM album WHERE id=%s", (album_id,))
    db.commit()

    # Attempt to delete the album directory from S3
    try:
        # List objects to be deleted
        objects_to_delete = s3_client.list_objects_v2(
            Bucket=AWS_BUCKET, Prefix=f"{user_name}/{album_name.replace(' ', '-')}"
        )
        delete_keys = [
            {"Key": obj["Key"]} for obj in objects_to_delete.get("Contents", [])
        ]

        # Delete the objects
        if delete_keys:
            s3_client.delete_objects(Bucket=AWS_BUCKET, Delete={"Objects": delete_keys})
        print("Deleted album from S3")
    except ClientError as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to delete album from S3: {e}"
        )

    return {"message": "Album deleted successfully."}


@router.put("/api/album/")
async def update_album(
    album_name: str,
    album_new_name: str,
    shared: bool,
    upload: bool,
    slug: str,
    user_id: int = None,
    action: str = None,
):
    print(album_name, album_new_name, shared)
    db, cursor = get_db()

    user_name = slug.split("/")[0]

    try:
        newSlug = user_name + "/" + album_new_name.lower().replace(" ", "-")
        print("slug", slug)
        cursor.execute(
            "UPDATE album SET name=%s, shared=%s, upload=%s, location=%s, slug=%s WHERE slug=%s",
            (
                album_new_name,
                shared,
                upload,
                os.path.join(data_dir, user_name + "/" + album_new_name.lower()),
                newSlug,
                slug.lower(),
            ),
        )
        print("updated album")
        db.commit()
    except Exception as e:
        logging.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database update failed")

    if album_name != album_new_name:
        album_dir = os.path.join(data_dir, user_name + "/" + album_name.lower())
        album_new_dir = os.path.join(data_dir, user_name + "/" + album_new_name.lower())

        if os.path.exists(album_dir):
            try:
                import shutil

                shutil.move(album_dir.lower(), album_new_dir.lower())
            except Exception as e:
                logging.error(f"File operation error: {e}")
                raise HTTPException(
                    status_code=500, detail="Failed to move album directory"
                )

    if user_id is not None:
        # cursor.execute("SELECT * FROM album WHERE name=%s", (album_new_name,))
        # album = cursor.fetchone()
        # add_album_to_user(user_id, album[0])
        if action == "update":
            cursor.execute("SELECT * FROM album WHERE name=%s", (album_new_name,))
            album = cursor.fetchone()
            add_album_to_user(user_id, album[0])

        elif action == "delete":
            cursor.execute("SELECT * FROM album WHERE name=%s", (album_name,))
            album = cursor.fetchone()

            # delete only the row that has the user_id
            cursor.execute(
                "DELETE FROM user_album_permissions WHERE user_id=%s AND album_id=%s",
                (user_id, album[0]),
            )
            db.commit()

    return {"message": "Album updated successfully."}


@router.get("/api/shared-albums/")
async def get_shared_albums():
    # get all ablnum names and first 4 images in each album
    db, cursor = get_db()
    cursor.execute("SELECT * FROM album WHERE shared=%s", (True,))
    albums = cursor.fetchall()

    all_albums = []
    for album in albums:
        album_dir = album[2]
        album_name = album[1]
        if not os.path.exists(album_dir):
            raise HTTPException(status_code=404, detail="Album not found")

        # get first 4 images in album
        images = [
            image
            for image in os.listdir(album_dir + "/compressed")
            if not image.startswith(".")
        ][:4]

        # get file metadata
        cursor.execute("SELECT * FROM file_metadata WHERE album_id=%s", (album[0],))

        file_metadata = cursor.fetchall()

        album_photos = create_album_photos_json(
            album[0], album_dir, album_name, images, file_metadata
        )

        all_albums.append(
            {
                "album_name": album_name,
                "slug": album[2],
                "image_count": album[5],
                "shared": album[6],
                "upload": album[7],
                "album_photos": album_photos,
            }
        )

    return all_albums


@router.delete("/api/photo/delete/")
async def delete_photo(slug: str, photo_name: str):
    user_name = slug.split("/")[0]
    album_name = slug.split("/")[1]

    album_dir = os.path.join(data_dir, user_name + "/" + album_name.lower())
    album_compressed_dir = os.path.join(album_dir, "compressed")

    db, cursor = get_db()
    cursor.execute("SELECT * FROM album WHERE slug=%s", (slug,))
    album = cursor.fetchone()

    if album is None:
        raise HTTPException(status_code=404, detail="Album not found")

    cursor.execute(
        "DELETE FROM file_metadata WHERE album_id=%s AND filename=%s",
        (album[0], photo_name),
    )

    db.commit()

    if os.path.exists(os.path.join(album_dir, photo_name)):
        os.remove(os.path.join(album_dir, photo_name))

    if os.path.exists(os.path.join(album_compressed_dir, photo_name)):
        os.remove(os.path.join(album_compressed_dir, photo_name))


    # update album image count
    cursor.execute(
        "UPDATE album SET image_count=%s WHERE slug=%s",
        (album[5] - 1, slug),
    )

    db.commit()

    return {"message": "Photo deleted successfully."}
