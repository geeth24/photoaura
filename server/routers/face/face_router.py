from fastapi import APIRouter, HTTPException
from services.database import get_db
from utils.utils import create_album_photos_json
import os

AWS_BUCKET = os.environ.get("AWS_BUCKET")
AWS_CLOUDFRONT_URL = os.environ.get("AWS_CLOUDFRONT_URL")

router = APIRouter()


@router.get("/api/face")
async def get_faces():
    db, cursor = get_db()
    cursor.execute("SELECT * FROM photo_face_link")
    faces = cursor.fetchall()

    faces = [
        {
            "id": face[0],
            "photo_id": face[1],
            "face_id": face[2],
            "album_id": face[3],
        }
        for face in faces
    ]

    return faces


@router.get("/api/face/{face_id}/photo")
async def get_face_photo(face_id: str):
    db, cursor = get_db()
    cursor.execute(
        "SELECT photo_id FROM photo_face_link WHERE face_id = %s", (face_id,)
    )
    photo_id = cursor.fetchone()

    if not photo_id:
        raise HTTPException(status_code=404, detail="Photo not found for this face")

    return {"photo_id": photo_id[0]}


@router.get("/api/faces")
async def get_faces():
    db, cursor = get_db()
    cursor.execute("SELECT * FROM face_data")
    faces = cursor.fetchall()

    cursor.execute("SELECT * FROM photo_face_link")
    face_photo_links = cursor.fetchall()

    # get the face photo links
    face_photo_links = [
        {
            "face_id": face_photo_link[2],
            "photo_id": face_photo_link[1],
            "album_id": face_photo_link[3],
            "image_url": f"https://{AWS_CLOUDFRONT_URL}/faces/{face_photo_link[2], face_photo_link[1], face_photo_link[3]}.jpg",
        }
        for face_photo_link in face_photo_links
    ]

    # now get the face details and link them to the photo
    faces = [
        {
            "id": face[0],
            "name": face[1],
            "external_id": face[2],
            "image_url": f"https://{AWS_CLOUDFRONT_URL}/faces/{face[2]}.jpg",
            "photo_links": [
                {
                    "photo_id": face_photo_link["photo_id"],
                    "album_id": face_photo_link["album_id"],
                }
                for face_photo_link in face_photo_links
                if face_photo_link["face_id"] == face[2]
            ],
        }
        for face in faces
    ]

    return faces


@router.get("/api/face/{face_id}")
async def get_face(face_id: str):
    db, cursor = get_db()
    cursor.execute("SELECT * FROM face_data WHERE external_id = %s", (face_id,))
    face = cursor.fetchone()

    if not face:
        raise HTTPException(status_code=404, detail="Face not found")

    cursor.execute("SELECT * FROM photo_face_link WHERE face_id = %s", (face[2],))
    face_photo_links = cursor.fetchall()

    face_photo_links = [
        {
            "photo_id": face_photo_link[1],
            "album_id": face_photo_link[3],
        }
        for face_photo_link in face_photo_links
    ]

    face_photos = []

    for face_photo_link in face_photo_links:
        cursor.execute(
            "SELECT * FROM file_metadata WHERE id = %s", (face_photo_link["photo_id"],)
        )
        photo = cursor.fetchone()

        album = cursor.execute(
            "SELECT * FROM album WHERE id = %s", (face_photo_link["album_id"],)
        )
        album = cursor.fetchone()

        album_slug = album[2]

        if not photo:
            continue

        compressed_image_url = (
            f"https://{AWS_CLOUDFRONT_URL}/{album_slug}/compressed/{photo[2]}"
        )
        image_url = f"https://{AWS_CLOUDFRONT_URL}/{album_slug}/{photo[2]}"

        face_photos.append(
            {
                "image": image_url,
                "compressed_image": compressed_image_url,
                "file_metadata": {
                    "id": photo[0],
                    "album_id": photo[1],
                    "name": photo[2],
                    "slug": album_slug,
                    "location": photo[3],
                    "date": photo[4],
                    "upload_date": photo[7],
                    "exif_data": photo[8],
                    "blur_data_url": photo[9],
                },
            }
        )

    return {
        "id": face[0],
        "name": face[1],
        "external_id": face[2],
        "face_photos": face_photos,
    }


@router.put("/api/face/{face_id}")
async def update_face(face_id: str, face: dict):
    db, cursor = get_db()
    cursor.execute(
        "UPDATE face_data SET name = %s WHERE external_id = %s", (face["name"], face_id)
    )
    db.commit()

    return {"message": "Face updated successfully."}
