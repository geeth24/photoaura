from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from models.user import User, UpdateUserForm
from services.database import get_db
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
    with get_db() as (db, cursor):
        cursor.execute("SELECT * FROM users WHERE user_name=%s", (user_name,))
        user = cursor.fetchone()
        if not user:
            return False
        if not verify_password(user_password, user[2]):
            return False

        token = create_token(user)
        return token, user


def create_new_user(
    user_name: str, user_password: str, full_name: str, user_email: str
):
    with get_db() as (db, cursor):
        cursor.execute(
            "INSERT INTO users (user_name, user_password, full_name, user_email) VALUES (%s, %s, %s, %s)",
            (user_name, user_password, full_name, user_email),
        )
        db.commit()
        return {"message": "User created successfully."}


# Protected endpoints
@router.post("/api/create-user")
def create_user(form_data: User):
    with get_db() as (db, cursor):
        cursor.execute("SELECT * FROM users WHERE user_name=%s", (form_data.user_name,))
        user = cursor.fetchone()
        if user:
            return {"message": "User already exists."}

        hashed_password = get_password_hash(form_data.user_password)
        cursor.execute(
            "INSERT INTO users (user_name, user_password, full_name, user_email) VALUES (%s, %s, %s, %s)",
            (form_data.user_name, hashed_password, form_data.full_name, form_data.user_email),
        )
        db.commit()
        return {"message": "User created successfully."}


def get_all_users():
    with get_db() as (db, cursor):
        cursor.execute("SELECT * FROM users")
        users = cursor.fetchall()
        return users


def create_user_json(user):
    return {
        "id": user[0],
        "user_name": user[1],
        "full_name": user[3],
        "user_email": user[4],
    }


def get_albums_for_user(user_id):
    with get_db() as (db, cursor):
        cursor.execute(
            """
            SELECT album.* FROM album
            JOIN user_album_permissions ON album.id = user_album_permissions.album_id
            WHERE user_album_permissions.user_id = %s
            """,
            (user_id,),
        )
        albums = cursor.fetchall()

        return [
            {
                "id": album[0],
                "name": album[1],
                "slug": album[2],
                "location": album[3],
                "date": album[4],
                "image_count": album[5],
                "shared": album[6],
            }
            for album in albums
        ]


@router.get("/api/users/")
def read_users(current_user = Depends(get_current_user)):
    all_users = get_all_users()
    users = [create_user_json(user) for user in all_users]
    for user in users:
        user["albums"] = get_albums_for_user(user["id"])
    return users


def get_user_by_id(user_id: int):
    with get_db() as (db, cursor):
        cursor.execute("SELECT * FROM users WHERE id=%s", (user_id,))
        user = cursor.fetchone()
        return user


@router.get("/api/users/{user_id}")
def read_user(user_id: int, current_user = Depends(get_current_user)):
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return create_user_json(user)


@router.put("/api/users/{user_id}")
def update_user(
    user_id: int, form_data: UpdateUserForm, current_user = Depends(get_current_user)
):
    with get_db() as (db, cursor):
        cursor.execute("SELECT * FROM users WHERE id=%s", (user_id,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        cursor.execute(
            "UPDATE users SET user_name=%s, full_name=%s, user_email=%s WHERE id=%s",
            (
                form_data.user.user_name,
                form_data.user.full_name,
                form_data.user.user_email,
                user_id,
            ),
        )
        db.commit()

        cursor.execute("DELETE FROM user_album_permissions WHERE user_id=%s", (user_id,))
        for album_id in form_data.album_ids:
            cursor.execute(
                "INSERT INTO user_album_permissions (user_id, album_id) VALUES (%s, %s)",
                (user_id, album_id),
            )
        db.commit()

        return {"message": "User updated successfully."}


@router.delete("/api/users/{user_id}")
def delete_user(user_id: int, current_user = Depends(get_current_user)):
    with get_db() as (db, cursor):
        cursor.execute("DELETE FROM user_album_permissions WHERE user_id=%s", (user_id,))
        db.commit()
        cursor.execute("DELETE FROM users WHERE id=%s", (user_id,))
        db.commit()
        return {"message": "User deleted successfully."}
