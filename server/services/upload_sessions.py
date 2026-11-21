"""Processing targets of an upload that spans several requests.

A big shoot is sent as batches. Each batch stores its files right away, but
faces, recluster, CDN warming and transcoding must run once over everything,
so the targets wait here until the final batch arrives. A session that never
gets its final batch (tab closed) is processed after SESSION_TTL of silence.
In-memory like upload_jobs; there is a single backend pod.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Callable

# seconds without a new batch before the held targets are processed anyway
SESSION_TTL = 30 * 60


@dataclass
class Batch:
    album_id: int
    slug: str
    update: bool
    image_count: int
    face_targets: list = field(default_factory=list)  # (s3_key, meta_id)
    keys: list = field(default_factory=list)  # image keys to warm
    video_targets: list = field(default_factory=list)  # (s3_key, meta_id)

    @property
    def has_work(self) -> bool:
        return bool(self.face_targets or self.keys or self.video_targets)

    def merge(self, other: "Batch") -> None:
        # a retried batch re-stores the same rows, so dedupe by row / key
        self.update = self.update or other.update
        self.image_count = other.image_count
        faces = {mid: key for key, mid in self.face_targets + other.face_targets}
        self.face_targets = [(key, mid) for mid, key in faces.items()]
        self.keys = list(dict.fromkeys(self.keys + other.keys))
        videos = {mid: key for key, mid in self.video_targets + other.video_targets}
        self.video_targets = [(key, mid) for mid, key in videos.items()]


# session id -> (held targets, expiry timer)
_sessions: dict[str, tuple[Batch, asyncio.TimerHandle]] = {}


def slug_of(session_id: str) -> str | None:
    held = _sessions.get(session_id)
    return held[0].slug if held else None


def hold(session_id: str, batch: Batch, on_expire: Callable[[Batch], None]) -> None:
    """Park a non-final batch's targets and restart the idle timer."""
    held = _sessions.pop(session_id, None)
    if held:
        held[1].cancel()
        held[0].merge(batch)
        batch = held[0]
    timer = asyncio.get_running_loop().call_later(
        SESSION_TTL, _expire, session_id, on_expire
    )
    _sessions[session_id] = (batch, timer)


def take(session_id: str, batch: Batch) -> Batch:
    """The final batch: everything held so far plus its own targets."""
    held = _sessions.pop(session_id, None)
    if not held:
        return batch
    held[1].cancel()
    held[0].merge(batch)
    return held[0]


def _expire(session_id: str, on_expire: Callable[[Batch], None]) -> None:
    held = _sessions.pop(session_id, None)
    if held and held[0].has_work:
        on_expire(held[0])
