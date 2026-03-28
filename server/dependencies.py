from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from typing import Optional
import jwt
from config import settings
from services.database import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


class TokenData:
    def __init__(self, user_name: str):
        self.user_name = user_name


def verify_token(token: str, credentials_exception: HTTPException) -> TokenData:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_name: Optional[str] = payload.get("sub")
        if user_name is None:
            raise credentials_exception
        return TokenData(user_name=user_name)
    except jwt.PyJWTError:
        raise credentials_exception


def get_current_user(token: str = Depends(oauth2_scheme)) -> TokenData:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    return verify_token(token, credentials_exception)


def get_db_connection():
    db, cursor = get_db()
    try:
        yield db, cursor
    finally:
        cursor.close()
        db.close()

