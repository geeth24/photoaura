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


@router.websocket("/ws")
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


@router.post("/upload-files/")
async def create_upload_files(
    files: List[UploadFile] = File(...), album_name: str = Query(None)
):
    # create new folder for album
    album_dir = os.path.join(data_dir, album_name.lower())
    compressed_dir = os.path.join(album_dir, "compressed")

    os.makedirs(album_dir, exist_ok=True)
    os.makedirs(compressed_dir, exist_ok=True)  # Ensure this directory exists

    # save files to album folder

    for file in files:
        contents = await file.read()
        with open(os.path.join(album_dir, file.filename), "wb") as f:
            f.write(contents)

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
        cursor.execute(
            "INSERT INTO album (name, location, date, image_count, shared) VALUES (%s, %s, %s, %s, %s)",
            (album_name, album_dir, datetime.now(), images_count, False),
        )

    # get album id
    cursor.execute("SELECT * FROM album WHERE name=%s", (album_name,))
    album = cursor.fetchone()

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

        websocket = manager.active_connections[0]

        await manager.send_message(file.filename, websocket)

        db.commit()

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


@router.get("/album/{album_name}")
async def get_album(album_name: str):
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

    album_photos = create_album_photos_json(album_name, images, file_metadata)

    return {
        "album_name": album_name,
        "image_count": album[4],
        "shared": album[5],
        "album_photos": album_photos,
    }


def create_album_photos_json(album_name, images, file_metadata):
    album_photos = [
        {
            "album_name": album_name,
            "image": f"https://photoaura-api.reactiveshots.com/static/{album_name}/compressed/{image}",
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


@router.get("/albums/")
async def get_all_albums():
    # get all ablnum names and first 4 images in each album
    db, cursor = get_db()
    cursor.execute("SELECT * FROM album")
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

        album_photos = create_album_photos_json(album_name, images, file_metadata)

        all_albums.append(
            {
                "album_name": album_name,
                "image_count": album[4],
                "shared": album[5],
                "album_photos": album_photos,
            }
        )

    return all_albums


@router.get("/photos/")
async def get_all_photos():
    # get all album names
    db, cursor = get_db()
    cursor.execute("SELECT * FROM album")
    albums = cursor.fetchall()

    all_photos = []
    for album in albums:
        print(album)
        album_dir = album[2]
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

        album_photos = create_album_photos_json(album_name, images, file_metadata)
        all_photos.extend(album_photos)

    return all_photos


@router.get("/album/delete/{album_name}")
async def delete_album(album_name: str):
    db, cursor = get_db()

    # First, delete related file metadata records
    cursor.execute(
        "DELETE FROM file_metadata WHERE album_id IN (SELECT id FROM album WHERE name=%s)",
        (album_name,),
    )

    # Then, delete the album
    cursor.execute("DELETE FROM album WHERE name=%s", (album_name,))
    db.commit()

    # delete album folder and all its contents including compressed folder recursively
    album_dir = os.path.join(data_dir, album_name.lower())
    if os.path.exists(album_dir):
        import shutil

        shutil.rmtree(album_dir)

    return {"message": "Album deleted successfully."}


@router.put("/album")
async def update_album(album_name: str, album_new_name: str, shared: bool):
    print(album_name, album_new_name, shared)
    db, cursor = get_db()

    try:
        cursor.execute(
            "UPDATE album SET name=%s, shared=%s, location=%s WHERE name=%s",
            (
                album_new_name,
                shared,
                os.path.join(data_dir, album_new_name.lower()),
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

    return {"message": "Album updated successfully."}


@router.get("/shared-albums/")
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

        album_photos = create_album_photos_json(album_name, images, file_metadata)

        all_albums.append(
            {
                "album_name": album_name,
                "image_count": album[4],
                "shared": album[5],
                "album_photos": album_photos,
            }
        )

    return all_albums
