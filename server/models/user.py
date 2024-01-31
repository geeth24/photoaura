from pydantic import BaseModel


class User(BaseModel):
    user_name: str
    user_password: str
    full_name: str
    user_email: str


class UpdateUserForm(BaseModel):
    user: User
    album_ids: list[int]
