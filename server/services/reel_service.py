"""Render an album's photos into a reel, store it in S3 and track it in the DB.

The scoring lives in smart_gallery; this picks from its Highlights when the
studio doesn't hand over filenames.
"""

from __future__ import annotations

import itertools
import logging
import os
import re
import shutil
import tempfile
import threading
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Callable, Dict, List, Optional, Sequence, Tuple

from config import settings
from db.base import session_scope
from db.models import Album, AlbumReel, FaceEmbedding, FileMetadata, PhotoScores
from services import reel_jobs
from services import reel_renderer as rr
from services.aws_service import s3_client
from utils.utils import capture_time

AWS_BUCKET = settings.AWS_BUCKET
AWS_CLOUDFRONT_URL = settings.AWS_CLOUDFRONT_URL

MUSIC_PREFIX = "_music/"
MUSIC_KEY_RE = re.compile(r"^_music/[0-9a-f]{32}\.(mp3|m4a|wav)$")
MAX_REEL_PHOTOS = 60
# what a 15-30 s reel holds without rushing the shots
DEFAULT_REEL_PHOTOS = 18

# one encode at a time: the pod has 3 cores and the API shares them
_render_slot = threading.Semaphore(1)

Progress = Callable[[str, float], None]


def aspect_slug(aspect: str) -> str:
    return aspect.replace(":", "x")


def poster_key(s3_key: str) -> str:
    return f"{s3_key}.poster.jpg"


def public_url(key: str) -> str:
    return f"https://{AWS_CLOUDFRONT_URL}/{key}"


def pick_reel_photos(
    items: Sequence[Tuple[str, datetime, Optional[float]]], limit: int = DEFAULT_REEL_PHOTOS
) -> List[str]:
    """Spread a reel across the whole shoot. items are (filename, capture time,
    combined score). Splits the time span into `limit` equal buckets and takes
    the best score in each, tops up from the best of the rest when some buckets
    are empty, and returns filenames in time order."""
    ordered = sorted(items, key=lambda x: (x[1], x[0]))
    if len(ordered) <= limit:
        return [f for f, _, _ in ordered]

    def rank(i):
        f, t, score = ordered[i]
        return (-(score if score is not None else float("-inf")), t, f)

    start, end = ordered[0][1], ordered[-1][1]
    span = (end - start).total_seconds()
    best: Dict[int, int] = {}
    for i, (_, t, _) in enumerate(ordered):
        b = min(int((t - start).total_seconds() / span * limit), limit - 1) if span > 0 else 0
        if b not in best or rank(i) < rank(best[b]):
            best[b] = i
    picked = set(best.values())
    rest = sorted((i for i in range(len(ordered)) if i not in picked), key=rank)
    picked.update(rest[: limit - len(picked)])
    return [ordered[i][0] for i in sorted(picked)]


def highlight_reel_filenames(session, album_id: int, limit: int = DEFAULT_REEL_PHOTOS) -> List[str]:
    """The default reel: up to `limit` of the album's Highlights, spread over the shoot."""
    rows = (
        session.query(FileMetadata, PhotoScores.combined)
        .join(PhotoScores, PhotoScores.photo_id == FileMetadata.id)
        .filter(
            FileMetadata.album_id == album_id,
            PhotoScores.in_highlights.is_(True),
            PhotoScores.review_override.is_distinct_from("hide"),
        )
        .all()
    )
    items = [
        (m.filename, capture_time(m), combined)
        for m, combined in rows
        if not (m.content_type or "").startswith("video/")
    ]
    return pick_reel_photos(items, limit)


def album_reels_json(session, album_id: int, published_only: bool) -> List[dict]:
    """Finished reels for the album page, newest first. Clients only get the
    published ones."""
    q = session.query(AlbumReel).filter(AlbumReel.album_id == album_id, AlbumReel.status == "ready")
    if published_only:
        q = q.filter(AlbumReel.published.is_(True))
    out = []
    for row in q.order_by(AlbumReel.created_at.desc(), AlbumReel.id.desc()):
        width, height = rr.ASPECTS.get(row.aspect, (0, 0))
        out.append({
            "id": row.id,
            "aspect": row.aspect,
            "url": public_url(row.s3_key),
            "poster_url": public_url(poster_key(row.s3_key)),
            "duration": row.duration,
            "width": width,
            "height": height,
            "published": bool(row.published),
        })
    return out


def _new_row(session, album_id: int, slug: str, aspect: str) -> Tuple[int, str]:
    key = f"{slug}/_reels/{int(time.time() * 1000)}-{aspect_slug(aspect)}.mp4"
    row = AlbumReel(album_id=album_id, aspect=aspect, s3_key=key, status="rendering")
    session.add(row)
    session.flush()
    return row.id, key


def _set_status(reel_id: int, status: str, duration: Optional[float] = None) -> None:
    try:
        with session_scope() as s:
            row = s.get(AlbumReel, reel_id)
            if row:
                row.status = status
                if duration is not None:
                    row.duration = duration
    except Exception as e:
        logging.error(f"reel {reel_id}: could not set status {status}: {e}")


def _download(key: str, dest: str) -> None:
    body = s3_client.get_object(Bucket=AWS_BUCKET, Key=key)["Body"]
    try:
        with open(dest, "wb") as fh:
            shutil.copyfileobj(body, fh, 1 << 20)
    finally:
        close = getattr(body, "close", None)
        if close:
            close()


def render_album_reel(
    album_id: int,
    filenames: List[str],
    aspect: str,
    music_key: Optional[str] = None,
    *,
    reel_id: Optional[int] = None,
    progress: Optional[Progress] = None,
) -> str:
    """Download the photos, render the reel, upload it and its poster, and
    return the video's S3 key. Raises on failure (the reel row is marked failed).

    The gallery file is used, not the held original, so a proof-locked album
    only ever yields a reel from its watermarked proofs."""
    note = progress or (lambda phase, frac: None)
    if aspect not in rr.ASPECTS:
        raise rr.ReelError("aspect must be 9:16 or 16:9")
    if music_key and not MUSIC_KEY_RE.match(music_key):
        raise rr.ReelError("unknown music track")

    with session_scope() as s:
        album = s.get(Album, album_id)
        if not album:
            raise rr.ReelError("album not found")
        slug = album.slug
        metas: Dict[str, FileMetadata] = {
            m.filename: m
            for m in s.query(FileMetadata).filter(
                FileMetadata.album_id == album_id, FileMetadata.filename.in_(filenames)
            )
        }
        missing = [f for f in filenames if f not in metas]
        if missing:
            raise rr.ReelError(f"photos not in this album: {', '.join(missing[:5])}")
        photos = [
            (f, metas[f].id, metas[f].width or 0, metas[f].height or 0) for f in filenames
        ]
        boxes: Dict[int, list] = defaultdict(list)
        for photo_id, bbox in s.query(FaceEmbedding.photo_id, FaceEmbedding.bbox).filter(
            FaceEmbedding.photo_id.in_([p[1] for p in photos])
        ):
            box = (bbox or {}).get("box")
            if box and len(box) == 4:
                boxes[photo_id].append(tuple(float(v) for v in box))
        if reel_id is None:
            reel_id, key = _new_row(s, album_id, slug, aspect)
        else:
            row = s.get(AlbumReel, reel_id)
            if not row or row.album_id != album_id:
                raise rr.ReelError("reel not found")
            key = row.s3_key

    tmpdir = tempfile.mkdtemp(prefix="reel-job-")
    try:
        note("queued", 0.0)
        with _render_slot:
            note("downloading", 0.0)
            paths = [os.path.join(tmpdir, f"p{i}.img") for i in range(len(photos))]
            finished = itertools.count(1)
            parts = len(photos) + (1 if music_key else 0)

            def fetch(i: int) -> None:
                _download(f"{slug}/{photos[i][0]}", paths[i])
                note("downloading", next(finished) / parts)

            music_path = None
            with ThreadPoolExecutor(max_workers=4) as pool:
                list(pool.map(fetch, range(len(photos))))
            if music_key:
                music_path = os.path.join(tmpdir, "music")
                _download(music_key, music_path)
            note("downloading", 1.0)

            items = []
            for path, (_, photo_id, w, h) in zip(paths, photos):
                if not (w and h):
                    w, h = rr.oriented_size(path)
                items.append(rr.ReelItem(path, w, h, boxes.get(photo_id, [])))

            out = os.path.join(tmpdir, "reel.mp4")
            result = rr.render_reel(items, aspect, out, music_path=music_path, progress=note)
            poster = os.path.join(tmpdir, "poster.jpg")
            rr.extract_poster(out, poster, result.poster_time)

            note("uploading", 0.0)
            with open(out, "rb") as fh:
                s3_client.upload_fileobj(
                    fh, AWS_BUCKET, key, ExtraArgs={"ContentType": "video/mp4"}
                )
            note("uploading", 0.8)
            with open(poster, "rb") as fh:
                s3_client.upload_fileobj(
                    fh, AWS_BUCKET, poster_key(key), ExtraArgs={"ContentType": "image/jpeg"}
                )
        _set_status(reel_id, "ready", result.duration)
        if result.dropped:
            logging.warning(f"reel {reel_id}: {result.dropped} photos did not fit in 30 s")
        return key
    except Exception:
        _set_status(reel_id, "failed")
        raise
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def start_reel_job(
    album_id: int,
    slug: str,
    filenames: List[str],
    aspect: str,
    music_key: Optional[str] = None,
) -> Tuple[str, int]:
    """Create the reel row and a registry job, render in the background.
    Returns (job_id, reel_id)."""
    with session_scope() as s:
        reel_id, _ = _new_row(s, album_id, slug, aspect)
    job_id = reel_jobs.create_job(slug, album_id, aspect, reel_id, len(filenames))

    def run() -> None:
        try:
            key = render_album_reel(
                album_id, filenames, aspect, music_key, reel_id=reel_id,
                progress=lambda phase, frac: reel_jobs.update_phase(job_id, phase, frac),
            )
            reel_jobs.finish_job(job_id, key)
        except Exception as e:
            logging.exception(f"reel job {job_id} failed")
            reel_jobs.fail_job(
                job_id, str(e)[:300] if isinstance(e, rr.ReelError) else "render failed"
            )

    threading.Thread(target=run, daemon=True, name=f"reel-{job_id[:8]}").start()
    return job_id, reel_id
