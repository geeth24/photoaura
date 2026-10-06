import asyncio
import os
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from config import settings
from db.base import get_session, session_scope
from db.models import (
    Album,
    AlbumRevision,
    FaceEmbedding,
    FileMetadata,
    PhotoFaceLink,
    PhotoVersion,
    User,
    UserAlbumPermission,
)
from dependencies import get_current_user, require_admin
from routers.auth.auth_router import issue_magic_link
from routers.files.files_router import (
    _BytesUpload,
    _guess_content_type,
    _process_album,
    _store_one_file,
)
from routers.user.user import _primary_email, _verify_link
from services import email_service, proof_service, upload_jobs
from services.aws_service import s3_client
from utils.image_utils import generate_blur_data_url
from utils.utils import _VERSION_SUFFIX, base_name_of, get_file_metadata

router = APIRouter()
AWS_BUCKET = settings.AWS_BUCKET


def _album(session, slug) -> Album:
    album = session.query(Album).filter_by(slug=slug).first()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    return album


def _can_view(session, current_user, album) -> bool:
    me = session.query(User).filter_by(user_name=current_user.user_name).first()
    if not me:
        return False
    if me.role == "admin":
        return True
    owner = me.parent_user_id or me.id
    return (
        session.query(UserAlbumPermission)
        .filter_by(album_id=album.id, user_id=owner)
        .first()
        is not None
    )


def _match(session, album, filenames):
    """Pair uploaded names with the album's photos by base name. Returns
    (matched [(upload_name, photo)], unmatched [name], duplicates [name])."""
    photos = (
        session.query(FileMetadata)
        .filter(FileMetadata.album_id == album.id, ~FileMetadata.content_type.like("video/%"))
        .all()
    )
    by_base = {}
    for p in photos:
        by_base.setdefault(p.base_name or base_name_of(p.filename), p)

    matched, unmatched, duplicates, seen = [], [], [], set()
    for name in filenames:
        photo = by_base.get(base_name_of(name))
        if not photo:
            unmatched.append(name)
        elif photo.id in seen:
            duplicates.append(name)
        else:
            seen.add(photo.id)
            matched.append((name, photo))
    return matched, unmatched, duplicates


def _revision_json(rev: AlbumRevision):
    return {
        "number": rev.number,
        "note": rev.note,
        "photo_count": rev.photo_count,
        "created_at": rev.created_at,
        "notified_at": rev.notified_at,
    }


def latest_revision(session, album_id) -> Optional[dict]:
    rev = (
        session.query(AlbumRevision)
        .filter_by(album_id=album_id)
        .order_by(AlbumRevision.number.desc())
        .first()
    )
    return _revision_json(rev) if rev else None


class PreviewBody(BaseModel):
    filenames: List[str]


@router.post("/api/album/{slug}/revisions/preview")
def preview_revision(
    slug: str,
    body: PreviewBody,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Dry run: which uploads replace which photos, before anything is sent."""
    album = _album(session, slug)
    matched, unmatched, duplicates = _match(session, album, body.filenames)
    next_number = (
        session.query(func.max(AlbumRevision.number)).filter_by(album_id=album.id).scalar() or 1
    ) + 1
    return {
        "next_number": next_number,
        "matched": [
            {
                "filename": name,
                "photo_id": p.id,
                "current_filename": p.filename,
                "current_version": p.version or 1,
                "next_version": (p.version or 1) + 1,
            }
            for name, p in matched
        ],
        "unmatched": unmatched,
        "duplicates": duplicates,
    }


def _versioned_name(photo: FileMetadata, upload_name: str, version: int, taken: set) -> str:
    """IMG_1234.jpg + version 2 -> IMG_1234_v2.jpg, keeping the original's
    casing and the uploaded file's extension."""
    current = _current_name(photo)
    base = _VERSION_SUFFIX.sub("", os.path.splitext(current)[0])
    ext = os.path.splitext(upload_name)[1] or os.path.splitext(current)[1]
    n = version
    name = f"{base}_v{n}{ext}"
    while name.lower() in taken:
        n += 1
        name = f"{base}_v{n}{ext}"
    return name


def _current_name(photo: FileMetadata) -> str:
    """The photo's real file name; a proof-locked photo's filename is its proof."""
    return photo.original_filename if photo.held and photo.original_filename else photo.filename


def _snapshot(session, photo: FileMetadata):
    session.add(
        PhotoVersion(
            photo_id=photo.id,
            version=photo.version or 1,
            filename=_current_name(photo),
            size=photo.size,
            width=photo.width,
            height=photo.height,
            revision_number=photo.revision_number,
            uploaded_at=photo.upload_date,
        )
    )


def _replace(session, album, photo, upload_name, content, content_type, number, taken):
    """Store a re-edited file as the photo's next version. Returns
    (gallery key to warm, key of the full-resolution file for faces)."""
    version = (photo.version or 1) + 1
    filename = _versioned_name(photo, upload_name, version, taken)
    taken.add(filename.lower())
    old_proof = photo.filename if photo.held else None
    if album.proof_locked:
        gallery_name = proof_service.proof_name(filename, taken)
        key, full_key = proof_service.store_held(album, filename, content, content_type, gallery_name)
    else:
        gallery_name = filename
        key = full_key = f"{album.slug}/{filename}"
        s3_client.put_object(Bucket=AWS_BUCKET, Key=key, Body=content, ContentType=content_type)

    # the first revision of a photo also records what it was before
    if not session.query(PhotoVersion).filter_by(photo_id=photo.id).first():
        _snapshot(session, photo)

    album_dir = os.path.join(settings.DATA_DIR, album.slug)
    os.makedirs(album_dir, exist_ok=True)
    local_path = os.path.join(album_dir, filename)
    with open(local_path, "wb") as f:
        f.write(content)
    try:
        fm = get_file_metadata(album.id, local_path, _BytesUpload(content))
    finally:
        if os.path.exists(local_path):
            os.remove(local_path)

    photo.filename = gallery_name
    photo.original_filename = filename if album.proof_locked else None
    photo.held = bool(album.proof_locked)
    photo.version = version
    photo.revision_number = number
    photo.content_type = content_type
    photo.size = fm["size"]
    photo.width = fm["width"]
    photo.height = fm["height"]
    photo.exif_data = fm["exif_data"]
    photo.orientation = fm["orientation"]
    photo.upload_date = datetime.now()
    photo.blur_data_url = generate_blur_data_url(content)
    # new pixels, so its faces get detected again
    session.query(PhotoFaceLink).filter_by(photo_id=photo.id).delete()
    session.query(FaceEmbedding).filter_by(photo_id=photo.id).delete()
    session.flush()
    _snapshot(session, photo)
    # the previous version's original stays held; only its proof goes
    if old_proof:
        try:
            s3_client.delete_object(Bucket=AWS_BUCKET, Key=f"{album.slug}/{old_proof}")
        except Exception as e:
            print(f"revision: could not delete old proof {old_proof}: {e}")
    return key, full_key


def notify_revision(album_id: int, number: int) -> list:
    """Email everyone with access to the album (and their family) a sign-in
    link that lands on the revision."""
    with session_scope() as session:
        album = session.get(Album, album_id)
        rev = session.query(AlbumRevision).filter_by(album_id=album_id, number=number).first()
        if not album or not rev:
            return []
        owners = [
            uid for (uid,) in session.query(UserAlbumPermission.user_id).filter_by(album_id=album_id).all()
        ]
        people = session.query(User).filter(User.id.in_(owners)).all() if owners else []
        people += session.query(User).filter(User.parent_user_id.in_(owners)).all() if owners else []
        people = [u for u in {u.id: u for u in people}.values() if (u.role or "client") != "admin"]

        links = []
        for u in people:
            email = _primary_email(session, u)
            if not email:
                continue
            token = issue_magic_link(session, u, "login")
            links.append((email, u.full_name or "there", _verify_link(token, f"/albums/{album.slug}?revision={number}")))
        session.commit()

        sent = [
            e for e, name, link in links
            if email_service.send_album_revision(e, name, link, album.name, number, rev.photo_count, rev.note)
        ]
        if sent:
            rev.notified_at = datetime.now()
            session.commit()
        return sent


async def _process_and_notify(album_id, slug, face_targets, keys, image_count, number, notify):
    await _process_album(album_id, slug, face_targets, keys, True, image_count)
    if notify:
        try:
            sent = await asyncio.to_thread(notify_revision, album_id, number)
            print(f"revision {number} of {slug}: emailed {len(sent)}")
        except Exception as e:
            print(f"revision {number} of {slug}: notify failed: {e}")


@router.post("/api/album/{slug}/revisions")
async def upload_revision(
    slug: str,
    files: List[UploadFile] = File(...),
    note: Optional[str] = Form(None),
    notify: bool = Form(True),
    add_unmatched: bool = Form(False),
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Push re-edited photos to a delivered album as the next revision. Each
    upload replaces the photo with the same base name; the old file is kept."""
    album = _album(session, slug)
    matched, unmatched, duplicates = _match(session, album, [f.filename for f in files])
    if not matched and not (add_unmatched and unmatched):
        raise HTTPException(
            status_code=400,
            detail="None of these files match a photo in this gallery. Revisions replace photos by filename.",
        )

    number = (
        session.query(func.max(AlbumRevision.number)).filter_by(album_id=album.id).scalar() or 1
    ) + 1
    rev = AlbumRevision(album_id=album.id, number=number, note=(note or "").strip() or None)
    session.add(rev)
    session.flush()

    by_name = {f.filename: f for f in files}
    taken = proof_service.taken_names(session, album.id)
    face_targets, keys, updated, added = [], [], [], []

    for name, photo in matched:
        upload = by_name[name]
        content = await upload.read()
        ctype = upload.content_type or _guess_content_type(name)
        key, full_key = _replace(session, album, photo, name, content, ctype, number, taken)
        keys.append(key)
        if album.face_detection:
            face_targets.append((full_key, photo.id))
        updated.append({"uploaded": name, "filename": photo.filename, "version": photo.version})
    session.commit()

    if add_unmatched:
        for name in unmatched:
            upload = by_name[name]
            content = await upload.read()
            _store_one_file(
                content, name, upload.content_type or _guess_content_type(name),
                album, session, bool(album.face_detection), face_targets, keys,
            )
            meta = (
                session.query(FileMetadata)
                .filter(
                    FileMetadata.album_id == album.id,
                    (FileMetadata.filename == name) | (FileMetadata.original_filename == name),
                )
                .first()
            )
            if meta:
                meta.revision_number = number
            added.append(name)
        unmatched = []

    rev.photo_count = len(updated) + len(added)
    album.image_count = session.query(FileMetadata).filter_by(album_id=album.id).count()
    session.commit()

    upload_jobs.start_job(slug, face_detection=bool(face_targets), image_count=album.image_count)
    asyncio.create_task(
        _process_and_notify(album.id, slug, face_targets, keys, album.image_count, number, notify)
    )
    return {
        "revision": _revision_json(rev),
        "updated": updated,
        "added": added,
        "unmatched": unmatched,
        "duplicates": duplicates,
        "processing": True,
    }


@router.get("/api/album/{slug}/revisions")
def list_revisions(
    slug: str,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Revision history, newest first, with the current filename of every
    photo each revision touched (what a client filters the grid by)."""
    album = _album(session, slug)
    if not _can_view(session, current_user, album):
        raise HTTPException(status_code=403, detail="Not your album")

    revs = (
        session.query(AlbumRevision)
        .filter_by(album_id=album.id)
        .order_by(AlbumRevision.number.desc())
        .all()
    )
    current = {
        p.id: p.filename
        for p in session.query(FileMetadata).filter_by(album_id=album.id).all()
    }
    touched = {}
    for pv in (
        session.query(PhotoVersion)
        .join(FileMetadata, FileMetadata.id == PhotoVersion.photo_id)
        .filter(FileMetadata.album_id == album.id, PhotoVersion.revision_number.isnot(None))
        .all()
    ):
        touched.setdefault(pv.revision_number, set()).add(pv.photo_id)
    # photos added (not replaced) in a revision have no version history
    for p in session.query(FileMetadata).filter(
        FileMetadata.album_id == album.id,
        FileMetadata.revision_number.isnot(None),
        FileMetadata.version == 1,
    ):
        touched.setdefault(p.revision_number, set()).add(p.id)

    return [
        {**_revision_json(r), "filenames": sorted(current[i] for i in touched.get(r.number, ()) if i in current)}
        for r in revs
    ]


@router.get("/api/photo/{photo_id}/versions")
def photo_versions(
    photo_id: int,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Every version of one photo, oldest first, so a client can compare edits."""
    photo = session.get(FileMetadata, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    album = session.get(Album, photo.album_id)
    if not album or not _can_view(session, current_user, album):
        raise HTTPException(status_code=403, detail="Not your album")
    # earlier versions are clean full-resolution files held until the final payment
    if album.proof_locked:
        return []
    from utils.utils import build_photo_json

    rows = session.query(PhotoVersion).filter_by(photo_id=photo_id).order_by(PhotoVersion.version).all()
    out = []
    for v in rows:
        urls = build_photo_json(
            FileMetadata(filename=v.filename, content_type=photo.content_type), album.slug
        )
        out.append(
            {
                "version": v.version,
                "filename": v.filename,
                "revision_number": v.revision_number,
                "uploaded_at": v.uploaded_at,
                "width": v.width,
                "height": v.height,
                "image": urls["image"],
                "compressed_image": urls["compressed_image"],
            }
        )
    return out


@router.post("/api/album/{slug}/revisions/{number}/notify")
def resend_revision_email(
    slug: str,
    number: int,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    album = _album(session, slug)
    sent = notify_revision(album.id, number)
    if not sent:
        raise HTTPException(status_code=502, detail="No emails were sent")
    return {"message": "Sent", "to": sent}
