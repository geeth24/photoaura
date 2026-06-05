"""Client deliverable files — a lightweight 'drive' for handing finished work
to clients. Admin attaches a raw file (e.g. a zip of originals) to a client,
optionally tied to an album; the client downloads it from their Downloads tab.
"""

import os
from uuid import uuid4

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
)
from sqlalchemy.orm import Session

from config import settings
from db.base import get_session
from db.models import Album, ClientFile, User as UserModel
from dependencies import get_current_user, require_admin
from services.aws_service import s3_client

router = APIRouter()
AWS_BUCKET = settings.AWS_BUCKET


def _me(session: Session, current_user) -> UserModel:
    u = session.query(UserModel).filter_by(user_name=current_user.user_name).first()
    if not u:
        raise HTTPException(status_code=401, detail="Account not found")
    return u


def _file_json(cf: ClientFile, session: Session, with_url: bool = False) -> dict:
    album = session.get(Album, cf.album_id) if cf.album_id else None
    client = session.get(UserModel, cf.user_id)
    data = {
        "id": cf.id,
        "user_id": cf.user_id,
        "client_name": client.full_name if client else None,
        "client_email": client.user_email if client else None,
        "album_id": cf.album_id,
        "album_name": album.name if album else None,
        "filename": cf.filename,
        "size": cf.size,
        "content_type": cf.content_type,
        "created_at": cf.created_at.isoformat() if cf.created_at else None,
    }
    if with_url:
        data["download_url"] = s3_client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": AWS_BUCKET,
                "Key": cf.s3_key,
                # force a download with the original filename
                "ResponseContentDisposition": f'attachment; filename="{cf.filename}"',
            },
            ExpiresIn=3600,
        )
    return data


# ---- admin ----

@router.post("/api/client-files")
async def upload_client_file(
    file: UploadFile = File(...),
    user_id: int = Form(...),
    album_id: int = Form(None),
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Attach a downloadable file to a client (admin only)."""
    user = session.get(UserModel, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if album_id is not None and not session.get(Album, album_id):
        raise HTTPException(status_code=404, detail="Album not found")

    safe_name = os.path.basename(file.filename or "download")
    s3_key = f"deliverables/{user_id}/{uuid4().hex}-{safe_name}"
    ctype = file.content_type or "application/octet-stream"

    # measure size without loading the file into memory
    file.file.seek(0, os.SEEK_END)
    size = file.file.tell()
    file.file.seek(0)

    # stream to S3 in multipart chunks (constant memory) instead of reading
    # the whole zip into RAM — deliverable zips can be multiple GB.
    s3_client.upload_fileobj(
        file.file,
        AWS_BUCKET,
        s3_key,
        ExtraArgs={"ContentType": ctype},
    )

    cf = ClientFile(
        user_id=user_id,
        album_id=album_id,
        filename=safe_name,
        s3_key=s3_key,
        size=size,
        content_type=ctype,
    )
    session.add(cf)
    session.commit()
    session.refresh(cf)
    return _file_json(cf, session)


@router.get("/api/client-files")
def list_client_files(
    user_id: int = None,
    album_id: int = None,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    """List deliverables, optionally filtered by user or album (admin only)."""
    q = session.query(ClientFile)
    if user_id is not None:
        q = q.filter_by(user_id=user_id)
    if album_id is not None:
        q = q.filter_by(album_id=album_id)
    rows = q.order_by(ClientFile.created_at.desc()).all()
    return [_file_json(cf, session, with_url=True) for cf in rows]


@router.delete("/api/client-files/{file_id}")
def delete_client_file(
    file_id: int,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Delete a deliverable + its S3 object (admin only)."""
    cf = session.get(ClientFile, file_id)
    if not cf:
        raise HTTPException(status_code=404, detail="File not found")
    try:
        s3_client.delete_object(Bucket=AWS_BUCKET, Key=cf.s3_key)
    except Exception as e:
        print("s3 delete error:", e)
    session.delete(cf)
    session.commit()
    return {"message": "Deleted"}


# ---- client ----

@router.get("/api/me/files")
def list_my_files(
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Files the signed-in client can download, each with a presigned URL."""
    me = _me(session, current_user)
    rows = (
        session.query(ClientFile)
        .filter_by(user_id=me.id)
        .order_by(ClientFile.created_at.desc())
        .all()
    )
    return [_file_json(cf, session, with_url=True) for cf in rows]
