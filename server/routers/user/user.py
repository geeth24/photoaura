from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session
from models.user import User, UpdateUserForm
from db.base import get_session, session_scope
from db.models import User as UserModel, UserAlbumPermission, Album, UserEmail
from dependencies import oauth2_scheme, get_current_user, require_admin
from routers.auth.auth_router import (
    create_token,
    get_password_hash,
    verify_password,
    issue_magic_link,
    CLIENT_URL,
)
from services import email_service
from services.email_service import send_invite, send_verify_email
from utils.utils import access_user_id

router = APIRouter()


class InviteClientBody(BaseModel):
    full_name: str
    email: str
    album_slug: str
    user_name: Optional[str] = None


class AddEmailBody(BaseModel):
    email: str


class UpdateMeBody(BaseModel):
    user_name: Optional[str] = None
    full_name: Optional[str] = None


# username rules: 3-30 chars, lowercase letters / digits / underscore / dash
_USERNAME_PATTERN = r"^[a-z0-9_\-]{3,30}$"


def _validate_user_name(value: str) -> str:
    import re
    cleaned = value.strip().lower()
    if not re.match(_USERNAME_PATTERN, cleaned):
        raise HTTPException(
            status_code=400,
            detail="Username must be 3-30 lowercase letters, numbers, underscore, or dash.",
        )
    return cleaned


def _me(session: Session, current_user) -> UserModel:
    u = (
        session.query(UserModel).filter_by(user_name=current_user.user_name).first()
    )
    if not u:
        raise HTTPException(status_code=401, detail="Account not found")
    return u


@router.get("/api/me")
def get_me(
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Fresh current-user record (role included) — lets the web refresh its
    cached user so role changes propagate without a forced re-login."""
    me = _me(session, current_user)
    return {
        "id": me.id,
        "user_name": me.user_name,
        "full_name": me.full_name,
        "user_email": me.user_email,
        "role": me.role,
    }


@router.get("/api/me/emails")
def list_my_emails(
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    from datetime import datetime

    me = _me(session, current_user)
    rows = (
        session.query(UserEmail)
        .filter_by(user_id=me.id)
        .order_by(UserEmail.is_primary.desc(), UserEmail.id)
        .all()
    )
    # lazy backfill for clients invited before user_emails existed —
    # if the user has a legacy `user_email` column but no rows, seed one
    # as primary + verified (they already signed in successfully, so it is)
    if not rows and me.user_email:
        ue = UserEmail(
            user_id=me.id,
            email=me.user_email,
            is_primary=True,
            verified_at=datetime.now(),
        )
        session.add(ue)
        session.flush()
        rows = [ue]
    return [
        {
            "id": r.id,
            "email": r.email,
            "verified_at": r.verified_at,
            "is_primary": r.is_primary,
        }
        for r in rows
    ]


@router.patch("/api/me")
def update_me(
    body: UpdateMeBody,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Self-service update — user can change their own username + full name."""
    me = _me(session, current_user)

    if body.user_name is not None:
        new_name = _validate_user_name(body.user_name)
        if new_name != me.user_name:
            taken = (
                session.query(UserModel)
                .filter(UserModel.user_name == new_name, UserModel.id != me.id)
                .first()
            )
            if taken:
                raise HTTPException(status_code=409, detail="That username is taken.")
            me.user_name = new_name

    if body.full_name is not None:
        trimmed = body.full_name.strip()
        if trimmed:
            me.full_name = trimmed

    session.flush()
    return {
        "id": me.id,
        "user_name": me.user_name,
        "full_name": me.full_name,
        "user_email": me.user_email,
        "role": me.role,
    }


@router.post("/api/me/emails")
def add_my_email(
    body: AddEmailBody,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    import os

    me = _me(session, current_user)
    email = body.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Enter a valid email.")

    existing = session.query(UserEmail).filter_by(email=email).first()
    if existing and existing.user_id != me.id:
        raise HTTPException(
            status_code=409, detail="That email is linked to another account."
        )
    if existing and existing.verified_at is not None:
        return {"message": "Already linked and verified."}

    ue = existing or UserEmail(user_id=me.id, email=email, is_primary=False)
    if not existing:
        session.add(ue)
        session.flush()

    token = issue_magic_link(session, me, purpose="verify-email", user_email_id=ue.id)
    client_url = os.environ.get(
        "NEXT_PUBLIC_CLIENT_URL", "https://aura.reactiveshots.com"
    )
    link = f"{client_url}/auth/verify?token={token}"
    sent = send_verify_email(email, me.full_name, link)
    return {
        "id": ue.id,
        "email": ue.email,
        "message": "Verification email sent" if sent else "Added (email not sent)",
    }


@router.delete("/api/me/emails/{email_id}")
def delete_my_email(
    email_id: int,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    from db.models import MagicLink

    me = _me(session, current_user)
    ue = session.get(UserEmail, email_id)
    if not ue or ue.user_id != me.id:
        raise HTTPException(status_code=404, detail="Email not found")
    if ue.is_primary:
        raise HTTPException(status_code=400, detail="Can't remove the primary email.")
    # detach any verify-email links pointing at this row before deleting it
    session.query(MagicLink).filter_by(user_email_id=ue.id).update(
        {"user_email_id": None}
    )
    session.delete(ue)
    return {"message": "Removed"}


@router.delete("/api/me")
def delete_my_account(
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Delete the current user's account — Apple App Store requirement (5.1.1 v).

    What gets wiped:
      - all `magic_links` for this user (immediate logout, no relogin possible)
      - all `user_album_permissions` (loses access to galleries shared with them)
      - all `user_emails` (frees the addresses for re-use elsewhere)
      - the `users` row is anonymized in-place (FK targets stay valid for audit)

    What stays — albums belong to the studio, not the user:
      - `album` rows
      - `file_metadata` (photos)
      - S3 objects (raw photo files, face crops)
      - `face_data` / `photo_face_links` (face-detection results)
      - `categories` / `album_categories`

    Admin (photographer) accounts cannot be deleted from this endpoint — they
    own the studio's data and need a different offboarding flow.
    """
    from db.models import MagicLink
    import uuid

    me = _me(session, current_user)

    if (me.role or "").lower() == "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin accounts can't be deleted from the app. Contact support."
        )

    # revoke all auth — outstanding magic links + future logins
    session.query(MagicLink).filter_by(user_id=me.id).delete()
    # drop access to galleries shared with this user (albums themselves stay)
    session.query(UserAlbumPermission).filter_by(user_id=me.id).delete()
    # remove all linked emails (so the address could be reused later)
    session.query(UserEmail).filter_by(user_id=me.id).delete()

    # anonymize the user row so foreign-key references (audit, etc.) survive
    # without leaking personal data
    tombstone = f"deleted-{uuid.uuid4().hex[:12]}"
    me.full_name = "Deleted user"
    me.user_email = f"{tombstone}@deleted.local"
    me.user_name = tombstone
    if hasattr(me, "user_password"):
        me.user_password = None
    if hasattr(me, "deleted_at"):
        from datetime import datetime
        me.deleted_at = datetime.now()

    return {"message": "Account deleted."}


class GrantAccessBody(BaseModel):
    user_id: int


@router.get("/api/album/{album_slug}/permissions")
def list_album_permissions(
    album_slug: str,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    """List users with access to this album (admin only)."""
    album = session.query(Album).filter_by(slug=album_slug).first()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    perms = session.query(UserAlbumPermission).filter_by(album_id=album.id).all()
    out = []
    for p in perms:
        u = session.get(UserModel, p.user_id)
        if not u:
            continue
        out.append({
            "user_id": u.id,
            "user_name": u.user_name,
            "full_name": u.full_name,
            "user_email": u.user_email,
            "role": u.role,
        })
    return out


@router.post("/api/album/{album_slug}/permissions")
def grant_album_access(
    album_slug: str,
    body: GrantAccessBody,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Grant an existing user access to this album (admin only)."""
    album = session.query(Album).filter_by(slug=album_slug).first()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    user = session.get(UserModel, body.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    existing = (
        session.query(UserAlbumPermission)
        .filter_by(user_id=user.id, album_id=album.id)
        .first()
    )
    if not existing:
        session.add(UserAlbumPermission(user_id=user.id, album_id=album.id))
        session.flush()
    return {"message": "Access granted", "user_id": user.id, "album_id": album.id}


@router.delete("/api/album/{album_slug}/permissions/{user_id}")
def revoke_album_access(
    album_slug: str,
    user_id: int,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Revoke an existing user's access to this album (admin only)."""
    album = session.query(Album).filter_by(slug=album_slug).first()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    session.query(UserAlbumPermission).filter_by(
        user_id=user_id, album_id=album.id
    ).delete()
    return {"message": "Access revoked"}


@router.post("/api/clients/invite")
def invite_client(
    body: InviteClientBody,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    album = session.query(Album).filter_by(slug=body.album_slug).first()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")

    from datetime import datetime as _dt

    email = body.email.strip().lower()
    # admin can specify a custom username; otherwise default to email
    if body.user_name:
        chosen_user_name = _validate_user_name(body.user_name)
        taken = session.query(UserModel).filter_by(user_name=chosen_user_name).first()
        if taken and taken.user_email != email:
            raise HTTPException(status_code=409, detail="That username is taken.")
    else:
        chosen_user_name = email

    user = session.query(UserModel).filter_by(user_email=email).first()
    if not user:
        user = UserModel(
            user_name=chosen_user_name,
            full_name=body.full_name.strip(),
            user_email=email,
            role="client",
        )
        session.add(user)
        session.flush()
    elif body.user_name and user.user_name != chosen_user_name:
        # admin re-inviting with a different username choice — update it
        user.user_name = chosen_user_name

    # ensure a `user_emails` row exists for this address — invited clients get
    # one verified+primary row so the profile page (web + iOS) doesn't render
    # an empty/loading state for them.
    existing_ue = session.query(UserEmail).filter_by(user_id=user.id).first()
    if not existing_ue:
        session.add(
            UserEmail(
                user_id=user.id,
                email=email,
                is_primary=True,
                verified_at=_dt.now(),
            )
        )
        session.flush()

    # grant access to the album (idempotent)
    exists = (
        session.query(UserAlbumPermission)
        .filter_by(user_id=user.id, album_id=album.id)
        .first()
    )
    if not exists:
        session.add(UserAlbumPermission(user_id=user.id, album_id=album.id))

    token = issue_magic_link(session, user, "invite")
    import os

    client_url = os.environ.get(
        "NEXT_PUBLIC_CLIENT_URL", "https://aura.reactiveshots.com"
    )
    link = _verify_link(token, f"/albums/{album.slug}")
    sent = send_invite(user.user_email, user.full_name, link, album.name, _album_counts(session, album))
    return {"message": "Invite sent" if sent else "Client added (email not sent)"}


@router.post("/api/login")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    # Replace with actual user authentication logic
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        # return 401 error
        raise HTTPException(status_code=401, detail="Invalid username or password")

    return {
        "message": "Login successful",
        "access_token": user[0]["access_token"],
        "token_type": "bearer",
        "user": create_user_json(user[1]),
    }


def authenticate_user(user_name: str, user_password: str):
    with session_scope() as session:
        user = (
            session.query(UserModel).filter_by(user_name=user_name).first()
        )
        if not user:
            return False
        if not verify_password(user_password, user.user_password):
            return False

        user.last_login_at = datetime.now()
        token = create_token(user)
        return token, user


def create_new_user(
    user_name: str, user_password: str, full_name: str, user_email: str
):
    with session_scope() as session:
        session.add(
            UserModel(
                user_name=user_name,
                user_password=user_password,
                full_name=full_name,
                user_email=user_email,
            )
        )
        return {"message": "User created successfully."}


# Protected endpoints
@router.post("/api/create-user")
def create_user(
    form_data: User,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    user = session.query(UserModel).filter_by(user_name=form_data.user_name).first()
    if user:
        return {"message": "User already exists."}

    hashed_password = get_password_hash(form_data.user_password)
    session.add(
        UserModel(
            user_name=form_data.user_name,
            user_password=hashed_password,
            full_name=form_data.full_name,
            user_email=form_data.user_email,
        )
    )
    return {"message": "User created successfully."}


def create_user_json(user):
    last = getattr(user, "last_login_at", None)
    return {
        "id": user.id,
        "user_name": user.user_name,
        "full_name": user.full_name,
        "user_email": user.user_email,
        "role": getattr(user, "role", "client"),
        "last_login_at": last.isoformat() if last else None,
        "parent_user_id": getattr(user, "parent_user_id", None),
    }


def get_albums_for_user(session: Session, user_id):
    user_id = access_user_id(session, user_id)
    albums = (
        session.query(Album)
        .join(UserAlbumPermission, Album.id == UserAlbumPermission.album_id)
        .filter(UserAlbumPermission.user_id == user_id)
        .order_by(Album.id.desc())
        .all()
    )
    return [
        {
            "id": album.id,
            "name": album.name,
            "slug": album.slug,
            "location": album.location,
            "date": album.date,
            "image_count": album.image_count,
            "shared": album.shared,
        }
        for album in albums
    ]


@router.get("/api/users/")
def read_users(
    current_user=Depends(get_current_user), session: Session = Depends(get_session)
):
    all_users = session.query(UserModel).all()
    users = [create_user_json(user) for user in all_users]
    by_parent: dict = {}
    for u in users:
        if u["parent_user_id"]:
            by_parent.setdefault(u["parent_user_id"], []).append(u)
    for user in users:
        user["albums"] = get_albums_for_user(session, user["id"])
        user["family"] = by_parent.get(user["id"], [])
    return users


@router.get("/api/users/{user_id}")
def read_user(
    user_id: int,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    from db.models import ClientFile, Video

    user = session.get(UserModel, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    data = create_user_json(user)
    data["albums"] = get_albums_for_user(session, user_id)
    data["family"] = [
        create_user_json(m)
        for m in session.query(UserModel)
        .filter_by(parent_user_id=user_id)
        .order_by(UserModel.id)
        .all()
    ]
    parent = session.get(UserModel, user.parent_user_id) if user.parent_user_id else None
    data["parent"] = create_user_json(parent) if parent else None
    data["emails"] = [
        {"email": ue.email, "is_primary": ue.is_primary, "verified": ue.verified_at is not None}
        for ue in session.query(UserEmail)
        .filter_by(user_id=user_id)
        .order_by(UserEmail.is_primary.desc(), UserEmail.id)
        .all()
    ]
    data["downloads"] = [
        {"id": cf.id, "filename": cf.filename, "size": cf.size, "album_id": cf.album_id}
        for cf in session.query(ClientFile).filter_by(user_id=user_id).all()
    ]
    data["videos"] = [
        {"id": v.id, "title": getattr(v, "title", None), "album_id": getattr(v, "album_id", None)}
        for v in session.query(Video).filter_by(client_id=user_id).all()
    ]
    return data


@router.put("/api/users/{user_id}")
def update_user(
    user_id: int,
    form_data: UpdateUserForm,
    current_user=Depends(require_admin),
    session: Session = Depends(get_session),
):
    user = session.get(UserModel, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.user_name = form_data.user.user_name
    user.full_name = form_data.user.full_name
    user.user_email = form_data.user.user_email

    owner = user.parent_user_id or user.id
    session.query(UserAlbumPermission).filter_by(user_id=owner).delete()
    for album_id in form_data.album_ids:
        session.add(UserAlbumPermission(user_id=owner, album_id=album_id))

    return {"message": "User updated successfully."}


@router.delete("/api/users/{user_id}")
def delete_user(
    user_id: int,
    current_user=Depends(require_admin),
    session: Session = Depends(get_session),
):
    user = session.get(UserModel, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    me = _me(session, current_user)
    if me.id == user_id:
        raise HTTPException(
            status_code=400, detail="Use account deletion to remove your own account."
        )

    # family only has access through this account, so they go with it
    for member in session.query(UserModel).filter_by(parent_user_id=user_id).all():
        _purge_user(session, member.id)
    _purge_user(session, user_id)
    session.commit()
    return {"message": "User deleted successfully."}


def _purge_user(session: Session, user_id: int):
    from db.models import MagicLink, ClientFile, Video, PhotoFavorite

    # clear every FK child first — these reference users.id with NO ACTION,
    # so the row delete fails unless they're gone (this was the bug: only
    # permissions were cleared, leaving magic_links/emails/files to block it)
    session.query(MagicLink).filter_by(user_id=user_id).delete()
    session.query(UserEmail).filter_by(user_id=user_id).delete()
    session.query(UserAlbumPermission).filter_by(user_id=user_id).delete()
    session.query(ClientFile).filter_by(user_id=user_id).delete()
    session.query(PhotoFavorite).filter_by(user_id=user_id).delete()
    # videos are content, not the person — keep them, just unlink the client
    session.query(Video).filter_by(client_id=user_id).update(
        {"client_id": None}, synchronize_session=False
    )
    session.query(UserModel).filter_by(id=user_id).delete()


def _primary_email(session, user) -> Optional[str]:
    ue = (
        session.query(UserEmail)
        .filter_by(user_id=user.id)
        .order_by(UserEmail.is_primary.desc(), UserEmail.id)
        .first()
    )
    return (ue.email if ue else None) or user.user_email


def _album_counts(session: Session, album) -> dict:
    """What's inside — so the email can say so, and the landing can too."""
    from db.models import FileMetadata

    if not album:
        return {}
    rows = session.query(FileMetadata.content_type).filter_by(album_id=album.id).all()
    videos = sum(1 for (ct,) in rows if (ct or "").startswith("video/"))
    return {"photoCount": len(rows) - videos, "videoCount": videos, "albumSlug": album.slug}


def _verify_link(token: str, next_path: Optional[str] = None) -> str:
    from urllib.parse import quote

    link = f"{CLIENT_URL}/auth/verify?token={token}"
    return f"{link}&next={quote(next_path, safe='/')}" if next_path else link


class NotifyBody(BaseModel):
    kind: str  # login_link | gallery_ready | new_download | new_video
    album_id: Optional[int] = None
    include_family: bool = False


@router.post("/api/users/{user_id}/notify")
def notify_user(
    user_id: int,
    body: NotifyBody,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Email a client a one-click login link wrapped in a preset notification
    (gallery ready / new download / new video / plain login link)."""
    user = session.get(UserModel, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    email = _primary_email(session, user)
    if not email:
        raise HTTPException(status_code=400, detail="This user has no email on file")

    name = user.full_name or "there"
    album = session.get(Album, body.album_id) if body.album_id else None
    if not album:
        # newest first, so a client added to a second album isn't told their
        # first one is ready
        albums = get_albums_for_user(session, user_id)
        album = session.get(Album, albums[0]["id"]) if albums else None
    album_name = album.name if album else "your gallery"
    counts = _album_counts(session, album)

    # land on the thing the email is about, not the library
    next_path = {
        "gallery_ready": f"/albums/{album.slug}" if album else None,
        "new_video": f"/albums/{album.slug}?tab=videos" if album else None,
        "new_download": "/albums",
    }.get(body.kind)

    senders = {
        "login_link": lambda e, n, l: email_service.send_login_link(e, n, l),
        "gallery_ready": lambda e, n, l: email_service.send_gallery_ready(e, n, l, album_name, counts),
        "new_download": lambda e, n, l: email_service.send_new_download(e, n, l, album_name),
        "new_video": lambda e, n, l: email_service.send_new_video(e, n, l, album_name),
    }
    send = senders.get(body.kind)
    if not send:
        raise HTTPException(status_code=400, detail=f"Unknown notification: {body.kind}")

    recipients = [user]
    if body.include_family:
        recipients += (
            session.query(UserModel).filter_by(parent_user_id=user.id).order_by(UserModel.id).all()
        )

    # each person gets a link that signs in as *them*; persist before sending
    links = []
    for r in recipients:
        r_email = _primary_email(session, r)
        if not r_email:
            continue
        token = issue_magic_link(session, r, "login")
        links.append((r_email, r.full_name or "there", _verify_link(token, next_path)))
    session.commit()

    sent_to = [e for e, n, l in links if send(e, n, l)]
    if not sent_to:
        raise HTTPException(status_code=502, detail="Email failed to send")
    return {"message": "Sent", "to": ", ".join(sent_to), "kind": body.kind}


class FamilyMemberBody(BaseModel):
    full_name: str
    email: str


@router.post("/api/users/{user_id}/family")
def add_family_member(
    user_id: int,
    body: FamilyMemberBody,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Add someone to a client's account. They sign in with their own email
    and see every album the primary can."""
    primary = session.get(UserModel, user_id)
    if not primary:
        raise HTTPException(status_code=404, detail="User not found")
    if primary.parent_user_id:
        raise HTTPException(status_code=400, detail="Add family to the primary account instead")

    email = body.email.strip().lower()
    name = body.full_name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    if "@" not in email:
        raise HTTPException(status_code=400, detail="That email doesn't look right")
    if (
        session.query(UserModel).filter_by(user_email=email).first()
        or session.query(UserEmail).filter_by(email=email).first()
    ):
        raise HTTPException(status_code=409, detail="That email already has an account")

    member = UserModel(
        user_name=email,
        full_name=name,
        user_email=email,
        role="client",
        parent_user_id=primary.id,
    )
    session.add(member)
    session.flush()
    session.add(UserEmail(user_id=member.id, email=email, is_primary=True, verified_at=datetime.now()))

    token = issue_magic_link(session, member, "invite")
    session.commit()

    albums = get_albums_for_user(session, primary.id)
    album = session.get(Album, albums[0]["id"]) if albums else None
    sent = send_invite(
        email,
        name,
        _verify_link(token, f"/albums/{album.slug}" if album else None),
        album.name if album else "your gallery",
        _album_counts(session, album),
    )
    out = create_user_json(member)
    out["invite_sent"] = sent
    return out


@router.delete("/api/users/{user_id}/family/{member_id}")
def remove_family_member(
    user_id: int,
    member_id: int,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    member = session.get(UserModel, member_id)
    if not member or member.parent_user_id != user_id:
        raise HTTPException(status_code=404, detail="Family member not found")
    _purge_user(session, member_id)
    session.commit()
    return {"message": "Removed"}
