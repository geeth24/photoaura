import hashlib
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import delete, update
from sqlalchemy.orm import Session

from db.models import RefreshToken

REFRESH_DAYS = 90
REFRESH_TTL_SECONDS = REFRESH_DAYS * 24 * 60 * 60
PRUNE_AFTER_DAYS = 30


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _device(user_agent: Optional[str]) -> Optional[str]:
    ua = (user_agent or "").strip()
    return ua[:120] or None


def _mint(session: Session, user_id: int, family_id: str, device: Optional[str]) -> str:
    raw = secrets.token_urlsafe(32)
    session.add(
        RefreshToken(
            user_id=user_id,
            family_id=family_id,
            token_hash=_hash(raw),
            created_at=datetime.now(),
            expires_at=datetime.now() + timedelta(days=REFRESH_DAYS),
            device=device,
        )
    )
    session.flush()
    return raw


def issue_refresh_token(
    session: Session, user_id: int, user_agent: Optional[str] = None
) -> dict:
    """Starts a new family for a fresh sign-in."""
    raw = _mint(session, user_id, uuid.uuid4().hex, _device(user_agent))
    return {"refresh_token": raw, "refresh_expires_in": REFRESH_TTL_SECONDS}


def rotate_refresh_token(
    session: Session, raw: str, user_agent: Optional[str] = None
) -> Optional[tuple[int, str]]:
    """Spends `raw` and returns (user_id, next token). None means the caller
    answers 401. Re-presenting a spent token revokes its whole family. The
    caller must commit even on None, or that revoke is rolled back."""
    now = datetime.now()
    row = (
        session.query(RefreshToken)
        .filter_by(token_hash=_hash(raw))
        .with_for_update()
        .first()
    )
    if row is None:
        return None
    if row.used_at is not None:
        revoke_family(session, row.family_id)
        return None
    if row.revoked_at is not None or row.expires_at <= now:
        return None
    row.used_at = now
    nxt = _mint(session, row.user_id, row.family_id, _device(user_agent) or row.device)
    _prune(session)
    return row.user_id, nxt


def revoke_family(session: Session, family_id: str) -> None:
    session.execute(
        update(RefreshToken)
        .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now())
    )


def revoke_token_family(session: Session, raw: str) -> None:
    row = session.query(RefreshToken).filter_by(token_hash=_hash(raw)).first()
    if row:
        revoke_family(session, row.family_id)


def revoke_all_for_user(session: Session, user_id: int) -> None:
    session.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now())
    )


def delete_all_for_user(session: Session, user_id: int) -> None:
    session.execute(delete(RefreshToken).where(RefreshToken.user_id == user_id))


def _prune(session: Session) -> None:
    cutoff = datetime.now() - timedelta(days=PRUNE_AFTER_DAYS)
    session.execute(
        delete(RefreshToken).where(
            (RefreshToken.expires_at < cutoff) | (RefreshToken.revoked_at < cutoff)
        )
    )
