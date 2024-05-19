from fastapi import APIRouter, HTTPException
from db_config import get_db


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

@router.get("/api/face/{face_id}")
async def get_face(face_id: str):
    db, cursor = get_db()
    cursor.execute("SELECT * FROM photo_face_link WHERE face_id = %s", (face_id,))
    face = cursor.fetchone()

    if not face:
        raise HTTPException(status_code=404, detail="Face not found")

    return {
        "id": face[0],
        "photo_id": face[1],
        "face_id": face[2],
        "album_id": face[3],
    }

@router.get("/api/face/{face_id}/photo")
async def get_face_photo(face_id: str):
    db, cursor = get_db()
    cursor.execute("SELECT photo_id FROM photo_face_link WHERE face_id = %s", (face_id,))
    photo_id = cursor.fetchone()

    if not photo_id:
        raise HTTPException(status_code=404, detail="Photo not found for this face")

    return {"photo_id": photo_id[0]}
    