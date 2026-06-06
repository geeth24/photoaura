from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from config import settings
from db.base import get_session, session_scope
from db.models import FaceData, FaceEmbedding, PhotoFaceLink, FileMetadata, Album
from utils.utils import create_album_photos_json
from utils.face_recog import detect_and_store_faces, MATCH_DIST, SUGGEST_DIST
from dependencies import get_current_user, require_admin
from services.aws_service import s3_client

router = APIRouter()
AWS_BUCKET = settings.AWS_BUCKET
AWS_CLOUDFRONT_URL = settings.AWS_CLOUDFRONT_URL


def _resync_album_faces(album_id: int, album_slug: str):
    """Re-run face detection over every photo in an album. Runs in a
    background task so the request returns immediately. Clears the album's
    existing face links first so re-runs don't leave stale data."""
    with session_scope() as session:
        session.query(PhotoFaceLink).filter_by(album_id=album_id).delete()
        session.query(FaceEmbedding).filter_by(album_id=album_id).delete()
        photos = (
            session.query(FileMetadata.filename, FileMetadata.id, FileMetadata.content_type)
            .filter_by(album_id=album_id)
            .all()
        )

    done = 0
    for filename, meta_id, content_type in photos:
        if (content_type or "").startswith("video/"):
            continue
        s3_key = f"{album_slug}/{filename}"
        try:
            detect_and_store_faces(s3_key, meta_id, album_id, AWS_BUCKET)
            done += 1
        except Exception as e:
            print(f"resync: face detection failed for {s3_key}: {e}")
    print(f"resync: album {album_slug!r} done — processed {done}/{len(photos)} photos")


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


@router.get("/api/face/{face_id}/suggestions")
def face_suggestions(
    face_id: str,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Other people whose embeddings sit just past the auto-merge line from this
    one — likely the same person split in two. Cosine band between the match and
    suggest thresholds. The admin reviews + merges manually."""
    targets = (
        session.query(FaceEmbedding.embedding)
        .filter(FaceEmbedding.face_id == face_id)
        .limit(8)
        .all()
    )
    if not targets:
        return []

    # min distance to each OTHER person across our sampled target embeddings
    best: dict[str, float] = {}
    for (emb,) in targets:
        rows = (
            session.query(
                FaceEmbedding.face_id,
                FaceEmbedding.embedding.cosine_distance(emb).label("dist"),
            )
            .filter(
                FaceEmbedding.face_id.isnot(None),
                FaceEmbedding.face_id != face_id,
            )
            .order_by("dist")
            .limit(30)
            .all()
        )
        for fid, dist in rows:
            if dist is None or dist > SUGGEST_DIST:
                continue
            if fid not in best or dist < best[fid]:
                best[fid] = dist

    out = []
    for fid, dist in sorted(best.items(), key=lambda kv: kv[1]):
        fd = session.query(FaceData).filter_by(external_id=fid).first()
        if not fd:
            continue
        cnt = session.query(PhotoFaceLink).filter_by(face_id=fid).count()
        out.append({
            "external_id": fid,
            "name": fd.name,
            "similarity": round((1 - dist) * 100, 1),
            "count": cnt,
            "image_url": f"https://{AWS_CLOUDFRONT_URL}/faces/{fid}.jpg",
        })
    return out[:12]


class MergeFacesBody(BaseModel):
    target_face_id: str
    source_face_ids: list[str]


@router.post("/api/faces/merge")
def merge_faces(
    body: MergeFacesBody,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Merge one or more people into a target person: repoint all their photo
    links to the target, inherit a name if the target has none, then drop the
    source people (DB + Rekognition + S3 chip)."""
    target = session.query(FaceData).filter_by(external_id=body.target_face_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target person not found")

    for src_id in body.source_face_ids:
        if src_id == body.target_face_id:
            continue
        # move this person's photo links + embeddings onto the target
        session.query(PhotoFaceLink).filter_by(face_id=src_id).update(
            {"face_id": body.target_face_id}, synchronize_session=False
        )
        session.query(FaceEmbedding).filter_by(face_id=src_id).update(
            {"face_id": body.target_face_id}, synchronize_session=False
        )
        src = session.query(FaceData).filter_by(external_id=src_id).first()
        if src:
            if not target.name and src.name:
                target.name = src.name
            session.delete(src)
        # drop the merged person's S3 key chip
        try:
            s3_client.delete_object(Bucket=AWS_BUCKET, Key=f"faces/{src_id}.jpg")
        except Exception:
            pass

    session.flush()

    # dedupe: a photo that had both people now has two identical target links
    keep = {
        pid: mid
        for pid, mid in session.query(
            PhotoFaceLink.photo_id, func.min(PhotoFaceLink.id)
        )
        .filter_by(face_id=body.target_face_id)
        .group_by(PhotoFaceLink.photo_id)
        .all()
    }
    if keep:
        session.query(PhotoFaceLink).filter(
            PhotoFaceLink.face_id == body.target_face_id,
            ~PhotoFaceLink.id.in_(list(keep.values())),
        ).delete(synchronize_session=False)

    session.commit()
    return {"message": "Merged", "target": body.target_face_id}


@router.post("/api/album/{album_slug}/resync-faces")
async def resync_album_faces(
    album_slug: str,
    background: BackgroundTasks,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Kick off a background re-run of face detection for the whole album.
    Returns immediately; the work happens off-request (admin only)."""
    album = session.query(Album).filter_by(slug=album_slug).first()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    count = session.query(FileMetadata).filter_by(album_id=album.id).count()
    background.add_task(_resync_album_faces, album.id, album.slug)
    return {"message": "Face resync started", "photos": count}


@router.get("/api/album/{album_slug}/faces")
async def get_album_faces(
    album_slug: str,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Distinct people detected in an album, each with a key face crop and the
    filenames of the photos they appear in (so the client can filter the grid)."""
    album = session.query(Album).filter_by(slug=album_slug).first()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")

    links = session.query(PhotoFaceLink).filter_by(album_id=album.id).all()

    by_face: dict[str, list[str]] = {}
    for link in links:
        photo = session.get(FileMetadata, link.photo_id)
        if not photo:
            continue
        by_face.setdefault(link.face_id, []).append(photo.filename)

    faces = []
    for face_id, filenames in by_face.items():
        face = session.query(FaceData).filter_by(external_id=face_id).first()
        faces.append(
            {
                "face_id": face_id,
                "name": face.name if face else None,
                # thumbor form so the client loader can resize the crop
                "image_url": f"https://{AWS_CLOUDFRONT_URL}/fit-in/720x0/faces/{face_id}.jpg",
                "count": len(filenames),
                "filenames": filenames,
            }
        )

    # most-photographed people first
    faces.sort(key=lambda f: f["count"], reverse=True)
    return faces


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
