from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db.base import get_session
from db.models import Album, FileMetadata, PhotoScores
from dependencies import require_admin
from services import smart_gallery
from utils.utils import capture_time

router = APIRouter()

REVIEW_REASONS = ("blurry", "eyes_closed", "duplicate")


class HighlightsBody(BaseModel):
    add: List[str] = []
    remove: List[str] = []


class PublishBody(BaseModel):
    published: bool


class ReviewBody(BaseModel):
    keep: List[str] = []
    hide: List[str] = []
    # back to the automatic verdict
    clear: List[str] = []


class BestBody(BaseModel):
    filename: str


def _album(session, slug):
    album = session.query(Album).filter_by(slug=slug).first()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    return album


def _rows(session, album, filenames):
    """photo_scores rows for the named photos; unknown names are a 404 so a
    typo never silently does nothing."""
    names = set(filenames)
    if not names:
        return []
    found = (
        session.query(PhotoScores, FileMetadata.filename)
        .join(FileMetadata, FileMetadata.id == PhotoScores.photo_id)
        .filter(PhotoScores.album_id == album.id, FileMetadata.filename.in_(names))
        .all()
    )
    missing = names - {name for _, name in found}
    if missing:
        raise HTTPException(status_code=404, detail=f"Not scored: {sorted(missing)[0]}")
    return [row for row, _ in found]


def _status(album):
    if album.smart_state == "scoring":
        return "scoring"
    return "ready" if album.smart_state == "ready" else "none"


def smart_json(session, album):
    out = {
        "status": _status(album),
        "published": bool(album.smart_published),
        "touched": bool(album.smart_touched),
        "highlights": [],
        "manual": {"add": [], "remove": []},
        "stacks": [],
        "review": {reason: [] for reason in REVIEW_REASONS},
        "kept": [],
        "counts": {"photos": 0, "highlights": 0, "stacks": 0, "review": 0, "hidden": 0},
    }
    rows = (
        session.query(PhotoScores, FileMetadata)
        .join(FileMetadata, FileMetadata.id == PhotoScores.photo_id)
        .filter(PhotoScores.album_id == album.id)
        .all()
    )
    rows.sort(key=lambda r: (capture_time(r[1]), r[1].id))
    stacks = {}
    for sc, meta in rows:
        name = meta.filename
        if sc.in_highlights:
            out["highlights"].append(name)
        if sc.manual_highlight:
            out["manual"][sc.manual_highlight].append(name)
        stacks.setdefault(sc.stack_id, []).append((sc, name))
        if sc.review_override == "keep":
            out["kept"].append(name)
        elif sc.review_reason:
            out["review"][sc.review_reason].append(
                {"filename": name, "hidden": sc.review_override == "hide"}
            )
        elif sc.review_override == "hide":
            out["review"]["blurry"].append({"filename": name, "hidden": True})
    for sid, members in stacks.items():
        if sid is None or len(members) < 2:
            continue
        best = next((n for sc, n in members if sc.is_stack_best), members[0][1])
        out["stacks"].append(
            {"id": sid, "best": best, "members": [n for _, n in members]}
        )
    review = out["review"]
    out["counts"] = {
        "photos": len(rows),
        "highlights": len(out["highlights"]),
        "stacks": len(out["stacks"]),
        "review": sum(len(v) for v in review.values()),
        "hidden": sum(1 for sc, _ in rows if sc.review_override == "hide"),
    }
    return out


def _reselect(session, album):
    """Commit the edit, rerun the selection, and read it back."""
    session.commit()
    smart_gallery.select_album(album.id)
    session.expire_all()
    return smart_json(session, album)


@router.get("/api/album/{album_slug}/smart")
async def get_smart(
    album_slug: str,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    return smart_json(session, _album(session, album_slug))


@router.post("/api/album/{album_slug}/smart/highlights")
async def adjust_highlights(
    album_slug: str,
    body: HighlightsBody,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    album = _album(session, album_slug)
    for row in _rows(session, album, body.add):
        row.manual_highlight = "add"
    for row in _rows(session, album, body.remove):
        row.manual_highlight = "remove"
    return _reselect(session, album)


@router.post("/api/album/{album_slug}/smart/publish")
async def publish_smart(
    album_slug: str,
    body: PublishBody,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    album = _album(session, album_slug)
    if body.published and album.smart_state != "ready":
        raise HTTPException(status_code=409, detail="Highlights aren't ready yet")
    smart_gallery.publish(session, album, body.published)
    session.commit()
    return smart_json(session, album)


@router.post("/api/album/{album_slug}/smart/review")
async def adjust_review(
    album_slug: str,
    body: ReviewBody,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    album = _album(session, album_slug)
    for names, value in ((body.keep, "keep"), (body.hide, "hide"), (body.clear, None)):
        for row in _rows(session, album, names):
            row.review_override = value
    return _reselect(session, album)


@router.post("/api/album/{album_slug}/smart/stacks/best")
async def set_stack_best(
    album_slug: str,
    body: BestBody,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    album = _album(session, album_slug)
    (row,) = _rows(session, album, [body.filename])
    mates = session.query(PhotoScores).filter(
        PhotoScores.album_id == album.id, PhotoScores.stack_id == row.stack_id
    )
    for m in mates:
        m.best_pinned = m.id == row.id
    return _reselect(session, album)
