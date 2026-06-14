"""In-memory registry for background album-processing jobs.

After files are saved in-request, face detection / clustering / CDN warming
run as a background task. The admin's processing page polls
GET /api/upload-status/{slug} which reads from here. Single-replica deploy,
so an in-process dict is sufficient and avoids a schema migration.
"""

from __future__ import annotations

import time

# album_slug -> job dict
_jobs: dict[str, dict] = {}

# phase order the UI renders as a stepper
PHASES = ["saving", "faces", "clustering", "warming", "done"]


def start_job(slug: str, *, face_detection: bool, image_count: int) -> None:
    _jobs[slug] = {
        "phase": "faces" if face_detection else "warming",
        "current": 0,
        "total": 0,
        "error": None,
        "finished": False,
        "face_detection": face_detection,
        "image_count": image_count,
        "started_at": time.time(),
        "updated_at": time.time(),
    }


def update_job(slug: str, *, phase: str, current: int = 0, total: int = 0) -> None:
    job = _jobs.get(slug)
    if not job:
        return
    job.update(phase=phase, current=current, total=total, updated_at=time.time())


def finish_job(slug: str) -> None:
    job = _jobs.get(slug)
    if not job:
        return
    job.update(phase="done", finished=True, updated_at=time.time())


def fail_job(slug: str, error: str) -> None:
    job = _jobs.get(slug)
    if not job:
        return
    job.update(error=error, finished=True, updated_at=time.time())


def get_job(slug: str) -> dict | None:
    job = _jobs.get(slug)
    return dict(job) if job else None
