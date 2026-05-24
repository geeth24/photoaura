from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from models.user import User, UpdateUserForm
from db.base import get_session, session_scope
from db.models import User as UserModel, UserAlbumPermission, Album
from dependencies import oauth2_scheme, get_current_user
from routers.auth.auth_router import (
    create_token,
    get_password_hash,
    verify_password,
)

router = APIRouter()


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
def create_user(form_data: User, session: Session = Depends(get_session)):
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
    current_user=Depends(get_current_user),
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
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    session.query(UserAlbumPermission).filter_by(user_id=user_id).delete()
    session.query(UserModel).filter_by(id=user_id).delete()
    return {"message": "User deleted successfully."}
