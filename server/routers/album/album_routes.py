from fastapi import HTTPException, APIRouter, Depends
from fastapi.responses import StreamingResponse
import os
import io
import re
import zipfile
import logging
from datetime import datetime, timedelta
import jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from config import settings
from db.base import get_session
from db.models import (
    Album,
    FileMetadata,
    PhotoFavorite,
    UserAlbumPermission,
    AlbumCategory,
    PhotoFaceLink,
    FaceData,
    FaceEmbedding,
    User,
)
from services.aws_service import s3_client, invalidate_cdn
from botocore.exceptions import ClientError
from utils.utils import access_user_id, create_album_photos_json, add_album_to_user, capture_time, slugify
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
        "public": bool(album.public),
        "face_detection": album.face_detection,
        "album_permissions": permissions_list,
        "album_photos": album_photos,
    }


@router.get("/api/albums/")
async def get_all_albums(
    user_id: int = None,
    include_website: bool = False,
    session: Session = Depends(get_session),
):
    # website-management albums live under /website, not the client Albums list.
    # the /website CMS pages pass include_website=true to list them for linking.
    filters = [] if include_website else [Album.is_website.isnot(True)]
    user_id = access_user_id(session, user_id)
    if user_id:
        albums = (
            session.query(Album)
            .join(UserAlbumPermission, Album.id == UserAlbumPermission.album_id)
            .filter(UserAlbumPermission.user_id == user_id, *filters)
            .all()
        )
    else:
        albums = session.query(Album).filter(*filters).all()

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
    not_website = Album.is_website.isnot(True)
    user_id = access_user_id(session, user_id)
    if user_id:
        albums = (
            session.query(Album)
            .join(UserAlbumPermission, Album.id == UserAlbumPermission.album_id)
            .filter(UserAlbumPermission.user_id == user_id, not_website)
            .all()
        )
    else:
        albums = session.query(Album).filter(not_website).all()

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


@router.get("/api/album/{album_slug}/view")
async def view_shared_album(
    album_slug: str,
    secret: str = None,
    session: Session = Depends(get_session),
):
    """Public share view. A private album requires the matching secret (the
    one baked into the share link); a public album opens for anyone. Returns
    only gallery data — never permissions or client emails."""
    album = session.query(Album).filter_by(slug=album_slug).first()
    if not album:
        raise HTTPException(status_code=404, detail="Gallery not found")

    if not album.public:
        if not secret or secret != album.secret:
            raise HTTPException(
                status_code=403, detail="This gallery is private — open it from the share link."
            )

    photos = session.query(FileMetadata).filter_by(album_id=album.id).all()
    return {
        "album_id": album.id,
        "album_name": album.name,
        "slug": album.slug,
        "image_count": album.image_count,
        "public": bool(album.public),
        "album_photos": create_album_photos_json(album.slug, photos),
    }


class VisibilityBody(BaseModel):
    public: bool


@router.patch("/api/album/{album_slug}/visibility")
async def set_album_visibility(
    album_slug: str,
    body: VisibilityBody,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Toggle whether the album is openable without the share secret (admin)."""
    album = session.query(Album).filter_by(slug=album_slug).first()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    album.public = body.public
    session.commit()
    return {"slug": album_slug, "public": bool(album.public)}


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
            .filter_by(user_id=u.parent_user_id or u.id, album_id=album.id)
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


class FavoriteBody(BaseModel):
    filename: str
    favorite: bool


def _album_for_user(album_slug: str, current_user, session: Session):
    """Resolve the album and confirm the caller may see it."""
    album = session.query(Album).filter_by(slug=album_slug).first()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    u = session.query(User).filter_by(user_name=current_user.user_name).first()
    if not u:
        raise HTTPException(status_code=401, detail="Unknown user")
    if u.role != "admin":
        allowed = (
            session.query(UserAlbumPermission)
            .filter_by(user_id=u.parent_user_id or u.id, album_id=album.id)
            .first()
        )
        if not allowed:
            raise HTTPException(status_code=403, detail="Not your album")
    return album, u


@router.get("/api/album/{album_slug}/favorites")
async def list_favorites(
    album_slug: str,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Filenames the signed-in client has starred in this album."""
    album, u = _album_for_user(album_slug, current_user, session)
    rows = (
        session.query(FileMetadata.filename)
        .join(PhotoFavorite, PhotoFavorite.photo_id == FileMetadata.id)
        .filter(PhotoFavorite.user_id == u.id, FileMetadata.album_id == album.id)
        .all()
    )
    return {"filenames": [r[0] for r in rows]}


@router.post("/api/album/{album_slug}/favorites")
async def set_favorite(
    album_slug: str,
    body: FavoriteBody,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Star or unstar one photo for the signed-in client."""
    album, u = _album_for_user(album_slug, current_user, session)
    photo = (
        session.query(FileMetadata)
        .filter_by(album_id=album.id, filename=body.filename)
        .first()
    )
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    existing = (
        session.query(PhotoFavorite)
        .filter_by(user_id=u.id, photo_id=photo.id)
        .first()
    )
    if body.favorite and not existing:
        session.add(
            PhotoFavorite(user_id=u.id, photo_id=photo.id, album_id=album.id)
        )
    elif not body.favorite and existing:
        session.delete(existing)
    session.commit()
    return {"filename": body.filename, "favorite": body.favorite}


@router.get("/api/album/{album_slug}/favorites/summary")
async def favorites_summary(
    album_slug: str,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Every client's picks for this album — what to retouch or print."""
    album = session.query(Album).filter_by(slug=album_slug).first()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")

    rows = (
        session.query(User.id, User.full_name, User.user_email, FileMetadata.filename)
        .join(PhotoFavorite, PhotoFavorite.user_id == User.id)
        .join(FileMetadata, FileMetadata.id == PhotoFavorite.photo_id)
        .filter(PhotoFavorite.album_id == album.id)
        .order_by(User.full_name)
        .all()
    )
    by_client: dict = {}
    for uid, name, email, filename in rows:
        entry = by_client.setdefault(
            uid, {"user_id": uid, "full_name": name, "user_email": email, "filenames": []}
        )
        entry["filenames"].append(filename)
    clients = list(by_client.values())
    return {"clients": clients, "total": sum(len(c["filenames"]) for c in clients)}


DOWNLOAD_SCOPE = "album-download"


class _ZipSink(io.RawIOBase):
    """Buffer zipfile writes into so the generator can flush them downstream.
    zipfile handles a non-seekable sink by emitting data descriptors."""

    def __init__(self):
        self._buf = bytearray()

    def writable(self):
        return True

    def write(self, b):
        self._buf += b
        return len(b)

    def drain(self) -> bytes:
        chunk = bytes(self._buf)
        del self._buf[:]
        return chunk


def _stream_zip(entries):
    """Yield a ZIP of (s3_key, name) built on the fly. Stored (not deflated) —
    photos and video are already compressed, so deflate only burns CPU — and
    streamed a chunk at a time so a multi-GB album never lands in memory."""
    sink = _ZipSink()
    with zipfile.ZipFile(sink, mode="w", compression=zipfile.ZIP_STORED, allowZip64=True) as zf:
        for s3_key, name in entries:
            try:
                body = s3_client.get_object(Bucket=AWS_BUCKET, Key=s3_key)["Body"]
            except ClientError as e:
                logging.warning("zip: skipping %s (%s)", s3_key, e)
                continue
            with zf.open(name, mode="w") as dest:
                for chunk in body.iter_chunks(1024 * 1024):
                    dest.write(chunk)
                    data = sink.drain()
                    if data:
                        yield data
            data = sink.drain()
            if data:
                yield data
    yield sink.drain()


def _safe_zip_name(name: str) -> str:
    cleaned = re.sub(r'[\\/:*?"<>|]+', "-", name).strip() or "gallery"
    return cleaned[:80]


@router.post("/api/album/{album_slug}/download-ticket")
async def create_download_ticket(
    album_slug: str,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Short-lived, album-scoped ticket for the zip download. A browser
    navigation can't send an Authorization header, and putting the real
    session token in the URL would leak it into proxy logs."""
    album = session.query(Album).filter_by(slug=album_slug).first()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")

    u = session.query(User).filter_by(user_name=current_user.user_name).first()
    if not u:
        raise HTTPException(status_code=401, detail="Unknown user")
    if u.role != "admin":
        allowed = (
            session.query(UserAlbumPermission)
            .filter_by(user_id=u.parent_user_id or u.id, album_id=album.id)
            .first()
        )
        if not allowed:
            raise HTTPException(status_code=403, detail="Not your album")

    ticket = jwt.encode(
        {
            "sub": current_user.user_name,
            "album": album_slug,
            "scope": DOWNLOAD_SCOPE,
            "exp": datetime.utcnow() + timedelta(minutes=15),
        },
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    return {"ticket": ticket}


@router.get("/api/album/{album_slug}/download-all")
def download_album_zip(
    album_slug: str,
    ticket: str = None,
    secret: str = None,
    session: Session = Depends(get_session),
):
    """Every original in the album as one streamed zip. Authorized either by a
    download ticket (signed-in client) or the share secret / public flag, so a
    share-link visitor can grab the whole gallery too."""
    album = session.query(Album).filter_by(slug=album_slug).first()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")

    allowed = False
    if ticket:
        try:
            payload = jwt.decode(
                ticket, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
            )
            allowed = (
                payload.get("scope") == DOWNLOAD_SCOPE
                and payload.get("album") == album_slug
            )
        except jwt.PyJWTError:
            allowed = False
    if not allowed and (album.public or (secret and secret == album.secret)):
        allowed = True
    if not allowed:
        raise HTTPException(status_code=403, detail="Not authorized for this gallery")

    photos = session.query(FileMetadata).filter_by(album_id=album.id).all()
    if not photos:
        raise HTTPException(status_code=404, detail="Nothing to download")

    entries = [(f"{album.slug}/{p.filename}", p.filename) for p in photos]
    zip_name = _safe_zip_name(album.name or album.slug)
    return StreamingResponse(
        _stream_zip(entries),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{zip_name}.zip"'},
    )


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

        # purge the CDN so deleted images can't linger in CloudFront's cache and
        # reappear on a re-upload (the SIH thumbor/base64 URLs can't be targeted
        # by key prefix, so invalidate everything — deletes are infrequent)
        invalidate_cdn()

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
    new_slug = slugify(album_new_name)

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
    from db.models import PhotoFaceLink, FaceEmbedding

    album = session.query(Album).filter_by(slug=slug).first()

    if album is None:
        raise HTTPException(status_code=404, detail="Album not found")

    photo = (
        session.query(FileMetadata)
        .filter_by(album_id=album.id, filename=photo_name)
        .first()
    )
    if photo is None:
        raise HTTPException(status_code=404, detail="Photo not found")

    # clear face references first — photo_face_link's FK has no cascade, so a
    # tagged photo (one assigned to a person) can't be deleted until these go
    session.query(PhotoFaceLink).filter_by(photo_id=photo.id).delete()
    session.query(FaceEmbedding).filter_by(photo_id=photo.id).delete()
    session.delete(photo)
    session.flush()

    album.image_count = max(0, album.image_count - 1)
    session.commit()

    return {"message": "Photo deleted successfully."}
