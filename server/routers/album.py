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

from db_config import get_db, data_dir
from image_utils import compress_image, generate_blur_data_url

router = APIRouter()


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


@router.websocket("/api/ws")
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
    cursor.execute(
        "INSERT INTO user_album_permissions (user_id, album_id) VALUES (%s, %s)",
        (user_id, album_id),
    )
    db.commit()
    cursor.close()


@router.post("/api/upload-files/")
async def create_upload_files(
    files: List[UploadFile] = File(...),
    album_name: str = Query(None),
    user_id: int = None,
):
    # create new folder for album
    album_dir = os.path.join(data_dir, album_name.lower())
    compressed_dir = os.path.join(album_dir, "compressed")

    os.makedirs(album_dir, exist_ok=True)
    os.makedirs(compressed_dir, exist_ok=True)  # Ensure this directory exists
    if manager.active_connections:
        websocket = manager.active_connections[0]
    # save files to album folder

    for file in files:
        contents = await file.read()
        with open(os.path.join(album_dir, file.filename), "wb") as f:
            f.write(contents)
            await manager.send_message(file.filename, websocket)

    images_count = len(os.listdir(album_dir)) - 1

    # create new album in database
    # if album already exists, then dont create new album
    db, cursor = get_db()
    cursor.execute("SELECT * FROM album WHERE name=%s", (album_name,))
    album = cursor.fetchone()
    # check if images_count changed for album and update it
    if album:
        if album[4] != images_count:
            cursor.execute(
                "UPDATE album SET image_count=%s WHERE name=%s",
                (images_count, album_name),
            )
    else:
        slug = album_name.lower().replace(" ", "-")
        cursor.execute(
            "INSERT INTO album (name, slug, location, date, image_count, shared) VALUES (%s, %s, %s, %s, %s, %s)",
            (album_name, slug, album_dir, datetime.now(), images_count, False),
        )

    # get album id
    cursor.execute("SELECT * FROM album WHERE name=%s", (album_name,))
    album = cursor.fetchone()
    # websocket = manager.active_connections[0]

    # get file metadata
    for file in files:
        # Rewind the file pointer to the beginning for reading metadata
        file.file.seek(0)

        file_metadata = get_file_metadata(
            album[0], album_dir + "/" + file.filename, file
        )

        compress_image(
            album_dir + "/" + file.filename, album_dir + "/compressed/" + file.filename
        )

        file_metadata["blur_data_url"] = generate_blur_data_url(
            album_dir + "/compressed/" + file.filename
        )

        # save metadata to database
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

        # compress image and save it

        if manager.active_connections:
            await manager.send_message(file.filename, websocket)

        db.commit()

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


@router.get("/api/album/{slug}")
async def get_album(slug: str):
    album_name = slug.replace("-", " ")
    album_dir = os.path.join(data_dir, album_name.lower())
    print(album_dir)
    if not os.path.exists(album_dir):
        raise HTTPException(status_code=404, detail="Album not found")

    images = [
        image
        for image in os.listdir(album_dir + "/compressed")
        if not image.startswith(".")
    ]

    # get album id
    db, cursor = get_db()
    cursor.execute("SELECT * FROM album WHERE location=%s", (album_dir,))
    album = cursor.fetchone()

    if album is None:
        raise HTTPException(status_code=404, detail="Album not found")

    print("album", album)

    # get file metadata
    db, cursor = get_db()
    cursor.execute("SELECT * FROM file_metadata WHERE album_id=%s", (album[0],))
    file_metadata = cursor.fetchall()

    album_photos = create_album_photos_json(album[0], album_name, images, file_metadata)

    # get album permissions
    cursor.execute(
        "SELECT * FROM user_album_permissions WHERE album_id=%s", (album[0],)
    )
    album_permissions = cursor.fetchall()

    album_permissions = [
        {"user_id": album_permission[1], "album_id": album_permission[2]}
        for album_permission in album_permissions
    ]

    # get user data for the album permissions
    for album_permission in album_permissions:
        cursor.execute(
            "SELECT * FROM users WHERE id=%s", (album_permission["user_id"],)
        )
        user = cursor.fetchone()
        album_permission["user_name"] = user[1]
        album_permission["full_name"] = user[3]
        album_permission["user_email"] = user[4]

    return {
        "album_name": album_name,
        "slug": album[2],
        "image_count": album[5],
        "shared": album[6],
        "album_permissions": album_permissions,
        "album_photos": album_photos,
    }


def create_album_photos_json(album_id, album_name, images, file_metadata):
    album_photos = [
        {
            "album_id": album_id,
            "album_name": album_name,
            "image": f"https://aura.reactiveshots.com/api/static/{album_name}/compressed/{image}",
            "file_metadata": {
                "content_type": meta[3],
                "size": meta[4],
                "width": meta[5],
                "height": meta[6],
                "upload_date": meta[7],
                "exif_data": meta[8],
                "blur_data_url": meta[9],
            },
        }
        for image, meta in zip(images, file_metadata)
    ]
    return album_photos


@router.get("/api/albums/")
async def get_all_albums(
    user_id: int = None,
):
    # get all ablnum names and first 4 images in each album
    db, cursor = get_db()
    cursor.execute("SELECT * FROM album")
    albums = cursor.fetchall()

    all_albums = []
    for album in albums:
        album_dir = album[3]
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
            album[0], album_name, images, file_metadata
        )

        all_albums.append(
            {
                "album_id": album[0],
                "album_name": album_name,
                "slug": album[2],
                "image_count": album[5],
                "shared": album[6],
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
        album_dir = album[3]
        album_name = album[1]
        if not os.path.exists(album_dir):
            raise HTTPException(status_code=404, detail="Album not found")

        images = [
            image
            for image in os.listdir(album_dir + "/compressed")
            if not image.startswith(".")
        ]

        # get file metadata
        cursor.execute("SELECT * FROM file_metadata WHERE album_id=%s", (album[0],))

        file_metadata = cursor.fetchall()

        album_photos = create_album_photos_json(
            album[0], album_name, images, file_metadata
        )
        all_photos.extend(album_photos)

    # return all albums which userid has access to
    if user_id:
        cursor.execute(
            "SELECT * FROM user_album_permissions WHERE user_id=%s", (user_id,)
        )
        user_albums = cursor.fetchall()
        user_album_ids = [album[2] for album in user_albums]
        all_photos = [
            photo for photo in all_photos if photo["album_id"] in user_album_ids
        ]

    return all_photos


@router.get("/api/album/delete/{album_name}")
async def delete_album(album_name: str):
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

    # Delete album directory
    album_dir = os.path.join(data_dir, album_name.lower())
    if os.path.exists(album_dir):
        import shutil

        shutil.rmtree(album_dir)

    return {"message": "Album deleted successfully."}


@router.put("/api/album")
async def update_album(
    album_name: str,
    album_new_name: str,
    shared: bool,
    user_id: int = None,
    action: str = None,
):
    print(album_name, album_new_name, shared)
    db, cursor = get_db()

    try:
        slug = album_new_name.lower().replace(" ", "-")
        cursor.execute(
            "UPDATE album SET name=%s, shared=%s, location=%s, slug=%s WHERE name=%s",
            (
                album_new_name,
                shared,
                os.path.join(data_dir, album_new_name.lower()),
                slug,
                album_name,
            ),
        )
        print("updated album")
        db.commit()
    except Exception as e:
        logging.error(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Database update failed")

    if album_name != album_new_name:
        album_dir = os.path.join(data_dir, album_name.lower())
        album_new_dir = os.path.join(data_dir, album_new_name.lower())

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
            album[0], album_name, images, file_metadata
        )

        all_albums.append(
            {
                "album_name": album_name,
                "slug": album[2],
                "image_count": album[5],
                "shared": album[6],
                "album_photos": album_photos,
            }
        )

    return all_albums