"""In-memory registry for reel render jobs.

Same idea as upload_jobs: the UI polls GET /api/album/{slug}/reels, which reads
from here. Single-replica deploy, so an in-process dict is enough; a restart
drops running jobs and their rows are reported as failed.
"""

from __future__ import annotations

import threading
import time
import uuid
from typing import Dict, List, Optional

_jobs: Dict[str, dict] = {}
_lock = threading.Lock()

# overall progress each phase covers
_PHASES = {
    "queued": (0.0, 0.0),
    "downloading": (0.0, 0.15),
    "preparing": (0.15, 0.25),
    "encoding": (0.25, 0.9),
    "uploading": (0.9, 1.0),
}
KEEP_FINISHED_SECONDS = 3600
MAX_ACTIVE = 4


def _prune() -> None:
    cutoff = time.time() - KEEP_FINISHED_SECONDS
    for jid in [j for j, v in _jobs.items() if v["finished"] and v["updated_at"] < cutoff]:
        del _jobs[jid]


def active_count() -> int:
    with _lock:
        return sum(1 for v in _jobs.values() if not v["finished"])


def create_job(slug: str, album_id: int, aspect: str, reel_id: int, photos: int) -> str:
    job_id = uuid.uuid4().hex
    now = time.time()
    with _lock:
        _prune()
        _jobs[job_id] = {
            "job_id": job_id,
            "slug": slug,
            "album_id": album_id,
            "reel_id": reel_id,
            "aspect": aspect,
            "photos": photos,
            "phase": "queued",
            "progress": 0.0,
            "error": None,
            "s3_key": None,
            "finished": False,
            "started_at": now,
            "updated_at": now,
        }
    return job_id


def update_phase(job_id: str, phase: str, fraction: float = 0.0) -> None:
    lo, hi = _PHASES.get(phase, (0.0, 0.0))
    with _lock:
        job = _jobs.get(job_id)
        if job and not job["finished"]:
            job.update(
                phase=phase,
                progress=round(lo + (hi - lo) * min(max(fraction, 0.0), 1.0), 3),
                updated_at=time.time(),
            )


def finish_job(job_id: str, s3_key: str) -> None:
    with _lock:
        job = _jobs.get(job_id)
        if job:
            job.update(
                phase="done", progress=1.0, s3_key=s3_key, finished=True,
                updated_at=time.time(),
            )


def fail_job(job_id: str, error: str) -> None:
    with _lock:
        job = _jobs.get(job_id)
        if job:
            job.update(error=error, finished=True, updated_at=time.time())


def get_job(job_id: str) -> Optional[dict]:
    with _lock:
        job = _jobs.get(job_id)
        return dict(job) if job else None


def jobs_for_album(slug: str) -> List[dict]:
    with _lock:
        _prune()
        return [dict(v) for v in _jobs.values() if v["slug"] == slug]


def job_for_reel(reel_id: int) -> Optional[dict]:
    with _lock:
        for v in _jobs.values():
            if v["reel_id"] == reel_id:
                return dict(v)
    return None


def is_reel_active(reel_id: int) -> bool:
    job = job_for_reel(reel_id)
    return bool(job) and not job["finished"]
