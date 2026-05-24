from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from config import settings
from db.base import get_session
from db.models import FaceData, PhotoFaceLink, FileMetadata, Album
from utils.utils import create_album_photos_json
from dependencies import get_current_user

router = APIRouter()
AWS_BUCKET = settings.AWS_BUCKET
AWS_CLOUDFRONT_URL = settings.AWS_CLOUDFRONT_URL


@router.get("/api/face")
async def get_faces(
    current_user=Depends(get_current_user), session: Session = Depends(get_session)
):
    faces = session.query(PhotoFaceLink).all()
    return [
        {
            "id": face.id,
            "photo_id": face.photo_id,
            "face_id": face.face_id,
            "album_id": face.album_id,
        }
        for face in faces
    ]


@router.get("/api/face/{face_id}/photo")
async def get_face_photo(
    face_id: str,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    link = (
        session.query(PhotoFaceLink.photo_id).filter_by(face_id=face_id).first()
    )

    if not link:
        raise HTTPException(status_code=404, detail="Photo not found for this face")

    return {"photo_id": link[0]}


@router.get("/api/faces")
async def get_faces(
    current_user=Depends(get_current_user), session: Session = Depends(get_session)
):
    faces = session.query(FaceData).all()
    links = session.query(PhotoFaceLink).all()

    face_photo_links = [
        {
            "face_id": link.face_id,
            "photo_id": link.photo_id,
            "album_id": link.album_id,
            "image_url": f"https://{AWS_CLOUDFRONT_URL}/faces/{link.face_id}-{link.photo_id}-{link.album_id}.jpg",
        }
        for link in links
    ]

    return [
        {
            "id": face.id,
            "name": face.name,
            "external_id": face.external_id,
            "image_url": f"https://{AWS_CLOUDFRONT_URL}/faces/{face.external_id}.jpg",
            "photo_links": [
                {
                    "photo_id": fpl["photo_id"],
                    "album_id": fpl["album_id"],
                }
                for fpl in face_photo_links
                if fpl["face_id"] == face.external_id
            ],
        }
        for face in faces
    ]


@router.get("/api/face/{face_id}")
async def get_face(
    face_id: str,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    face = session.query(FaceData).filter_by(external_id=face_id).first()

    if not face:
        raise HTTPException(status_code=404, detail="Face not found")

    links = session.query(PhotoFaceLink).filter_by(face_id=face.external_id).all()
    face_photo_links = [
        {"photo_id": link.photo_id, "album_id": link.album_id} for link in links
    ]

    face_photos = []
    for fpl in face_photo_links:
        photo = session.get(FileMetadata, fpl["photo_id"])
        if not photo:
            continue

        album = session.get(Album, fpl["album_id"])
        if not album:
            continue

        album_slug = album.slug

        compressed_image_url = f"https://{AWS_CLOUDFRONT_URL}/fit-in/720x0/{album_slug}/{photo.filename}"
        image_url = f"https://{AWS_CLOUDFRONT_URL}/fit-in/1920x0/{album_slug}/{photo.filename}"
        face_photos.append(
            {
                "image": image_url,
                "compressed_image": compressed_image_url,
                "file_metadata": {
                    "id": photo.id,
                    "album_id": photo.album_id,
                    "name": photo.filename,
                    "slug": album_slug,
                    "location": photo.content_type,
                    "date": photo.size,
                    "upload_date": photo.upload_date,
                    "exif_data": photo.exif_data,
                    "blur_data_url": photo.blur_data_url,
                },
            }
        )

    return {
        "id": face.id,
        "name": face.name,
        "external_id": face.external_id,
        "face_photos": face_photos,
    }


@router.put("/api/face/{face_id}")
async def update_face(
    face_id: str,
    face: dict,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    session.query(FaceData).filter_by(external_id=face_id).update(
        {"name": face["name"]}
    )
    return {"message": "Face updated successfully."}
