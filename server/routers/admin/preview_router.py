import logging
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from config import settings
from db.base import get_session
from db.models import User
from dependencies import require_admin

router = APIRouter()

PREVIEW_MINUTES = 30
# uvicorn's logger is already wired to the server log
log = logging.getLogger("uvicorn.error")


@router.post("/api/admin/preview/{user_id}")
def start_preview(
    user_id: int,
    admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    """A short-lived, read-only token that shows the app exactly as this client
    sees it. Read-only is enforced for every route in dependencies.py."""
    target = session.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.role == "admin":
        raise HTTPException(status_code=400, detail="Only client accounts can be previewed")
    me = session.query(User).filter_by(user_name=admin.user_name).first()
    if not me:
        raise HTTPException(status_code=401, detail="Account not found")

    expires = datetime.now(timezone.utc) + timedelta(minutes=PREVIEW_MINUTES)
    token = jwt.encode(
        {
            "sub": target.user_name,
            "role": "client",
            "preview": True,
            "admin_id": me.id,
            "exp": expires,
        },
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    log.info("preview started: admin_id=%s target_id=%s", me.id, target.id)
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": PREVIEW_MINUTES * 60,
        "user": {
            "id": target.id,
            "user_name": target.user_name,
            "full_name": target.full_name,
            "user_email": target.user_email,
            "role": "client",
        },
    }
