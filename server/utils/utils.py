from fastapi import UploadFile
import os
from PIL import Image
import json
import PIL.ExifTags
from io import BytesIO
from datetime import datetime
from config import settings
from db.base import session_scope
from db.models import UserAlbumPermission
from services.aws_service import s3_client

AWS_CLOUDFRONT_URL = settings.AWS_CLOUDFRONT_URL
AWS_BUCKET = settings.AWS_BUCKET


def capture_time(meta):
    """When the shot was taken — EXIF DateTimeOriginal, falling back to upload
    time so everything sorts chronologically (matches how the camera saw it).
    Accepts a FileMetadata row or an already-built photo dict."""
    if isinstance(meta, dict):
        meta = meta.get("file_metadata", meta)
        get = meta.get
    else:
        get = lambda k: getattr(meta, k, None)
    raw = get("exif_data")
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except Exception:
            raw = {}
    if isinstance(raw, dict):
        dt = raw.get("DateTimeOriginal") or raw.get("DateTime")
        if dt:
            try:
                return datetime.strptime(str(dt), "%Y:%m:%d %H:%M:%S")
            except Exception:
                pass
    return get("upload_date") or datetime.min


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

    # get image dimensions, accounting for EXIF rotation
    img = Image.open(album_dir)
    width, height = img.size

    # EXIF orientation 5-8 means the image is rotated 90°, so swap w/h
    exif_orientation = exif_data.get("Orientation", 1)
    if exif_orientation in (5, 6, 7, 8):
        width, height = height, width

    if height > width:
        orientation = "portrait"
    elif width > height:
        orientation = "landscape"
    else:
        orientation = "square"

    return {
        "size": file_size,
        "exif_data": exif_data_json,
        "width": width,
        "height": height,
        "orientation": orientation,
    }


def create_album_photos_json(album_slug, file_metadata):
    album_photos = []
    # chronological by capture time so the grid + lightbox read like the event
    file_metadata = sorted(file_metadata, key=capture_time)
    for meta in file_metadata:
        if (meta.content_type or "").startswith("video/"):
            # SIH can't transform video — serve the raw object via a presigned URL
            url = s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": AWS_BUCKET, "Key": f"{album_slug}/{meta.filename}"},
                ExpiresIn=21600,
            )
            compressed_image_url = url
            image_url = url
        else:
            # plain URLs — works with every client version. ?v versioning broke
            # clients still running the old loader (jams ?v into the S3 key ->
            # 404); not worth breaking prod for the rare re-upload-overwrite case.
            compressed_image_url = f"https://{AWS_CLOUDFRONT_URL}/fit-in/720x0/{album_slug}/{meta.filename}"  # Grid thumbnail
            image_url = f"https://{AWS_CLOUDFRONT_URL}/fit-in/1920x0/{album_slug}/{meta.filename}"  # Detailed view
        album_photos.append(
            {
                "image": image_url,
                "compressed_image": compressed_image_url,
                "file_metadata": {
                    "album_id": meta.album_id,
                    "filename": meta.filename,
                    "content_type": meta.content_type,
                    "size": meta.size,
                    "width": meta.width,
                    "height": meta.height,
                    "upload_date": meta.upload_date,
                    "exif_data": meta.exif_data,
                    "blur_data_url": meta.blur_data_url,
                    "orientation": meta.orientation,
                    "description": meta.description,
                    "tags": meta.tags,
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
    with session_scope() as session:
        existing = (
            session.query(UserAlbumPermission)
            .filter_by(user_id=user_id, album_id=album_id)
            .first()
        )
        if existing:
            return
        session.add(UserAlbumPermission(user_id=user_id, album_id=album_id))
