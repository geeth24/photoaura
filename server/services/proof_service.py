"""Proof mode: while a booking's final payment is outstanding its album shows
watermarked proofs and the originals sit under a private hold prefix.

Layout while locked:
  {slug}/{stem}-preview.jpg                     what every client loads
  {slug}/_hold/{hold_token}/{original_filename} the untouched original
"""

import io
import os
import secrets
from typing import Callable, Optional

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

from config import settings
from db.base import session_scope
from db.models import Album, FileMetadata, PhotoVersion
from services import upload_jobs
from services.aws_service import invalidate_cdn, s3_client
from services.cdn_warm import warm_keys
from utils.utils import hold_key

AWS_BUCKET = settings.AWS_BUCKET
LOCKED_DETAIL = "Downloads unlock once your final payment is received."
MARK_TEXT = "Reactive Shots Studios"
ASSETS = os.path.join(os.path.dirname(__file__), "..", "assets")
LOGO_PATH = os.path.join(ASSETS, "rs-logo-white.png")
FONT_PATH = os.path.join(ASSETS, "blackmud.ttf")
_logo: Optional[Image.Image] = None
PROOF_EDGE = 2048


def _font(size: int):
    # the studio's Blackmud wordmark, same as the site
    try:
        return ImageFont.truetype(FONT_PATH, size)
    except OSError:
        return ImageFont.load_default(size=size)


def _logo_mark(w: int, h: int) -> Image.Image:
    """The RS logo, big and centred, so it can't be cropped out."""
    global _logo
    if _logo is None:
        _logo = Image.open(LOGO_PATH).convert("RGBA")
    side = max(48, round(min(w, h) * 0.42))
    logo = _logo.resize((side, side), Image.Resampling.LANCZOS)
    alpha = logo.getchannel("A")
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    pos = ((w - side) // 2, (h - side) // 2)
    # a soft dark halo keeps it readable on white dresses and bright skies
    halo = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    halo.putalpha(alpha.point(lambda a: a * 70 // 255))
    halo = halo.filter(ImageFilter.GaussianBlur(max(2.0, side / 60)))
    layer.alpha_composite(halo, pos)
    white = Image.new("RGBA", (side, side), (255, 255, 255, 0))
    white.putalpha(alpha.point(lambda a: a * 105 // 255))
    layer.alpha_composite(white, pos)
    return layer


def make_proof(content: bytes) -> bytes:
    """Downsized JPEG with the RS logo across the middle and the studio name in the corner."""
    img = ImageOps.exif_transpose(Image.open(io.BytesIO(content))).convert("RGB")
    img.thumbnail((PROOF_EDGE, PROOF_EDGE), Image.Resampling.LANCZOS)
    w, h = img.size

    size = max(14, round(h * 0.034))
    font = _font(size)
    probe = ImageDraw.Draw(img)
    left, top, right, bottom = probe.textbbox((0, 0), MARK_TEXT, font=font)
    # very wide-and-short frames: keep the mark from running across the photo
    if right - left > w * 0.6:
        size = max(11, int(size * (w * 0.6) / (right - left)))
        font = _font(size)
        left, top, right, bottom = probe.textbbox((0, 0), MARK_TEXT, font=font)
    margin = max(8, round(size * 1.1))
    x = w - (right - left) - margin - left
    y = h - (bottom - top) - margin - top

    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).text((x, y + max(1, size // 18)), MARK_TEXT, font=font, fill=(0, 0, 0, 120))
    shadow = shadow.filter(ImageFilter.GaussianBlur(max(1.0, size / 10)))
    mark = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(mark).text((x, y), MARK_TEXT, font=font, fill=(255, 255, 255, 178))

    out = img.convert("RGBA")
    for layer in (_logo_mark(w, h), shadow, mark):
        out = Image.alpha_composite(out, layer)
    out = out.convert("RGB")
    buf = io.BytesIO()
    out.save(buf, format="JPEG", quality=85, optimize=True)
    return buf.getvalue()


def proof_name(original: str, taken: set) -> str:
    stem = os.path.splitext(original)[0]
    name, n = f"{stem}-preview.jpg", 2
    while name.lower() in taken:
        name, n = f"{stem}-{n}-preview.jpg", n + 1
    taken.add(name.lower())
    return name


def taken_names(session, album_id: int) -> set:
    rows = session.query(FileMetadata.filename, FileMetadata.original_filename).filter_by(album_id=album_id).all()
    return {(n or "").lower() for row in rows for n in row if n}


def store_held(album, original: str, content: bytes, content_type: str, proof: str) -> tuple:
    """Upload an original to the hold path and its proof next to the gallery.
    Returns (proof_key, hold_key)."""
    hkey = hold_key(album.slug, album.hold_token, original)
    s3_client.put_object(Bucket=AWS_BUCKET, Key=hkey, Body=content, ContentType=content_type)
    pkey = f"{album.slug}/{proof}"
    s3_client.put_object(Bucket=AWS_BUCKET, Key=pkey, Body=make_proof(content), ContentType="image/jpeg")
    return pkey, hkey


def _is_video(meta) -> bool:
    return (meta.content_type or "").startswith("video/")


def _delete(key: str):
    try:
        s3_client.delete_object(Bucket=AWS_BUCKET, Key=key)
    except Exception as e:
        print(f"proof: delete {key} failed: {e}")


def lock(session, album) -> bool:
    """Flag the album locked. Returns True when existing files still need
    moving into the hold layout (run convert_album in the background)."""
    if not album.hold_token:
        album.hold_token = secrets.token_urlsafe(24)
    album.proof_locked = True
    session.flush()
    pending = (
        session.query(FileMetadata)
        .filter(
            FileMetadata.album_id == album.id,
            FileMetadata.held.isnot(True),
            ~FileMetadata.content_type.like("video/%"),
        )
        .count()
    )
    return pending > 0


def convert_album(album_id: int):
    """Background: move every clean original into the hold path and put a
    proof in its place. Safe to re-run."""
    with session_scope() as s:
        album = s.get(Album, album_id)
        if not album or not album.proof_locked:
            return
        slug, token = album.slug, album.hold_token
        ids = [
            m.id for m in s.query(FileMetadata).filter_by(album_id=album_id).all()
            if not m.held and not _is_video(m)
        ]
        current = {(m.filename or "").lower() for m in s.query(FileMetadata).filter_by(album_id=album_id)}
        # earlier versions of revised photos are clean files too
        old_versions = {
            v.filename
            for v in s.query(PhotoVersion)
            .join(FileMetadata, FileMetadata.id == PhotoVersion.photo_id)
            .filter(FileMetadata.album_id == album_id)
            .all()
            if v.filename and v.filename.lower() not in current
        }
        taken = taken_names(s, album_id)

    total = len(ids)
    upload_jobs.start_job(slug, face_detection=False, image_count=total, kind="lock")
    try:
        proofs = []
        for i, photo_id in enumerate(ids):
            try:
                with session_scope() as s:
                    m = s.get(FileMetadata, photo_id)
                    if not m or m.held:
                        continue
                    original = m.filename
                    src = f"{slug}/{original}"
                    content = s3_client.get_object(Bucket=AWS_BUCKET, Key=src)["Body"].read()
                    s3_client.copy_object(
                        Bucket=AWS_BUCKET, CopySource={"Bucket": AWS_BUCKET, "Key": src},
                        Key=hold_key(slug, token, original),
                    )
                    proof = proof_name(original, taken)
                    s3_client.put_object(
                        Bucket=AWS_BUCKET, Key=f"{slug}/{proof}", Body=make_proof(content), ContentType="image/jpeg"
                    )
                    m.original_filename = original
                    m.filename = proof
                    m.held = True
                _delete(src)
                proofs.append(f"{slug}/{proof}")
            except Exception as e:
                print(f"proof: lock failed for photo {photo_id} in {slug}: {e}")
            upload_jobs.update_job(slug, phase="proofing", current=i + 1, total=total)

        for name in old_versions:
            try:
                s3_client.copy_object(
                    Bucket=AWS_BUCKET, CopySource={"Bucket": AWS_BUCKET, "Key": f"{slug}/{name}"},
                    Key=hold_key(slug, token, name),
                )
                _delete(f"{slug}/{name}")
            except Exception as e:
                print(f"proof: could not hold old version {name}: {e}")

        # CloudFront may still hold resized copies of the clean originals
        invalidate_cdn()
        upload_jobs.update_job(slug, phase="warming", current=0, total=len(proofs))
        warm_keys(proofs)
        upload_jobs.finish_job(slug)
    except Exception as e:
        upload_jobs.fail_job(slug, str(e))
        print(f"proof: lock job failed for {slug}: {e}")


def unlock_album(album_id: int, on_done: Optional[Callable[[], None]] = None):
    """Background: put every held original back at {slug}/{name}, drop the
    proofs and the hold copies, then clear the lock. Idempotent."""
    with session_scope() as s:
        album = s.get(Album, album_id)
        if not album:
            return
        slug, token = album.slug, album.hold_token
        total = s.query(FileMetadata).filter_by(album_id=album_id, held=True).count()

    upload_jobs.start_job(slug, face_detection=False, image_count=total, kind="unlock")
    try:
        restored, done = [], 0
        # loop: an upload that lands mid-unlock is still stored held
        for _ in range(3):
            with session_scope() as s:
                ids = [r[0] for r in s.query(FileMetadata.id).filter_by(album_id=album_id, held=True).all()]
            if not ids:
                break
            for photo_id in ids:
                try:
                    with session_scope() as s:
                        m = s.get(FileMetadata, photo_id)
                        if not m or not m.held:
                            continue
                        original, proof = m.original_filename, m.filename
                        s3_client.copy_object(
                            Bucket=AWS_BUCKET, CopySource={"Bucket": AWS_BUCKET, "Key": hold_key(slug, token, original)},
                            Key=f"{slug}/{original}",
                        )
                        m.filename = original
                        m.original_filename = None
                        m.held = False
                    if proof and proof != original:
                        _delete(f"{slug}/{proof}")
                    _delete(hold_key(slug, token, original))
                    restored.append(f"{slug}/{original}")
                except Exception as e:
                    print(f"proof: unlock failed for photo {photo_id} in {slug}: {e}")
                done += 1
                upload_jobs.update_job(slug, phase="unlocking", current=done, total=max(total, done))

        # anything else still held (earlier versions of revised photos)
        if token:
            prefix = hold_key(slug, token, "")
            paginator = s3_client.get_paginator("list_objects_v2")
            for page in paginator.paginate(Bucket=AWS_BUCKET, Prefix=prefix):
                for obj in page.get("Contents", []):
                    name = obj["Key"][len(prefix):]
                    try:
                        s3_client.copy_object(
                            Bucket=AWS_BUCKET, CopySource={"Bucket": AWS_BUCKET, "Key": obj["Key"]},
                            Key=f"{slug}/{name}",
                        )
                        _delete(obj["Key"])
                    except Exception as e:
                        print(f"proof: could not restore {obj['Key']}: {e}")

        with session_scope() as s:
            still_held = s.query(FileMetadata).filter_by(album_id=album_id, held=True).count()
            album = s.get(Album, album_id)
            if album and not still_held:
                album.proof_locked = False

        upload_jobs.update_job(slug, phase="warming", current=0, total=len(restored))
        warm_keys(restored)
        upload_jobs.finish_job(slug)
        if still_held:
            print(f"proof: {still_held} photos in {slug} are still held; unlock again to retry")
        elif on_done:
            on_done()
    except Exception as e:
        upload_jobs.fail_job(slug, str(e))
        print(f"proof: unlock job failed for {slug}: {e}")
