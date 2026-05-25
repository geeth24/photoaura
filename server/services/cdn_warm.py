"""Pre-warm CDN derivatives after upload.

SIH (the aura-cdn image handler) generates each size lazily on first request
(~1.5s cold). After an upload we fire GETs for the sizes the apps actually
request — the grid thumb, the lightbox low + full layers, and the raw thumbor
sizes the API returns — so CloudFront has them cached before anyone opens the
album. Best-effort and non-blocking (runs as a FastAPI background task).
"""

import base64
import json
import concurrent.futures

import requests

from config import settings

CDN = settings.AWS_CLOUDFRONT_URL
BUCKET = settings.AWS_BUCKET

# base64 "edits" widths the web client requests via the custom loader:
# next/image picks these device sizes — grid thumbs (640/750) and the
# lightbox full image (1920/2048). rotate:null matches the client loader.
EDIT_WIDTHS = [640, 750, 1920, 2048]
# raw thumbor sizes the API returns directly (public site / iOS / direct links)
THUMBOR_WIDTHS = [720, 1920]

# browser-like Accept so the WebP/AVIF variant gets warmed, not just the JPEG
_HEADERS = {"Accept": "image/avif,image/webp,image/*,*/*"}


def _edit_url(key: str, width: int) -> str:
    payload = {
        "bucket": BUCKET,
        "key": key,
        "edits": {"rotate": None, "resize": {"width": width, "fit": "inside"}},
    }
    token = base64.b64encode(json.dumps(payload).encode()).decode()
    return f"https://{CDN}/{token}"


def _thumbor_url(key: str, width: int) -> str:
    return f"https://{CDN}/fit-in/{width}x0/{key}"


def _urls_for(key: str):
    return [_edit_url(key, w) for w in EDIT_WIDTHS] + [
        _thumbor_url(key, w) for w in THUMBOR_WIDTHS
    ]


def warm_keys(keys):
    """Fire a GET for every derivative so CloudFront caches it. Swallows errors."""
    if not CDN or not BUCKET or not keys:
        return
    urls = [u for k in keys for u in _urls_for(k)]

    def _get(u):
        try:
            requests.get(u, headers=_HEADERS, timeout=20)
        except Exception:
            pass

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        list(ex.map(_get, urls))
