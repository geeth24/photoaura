"""Transcode uploaded videos to a web-friendly MP4 in place.

A phone/camera teaser can be 1GB+ and isn't web-optimized — served raw from
S3 it's slow to start and huge to download. We re-encode to H.264 1080p with
the moov atom up front (+faststart) so it streams progressively and is a
fraction of the size. Runs in a background thread off the request path; ffmpeg
streams via local temp files so pod memory stays flat.
"""

from __future__ import annotations

import os
import subprocess
import tempfile

from config import settings
from services.aws_service import s3_client

AWS_BUCKET = settings.AWS_BUCKET


def transcode_to_web(s3_key: str) -> int | None:
    """Download s3_key, re-encode to a faststart 1080p MP4, re-upload in place.
    Returns the new size in bytes, or None if anything failed (original kept)."""
    tmpdir = tempfile.mkdtemp(prefix="transcode-")
    src = os.path.join(tmpdir, "in")
    dst = os.path.join(tmpdir, "out.mp4")
    try:
        s3_client.download_file(AWS_BUCKET, s3_key, src)
        subprocess.run(
            [
                "ffmpeg", "-y", "-i", src,
                # cap threads so the encode can't pin every core and starve the
                # event loop (a starved /api fails the liveness probe -> kill)
                "-threads", "2",
                # fit inside 1920x1920 (works for landscape + portrait), even dims
                "-vf", "scale=w=1920:h=1920:force_original_aspect_ratio=decrease:force_divisible_by=2",
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
                "-c:a", "aac", "-b:a", "128k",
                "-movflags", "+faststart",
                dst,
            ],
            check=True,
            capture_output=True,
            timeout=3600,
        )
        size = os.path.getsize(dst)
        with open(dst, "rb") as f:
            s3_client.upload_fileobj(
                f, AWS_BUCKET, s3_key, ExtraArgs={"ContentType": "video/mp4"}
            )
        # poster frame so clients show a thumbnail (+ play badge) instead of a
        # blank tile. 1s in to skip a black intro frame. Best-effort.
        _make_poster(dst, os.path.join(tmpdir, "poster.jpg"), s3_key)
        return size
    except subprocess.CalledProcessError as e:
        print(f"transcode failed for {s3_key}: {e.stderr[-500:] if e.stderr else e}")
        return None
    except Exception as e:
        print(f"transcode error for {s3_key}: {e}")
        return None
    finally:
        for p in (src, dst, os.path.join(tmpdir, "poster.jpg")):
            try:
                os.remove(p)
            except Exception:
                pass
        try:
            os.rmdir(tmpdir)
        except Exception:
            pass


def _make_poster(video_path: str, poster_path: str, s3_key: str) -> None:
    """Grab one frame as a JPEG and upload it to `{s3_key}.poster.jpg`, so the
    CDN can serve a thumbnail for the video. Never fatal."""
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-ss", "1", "-i", video_path,
             "-frames:v", "1", "-q:v", "3", poster_path],
            check=True, capture_output=True, timeout=120,
        )
        with open(poster_path, "rb") as f:
            s3_client.upload_fileobj(
                f, AWS_BUCKET, f"{s3_key}.poster.jpg",
                ExtraArgs={"ContentType": "image/jpeg"},
            )
    except Exception as e:
        print(f"poster extract failed for {s3_key}: {e}")
