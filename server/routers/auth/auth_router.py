from fastapi import (
    HTTPException,
    Depends,
    status,
    APIRouter,
)
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import Optional
import os
import secrets as _secrets
import jwt
import bcrypt
from sqlalchemy.orm import Session
from config import settings
from db.base import get_session
from db.models import User as UserModel, MagicLink, UserEmail
from services.email_service import send_login_link
from dependencies import oauth2_scheme, verify_token

router = APIRouter()

SESSION_MINUTES = 60 * 24 * 7  # 7-day session for magic-link logins
MAGIC_TTL_MIN = 30
CLIENT_URL = os.environ.get("NEXT_PUBLIC_CLIENT_URL", "https://aura.reactiveshots.com")


class Token(BaseModel):
    access_token: str
    token_type: str


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode("utf-8"), hashed_password.encode("utf-8")
    )


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now() + expires_delta
    else:
        expire = datetime.now() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_token(user, minutes: Optional[int] = None) -> dict:
    minutes = minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES
    access_token = create_access_token(
        data={"sub": user.user_name, "role": getattr(user, "role", "client")},
        expires_delta=timedelta(minutes=minutes),
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/api/verify-token")
def verify_token_endpoint(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    verify_token(token, credentials_exception)
    return {"message": "Token is valid"}


class EmailBody(BaseModel):
    email: str


class TokenBody(BaseModel):
    token: str


def _user_json(u) -> dict:
    return {
        "id": u.id,
        "user_name": u.user_name,
        "full_name": u.full_name,
        "user_email": u.user_email,
        "role": u.role,
    }


def issue_magic_link(
    session: Session,
    user,
    purpose: str = "login",
    user_email_id: Optional[int] = None,
) -> str:
    """Create a single-use magic-link token for a user."""
    token = _secrets.token_urlsafe(32)
    session.add(
        MagicLink(
            user_id=user.id,
            token=token,
            purpose=purpose,
            expires_at=datetime.now() + timedelta(minutes=MAGIC_TTL_MIN),
            user_email_id=user_email_id,
        )
    )
    session.flush()
    return token


@router.post("/api/auth/request-link")
def request_link(body: EmailBody, session: Session = Depends(get_session)):
    email = body.email.strip().lower()
    # any verified user_emails row → that user; fall back to legacy user_email column
    ue = (
        session.query(UserEmail)
        .filter(UserEmail.email == email, UserEmail.verified_at.isnot(None))
        .first()
    )
    user = session.get(UserModel, ue.user_id) if ue else None
    if not user:
        user = session.query(UserModel).filter_by(user_email=email).first()
    if user:
        token = issue_magic_link(session, user, "login")
        link = f"{CLIENT_URL}/auth/verify?token={token}"
        # send to the email the user typed, not necessarily their primary
        send_login_link(email, user.full_name, link)
    # don't reveal whether the email has an account
    return {"message": "If that email has access, a login link is on its way."}


@router.post("/api/auth/verify-link")
def verify_link(body: TokenBody, session: Session = Depends(get_session)):
    ml = session.query(MagicLink).filter_by(token=body.token).first()
    if not ml or ml.used_at is not None or ml.expires_at < datetime.now():
        raise HTTPException(status_code=400, detail="This link is invalid or expired.")
    ml.used_at = datetime.now()
    user = session.get(UserModel, ml.user_id)
    if not user:
        raise HTTPException(status_code=400, detail="Account not found.")
    # if this was a verify-email link, also mark the address verified
    if ml.purpose == "verify-email" and ml.user_email_id:
        ue = session.get(UserEmail, ml.user_email_id)
        if ue and ue.user_id == user.id and ue.verified_at is None:
            ue.verified_at = datetime.now()
    token = create_token(user, minutes=SESSION_MINUTES)
    return {
        "access_token": token["access_token"],
        "token_type": "bearer",
        "user": _user_json(user),
    }
