from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from typing import Optional
import jwt
from config import settings
from db.base import get_session

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
PREVIEW_READ_ONLY = "Preview sessions are read-only."


def _is_preview_token(token: str) -> bool:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except jwt.PyJWTError:
        return False
    return bool(payload.get("preview"))


class _Bearer(OAuth2PasswordBearer):
    """Reads the bearer token and enforces the preview rule: an admin's
    "view as client" token can only read. Every route gets the token through
    one of the two schemes below, so none can skip the check."""

    async def __call__(self, request: Request) -> Optional[str]:
        token = await super().__call__(request)
        if token and _is_preview_token(token):
            request.state.read_only = True
            if request.method not in SAFE_METHODS:
                raise HTTPException(status_code=403, detail=PREVIEW_READ_ONLY)
        return token


oauth2_scheme = _Bearer(tokenUrl="token")
oauth2_optional = _Bearer(tokenUrl="token", auto_error=False)


class TokenData:
    def __init__(
        self,
        user_name: str,
        role: str = "client",
        preview: bool = False,
        admin_id: Optional[int] = None,
        uid: Optional[int] = None,
        exp: Optional[float] = None,
    ):
        self.user_name = user_name
        self.role = role
        self.preview = preview
        self.admin_id = admin_id
        self.uid = uid
        self.exp = exp


TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_TICKET = "ticket"


def decode_token(token: str, expected_type: str) -> dict:
    """Decode a signed token and require its `typ` claim. Tokens without a
    `typ` (issued before types existed) are rejected. Raises jwt.PyJWTError."""
    payload = jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=[settings.ALGORITHM],
        options={"require": ["exp", "typ"]},
    )
    if payload.get("typ") != expected_type:
        raise jwt.InvalidTokenError("wrong token type")
    return payload


def verify_token(token: str, credentials_exception: HTTPException) -> TokenData:
    try:
        payload = decode_token(token, TOKEN_TYPE_ACCESS)
        user_name: Optional[str] = payload.get("sub")
        if user_name is None:
            raise credentials_exception
        return TokenData(
            user_name=user_name,
            role=payload.get("role", "client"),
            preview=bool(payload.get("preview")),
            admin_id=payload.get("admin_id"),
            uid=payload.get("uid"),
            exp=payload.get("exp"),
        )
    except jwt.PyJWTError:
        raise credentials_exception


def preview_is_valid(session: Session, data: TokenData) -> bool:
    """A preview token only works while the admin who minted it is still an
    admin and the account it shows (by id, so a rename can't switch it) is
    still a client."""
    from db.models import User

    admin = session.get(User, data.admin_id) if data.admin_id else None
    target = session.query(User).filter_by(user_name=data.user_name).first()
    return bool(
        admin
        and admin.role == "admin"
        and target
        and target.role != "admin"
        and data.uid is not None
        and target.id == data.uid
    )


def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: Session = Depends(get_session),
) -> TokenData:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    data = verify_token(token, credentials_exception)
    if data.preview and not preview_is_valid(session, data):
        raise credentials_exception
    return data


def require_admin(
    current_user: TokenData = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> TokenData:
    # a preview token carries the client's name, never admin rights
    if current_user.preview:
        raise HTTPException(status_code=403, detail="Admin access required")
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



def is_admin_caller(
    token: Optional[str] = Depends(oauth2_optional),
    session: Session = Depends(get_session),
) -> bool:
    """True when the bearer token belongs to an admin; False for clients,
    bad tokens, or no token — never raises."""
    if not token:
        return False
    try:
        data = verify_token(token, HTTPException(status_code=401))
    except HTTPException:
        return False
    if data.preview:
        return False
    from db.models import User

    u = session.query(User).filter_by(user_name=data.user_name).first()
    return bool(u and u.role == "admin")
