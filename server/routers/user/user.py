from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session
from models.user import User, UpdateUserForm
from db.base import get_session, session_scope
from db.models import User as UserModel, UserAlbumPermission, Album
from dependencies import oauth2_scheme, get_current_user, require_admin
from routers.auth.auth_router import (
    create_token,
    get_password_hash,
    verify_password,
    issue_magic_link,
)
from services.email_service import send_invite

router = APIRouter()


class InviteClientBody(BaseModel):
    full_name: str
    email: str
    album_id: int


@router.post("/api/clients/invite")
def invite_client(
    body: InviteClientBody,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    album = session.get(Album, body.album_id)
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")

    email = body.email.strip().lower()
    user = session.query(UserModel).filter_by(user_email=email).first()
    if not user:
        user = UserModel(
            user_name=email,
            full_name=body.full_name.strip(),
            user_email=email,
            role="client",
        )
        session.add(user)
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
