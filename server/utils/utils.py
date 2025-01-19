from fastapi import (
    UploadFile,
)
import os
from PIL import Image
import json
import PIL.ExifTags
from io import BytesIO
from services.database import get_db

AWS_CLOUDFRONT_URL = os.environ.get("AWS_CLOUDFRONT_URL")


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


def create_album_photos_json(album_slug, file_metadata):
    album_photos = []
    for meta in file_metadata:
        compressed_image_url = f"https://{AWS_CLOUDFRONT_URL}/{album_slug}/compressed/{meta[2]}"  # meta[2] should be the filename
        image_url = f"https://{AWS_CLOUDFRONT_URL}/fit-in/720x0/{album_slug}/{meta[2]}"  # meta[2] should be the filename
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


# Function to extract EXIF data
def extract_exif_data(file_content: bytes):
    image = Image.open(BytesIO(file_content))
    exif = {
        PIL.ExifTags.TAGS.get(tag, tag): value
        for tag, value in image._getexif().items()
        if tag in PIL.ExifTags.TAGS
    }
    return exif


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
