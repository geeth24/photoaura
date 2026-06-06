from fastapi import HTTPException, APIRouter, Depends
import os
import logging
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from config import settings
from db.base import get_session
from db.models import (
    Album,
    FileMetadata,
    UserAlbumPermission,
    AlbumCategory,
    PhotoFaceLink,
    FaceData,
    FaceEmbedding,
    User,
)
from services.aws_service import s3_client
from botocore.exceptions import ClientError
from utils.utils import create_album_photos_json, add_album_to_user, capture_time
from dependencies import require_admin, get_current_user

router = APIRouter()
AWS_BUCKET = settings.AWS_BUCKET
AWS_CLOUDFRONT_URL = settings.AWS_CLOUDFRONT_URL


@router.get("/api/album/{album_slug}/")
async def get_album(
    album_slug: str,
    secret: str = None,
    orientation: str = None,
    session: Session = Depends(get_session),
):
    album = session.query(Album).filter_by(slug=album_slug).first()

    if album is None:
        raise HTTPException(status_code=404, detail="Album not found")

    photos_query = session.query(FileMetadata).filter_by(album_id=album.id)
    if orientation:
        photos_query = photos_query.filter_by(orientation=orientation)
    file_metadata = photos_query.all()

    if not file_metadata:
        raise HTTPException(status_code=404, detail="No images found in the album")

    album_photos = create_album_photos_json(album_slug, file_metadata)

    permissions = (
        session.query(UserAlbumPermission).filter_by(album_id=album.id).all()
    )
    permissions_list = []
    for perm in permissions:
        user = session.get(User, perm.user_id)
        if user:
            permissions_list.append(
                {
                    "user_id": user.id,
                    "user_name": user.user_name,
                    "full_name": user.full_name,
                    "user_email": user.user_email,
                }
            )

    return {
        "album_id": album.id,
        "album_name": album.name,
        "slug": album.slug,
        "image_count": album.image_count,
        "shared": album.shared,
        "upload": album.upload,
        "secret": album.secret,
        "face_detection": album.face_detection,
        "album_permissions": permissions_list,
        "album_photos": album_photos,
    }


@router.get("/api/albums/")
async def get_all_albums(
    user_id: int = None, session: Session = Depends(get_session)
):
    if user_id:
        albums = (
            session.query(Album)
            .join(UserAlbumPermission, Album.id == UserAlbumPermission.album_id)
            .filter(UserAlbumPermission.user_id == user_id)
            .all()
        )
    else:
        albums = session.query(Album).all()

    all_albums = []
    for album in albums:
        file_metadata = (
            session.query(FileMetadata).filter_by(album_id=album.id).limit(4).all()
        )
        album_photos = create_album_photos_json(album.slug, file_metadata)

        all_albums.append(
            {
                "album_id": album.id,
                "album_name": album.name,
                "slug": album.slug,
                "image_count": album.image_count,
                "shared": album.shared,
                "upload": album.upload,
                "album_photos": album_photos,
            }
        )

    return all_albums


@router.get("/api/photos/")
async def get_all_photos(
    user_id: int = None,
    orientation: str = None,
    session: Session = Depends(get_session),
):
    if user_id:
        albums = (
            session.query(Album)
            .join(UserAlbumPermission, Album.id == UserAlbumPermission.album_id)
            .filter(UserAlbumPermission.user_id == user_id)
            .all()
        )
    else:
        albums = session.query(Album).all()

    all_photos = []
    for album in albums:
        photos_query = session.query(FileMetadata).filter_by(album_id=album.id)
        if orientation:
            photos_query = photos_query.filter_by(orientation=orientation)
        album_photos = create_album_photos_json(album.slug, photos_query.all())
        all_photos.extend(album_photos)

    # chronological across every album, newest first
    all_photos.sort(key=capture_time, reverse=True)
    return all_photos


@router.get("/api/album/{album_slug}/download/{filename:path}")
async def download_original(
    album_slug: str,
    filename: str,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Presigned URL for the EXACT uploaded original. The CDN re-encodes to webp
    (browser Accept negotiation), which downloads as a damaged .jpg — this serves
    the raw S3 bytes with a download disposition instead. Scoped to the caller."""
    album = session.query(Album).filter_by(slug=album_slug).first()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")

    u = session.query(User).filter_by(user_name=current_user.user_name).first()
    if not u:
        raise HTTPException(status_code=401, detail="Unknown user")
    if u.role != "admin":
        allowed = (
            session.query(UserAlbumPermission)
            .filter_by(user_id=u.id, album_id=album.id)
            .first()
        )
        if not allowed:
            raise HTTPException(status_code=403, detail="Not your album")

    url = s3_client.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": AWS_BUCKET,
            "Key": f"{album_slug}/{filename}",
            "ResponseContentDisposition": f'attachment; filename="{filename}"',
        },
        ExpiresIn=3600,
    )
    return {"url": url}


@router.delete("/api/album/delete/{album_slug}/")
async def delete_album(
    album_slug: str,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    try:
        album = session.query(Album).filter_by(slug=album_slug).first()
        if not album:
            raise HTTPException(status_code=404, detail="Album not found")
        album_id = album.id

        face_ids = {
            row[0]
            for row in session.query(PhotoFaceLink.face_id)
            .filter_by(album_id=album_id)
            .all()
            if row[0]
        }
        session.query(PhotoFaceLink).filter_by(album_id=album_id).delete()
        session.query(FaceEmbedding).filter_by(album_id=album_id).delete()
        session.flush()

        # of this album's people, which still appear elsewhere? one query, not N
        still_used = {
            row[0]
            for row in session.query(PhotoFaceLink.face_id)
            .filter(PhotoFaceLink.face_id.in_(face_ids))
            .distinct()
            .all()
        } if face_ids else set()
        orphaned = face_ids - still_used

        if orphaned:
            session.query(FaceEmbedding).filter(
                FaceEmbedding.face_id.in_(orphaned)
            ).delete(synchronize_session=False)
            session.query(FaceData).filter(
                FaceData.external_id.in_(orphaned)
            ).delete(synchronize_session=False)

        session.query(UserAlbumPermission).filter_by(album_id=album_id).delete()
        session.query(AlbumCategory).filter_by(album_id=album_id).delete()

        # capture filenames before deleting the rows (objects expire after)
        filenames = [
            row[0]
            for row in session.query(FileMetadata.filename)
            .filter_by(album_id=album_id)
            .all()
        ]
        session.query(FileMetadata).filter_by(album_id=album_id).delete()
        session.query(Album).filter_by(id=album_id).delete()

        # DB is the source of truth — commit it before the slow S3 cleanup so a
        # storage hiccup can't leave the album half-deleted / un-deletable
        session.commit()

        # best-effort S3 cleanup, batched (delete_objects takes up to 1000 keys)
        keys = [{"Key": f"{album_slug}/{fn}"} for fn in filenames]
        keys += [{"Key": f"faces/{fid}.jpg"} for fid in orphaned]
        for i in range(0, len(keys), 1000):
            try:
                s3_client.delete_objects(
                    Bucket=AWS_BUCKET, Delete={"Objects": keys[i : i + 1000]}
                )
            except Exception as e:
                logging.error(f"album delete: S3 cleanup failed: {e}")

        return {"message": "Album deleted successfully."}

    except HTTPException:
        raise
    except IntegrityError as e:
        session.rollback()
        logging.error(f"ForeignKey violation: {e}")
        raise HTTPException(
            status_code=400, detail="Cannot delete data that is still referenced."
        )
    except Exception as e:
        logging.error(f"Error deleting album: {e}")
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/api/album/")
async def update_album(
    album_name: str,
    album_new_name: str,
    shared: bool,
    upload: bool,
    slug: str,
    user_id: int = None,
    action: str = None,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    old_slug = slug.lower()
    new_slug = album_new_name.lower().replace(" ", "-")

    try:
        session.query(Album).filter_by(slug=old_slug).update(
            {
                "name": album_new_name,
                "shared": shared,
                "upload": upload,
                "location": os.path.join(settings.DATA_DIR, new_slug),
                "slug": new_slug,
            }
        )
        session.commit()

        if old_slug != new_slug:
            try:
                objects_to_rename = s3_client.list_objects_v2(
                    Bucket=AWS_BUCKET, Prefix=f"{old_slug}/"
                )
                for obj in objects_to_rename.get("Contents", []):
                    old_key = obj["Key"]
                    new_key = new_slug + old_key[len(old_slug):]
                    s3_client.copy_object(
                        Bucket=AWS_BUCKET,
                        CopySource=f"{AWS_BUCKET}/{old_key}",
                        Key=new_key,
                    )
                    s3_client.delete_object(Bucket=AWS_BUCKET, Key=old_key)
            except ClientError as e:
                raise HTTPException(
                    status_code=500, detail=f"Failed to rename album in S3: {e}"
                )

        if user_id is not None:
            if action == "update":
                album = session.query(Album).filter_by(name=album_new_name).first()
                if album:
                    add_album_to_user(user_id, album.id)

            elif action == "delete":
                album = session.query(Album).filter_by(name=album_name).first()
                if album:
                    session.query(UserAlbumPermission).filter_by(
                        user_id=user_id, album_id=album.id
                    ).delete()
                    session.commit()

        return {"message": "Album updated successfully."}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Database error: {e}")
        session.rollback()
        raise HTTPException(status_code=500, detail="Database update failed")


@router.get("/api/shared-albums/")
async def get_shared_albums(session: Session = Depends(get_session)):
    albums = session.query(Album).filter_by(shared=True).all()

    all_albums = []
    for album in albums:
        file_metadata = (
            session.query(FileMetadata).filter_by(album_id=album.id).limit(4).all()
        )
        album_photos = create_album_photos_json(album.slug, file_metadata)

        all_albums.append(
            {
                "album_name": album.name,
                "slug": album.slug,
                "image_count": album.image_count,
                "shared": album.shared,
                "upload": album.upload,
                "album_photos": album_photos,
            }
        )

    return all_albums


@router.delete("/api/photo/delete/")
async def delete_photo(
    slug: str,
    photo_name: str,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    album = session.query(Album).filter_by(slug=slug).first()

    if album is None:
        raise HTTPException(status_code=404, detail="Album not found")

    session.query(FileMetadata).filter_by(
        album_id=album.id, filename=photo_name
    ).delete()
    session.flush()

    album.image_count = album.image_count - 1
    session.commit()

    return {"message": "Photo deleted successfully."}
