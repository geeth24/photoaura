from fastapi import APIRouter, Depends
from models.user import User, UpdateUserForm
from db_config import get_db
from fastapi import HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from auth import (
    oauth2_scheme,
    verify_token,
    create_token,
    get_password_hash,
    verify_password,
)

router = APIRouter()


@router.post("/login")
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
    db, cursor = get_db()
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
    db, cursor = get_db()
    # create table first if not exists
    cursor.execute(
        "INSERT INTO users (user_name, user_password, full_name, user_email) VALUES (%s, %s, %s, %s)",
        (user_name, user_password, full_name, user_email),
    )
    db.commit()
    return {"message": "User created successfully."}


# Protected endpoints
@router.post("/create-user")
def create_user(form_data: User):
    # check if user already exists
    db, cursor = get_db()
    cursor.execute("SELECT * FROM users WHERE user_name=%s", (form_data.user_name,))
    user = cursor.fetchone()
    if user:
        return {"message": "User already exists."}

    hashed_password = get_password_hash(form_data.user_password)
    create_new_user(
        form_data.user_name, hashed_password, form_data.full_name, form_data.user_email
    )
    return {"message": "User created successfully."}


def get_all_users():
    db, cursor = get_db()
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
    db, cursor = get_db()
    cursor.execute(
        """
        SELECT album.* FROM album
        JOIN user_album_permissions ON album.id = user_album_permissions.album_id
        WHERE user_album_permissions.user_id = %s
        """,
        (user_id,),
    )
    albums = cursor.fetchall()
    cursor.close()

    # convert to json
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


@router.get("/users/")
def read_users(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    verify_token(token, credentials_exception)
    all_users = get_all_users()

    # Assuming the tuple structure matches your User model: (id, user_name, user_password, full_name, user_email)
    users = [create_user_json(user) for user in all_users]

    # get all albums for each user
    for user in users:
        user["albums"] = get_albums_for_user(user["id"])

    return users


def get_user_by_id(user_id: int):
    db, cursor = get_db()
    cursor.execute("SELECT * FROM users WHERE id=%s", (user_id,))
    user = cursor.fetchone()
    return user


@router.get("/users/{user_id}")
def read_user(user_id: int, token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    verify_token(token, credentials_exception)
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return create_user_json(user)


@router.put("/users/{user_id}")
def update_user(
    user_id: int, form_data: UpdateUserForm, token: str = Depends(oauth2_scheme)
):
    # check if user already exists
    album_ids = form_data.album_ids
    db, cursor = get_db()
    cursor.execute("SELECT * FROM users WHERE id=%s", (user_id,))
    user = cursor.fetchone()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # update user
    cursor.execute(
        "UPDATE users SET user_name=%s, full_name=%s, user_email=%s WHERE id=%s",
        (form_data.user.user_name, form_data.user.full_name, form_data.user.user_email, user_id),
    )
    db.commit()

    # update album permissions
    cursor.execute("DELETE FROM user_album_permissions WHERE user_id=%s", (user_id,))
    for album_id in album_ids:
        cursor.execute(
            "INSERT INTO user_album_permissions (user_id, album_id) VALUES (%s, %s)",
            (user_id, album_id),
        )
    db.commit()

    return {"message": "User updated successfully."}
