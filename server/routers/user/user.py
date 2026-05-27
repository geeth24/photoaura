from typing import Optional

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
)
from services.email_service import send_invite, send_verify_email

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
    link = f"{client_url}/auth/verify?token={token}"
    sent = send_invite(user.user_email, user.full_name, link, album.name)
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
    return {
        "id": user.id,
        "user_name": user.user_name,
        "full_name": user.full_name,
        "user_email": user.user_email,
        "role": getattr(user, "role", "client"),
    }


def get_albums_for_user(session: Session, user_id):
    albums = (
        session.query(Album)
        .join(UserAlbumPermission, Album.id == UserAlbumPermission.album_id)
        .filter(UserAlbumPermission.user_id == user_id)
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
    for user in users:
        user["albums"] = get_albums_for_user(session, user["id"])
    return users


@router.get("/api/users/{user_id}")
def read_user(
    user_id: int,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    user = session.get(UserModel, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return create_user_json(user)


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

    session.query(UserAlbumPermission).filter_by(user_id=user_id).delete()
    for album_id in form_data.album_ids:
        session.add(UserAlbumPermission(user_id=user_id, album_id=album_id))

    return {"message": "User updated successfully."}


@router.delete("/api/users/{user_id}")
def delete_user(
    user_id: int,
    current_user=Depends(require_admin),
    session: Session = Depends(get_session),
):
    session.query(UserAlbumPermission).filter_by(user_id=user_id).delete()
    session.query(UserModel).filter_by(id=user_id).delete()
    return {"message": "User deleted successfully."}
