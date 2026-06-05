from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from typing import Optional
import jwt
from config import settings
from db.base import get_session

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


class TokenData:
    def __init__(self, user_name: str, role: str = "client"):
        self.user_name = user_name
        self.role = role


def verify_token(token: str, credentials_exception: HTTPException) -> TokenData:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_name: Optional[str] = payload.get("sub")
        if user_name is None:
            raise credentials_exception
        return TokenData(user_name=user_name, role=payload.get("role", "client"))
    except jwt.PyJWTError:
        raise credentials_exception


def get_current_user(token: str = Depends(oauth2_scheme)) -> TokenData:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    return verify_token(token, credentials_exception)


def require_admin(
    current_user: TokenData = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> TokenData:
    # check the live DB role, not the role baked into the token at login —
    # so promoting a user to admin takes effect on their next request without
    # forcing a re-login.
    from db.models import User

    u = session.query(User).filter_by(user_name=current_user.user_name).first()
    role = u.role if u else current_user.role
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    current_user.role = role
    return current_user

