"""Smart gallery: stacks near-duplicates, flags the photos worth a second look
and picks a Highlights set. Scores come from the face service at upload; the
selection here is pure and album-wide, so it can run again any time without
the studio's manual choices being lost."""

import os
from dataclasses import dataclass
from datetime import datetime

import numpy as np
from sqlalchemy import func

from db.base import session_scope
from db.models import Album, FaceEmbedding, FileMetadata, PhotoScores
from utils.utils import capture_time


def _env(name, default):
    return type(default)(os.environ.get(f"SMART_{name}", default))


@dataclass(frozen=True)
class SmartConfig:
    # stacks: shots this close in time and look are one moment
    stack_gap_s: float = _env("STACK_GAP_S", 3.0)
    stack_sim: float = _env("STACK_SIM", 0.92)

    # combined score weights. People drop out for frames without faces
    w_aesthetic: float = 0.40
    w_technical: float = 0.30
    w_people: float = 0.30

    # "main" faces: big enough in absolute terms and next to the biggest one
    main_face_px: int = 60
    main_face_rel: float = 0.5
    # face blur is face_recog's contrast-normalized score; sharp faces ~60-250
    soft_face_blur: float = 12.0
    sharp_face_blur: float = 120.0
    # eye openness below this is closed (the 5th percentile of frontal faces)
    closed_eyes: float = 0.19
    open_eyes: float = 0.32
    closed_eyes_max_yaw: float = 35.0
    # frame sharpness (sharpest tiles) under this, with no faces, is a soft frame.
    # Culled sets sit at 250-3400; a 1.5 px blur at 1024 px drops it under ~220
    soft_frame: float = _env("SOFT_FRAME", 200.0)
    sharp_frame: float = 1500.0

    # highlights
    highlight_share: float = _env("HIGHLIGHT_SHARE", 0.12)
    highlight_min: int = _env("HIGHLIGHT_MIN", 20)
    highlight_max: int = _env("HIGHLIGHT_MAX", 80)
    # a pick this similar to an earlier pick is skipped
    pick_sim_cap: float = 0.90
    # timeline chunks per pick; each chunk wants a pick of its own
    chunks_per_pick: float = 0.5
    # people with at least this many photos should appear at least once
    person_min_photos: int = 3
    bonus_time: float = 0.25
    bonus_person: float = 0.15
    bonus_person_cap: float = 0.30
    bonus_orientation: float = 0.10


CONFIG = SmartConfig()


@dataclass(eq=False)
class Rec:
    """What selection needs to know about one photo."""

    id: int
    filename: str
    t: datetime
    has_time: bool
    portrait: bool
    aesthetic: float
    sharpness: float
    exposure: tuple
    clip: np.ndarray
    faces: list
    manual_highlight: str = None
    review_override: str = None
    best_pinned: bool = False
    # filled by select()
    aes_n: float = 0.0
    technical: float = 0.0
    people: float = 0.0
    main_faces: int = 0
    persons: frozenset = frozenset()
    soft: bool = False
    closed: bool = False
    combined: float = 0.0
    stack_id: int = 0
    is_best: bool = False
    review: str = None
    highlight: bool = False

    @property
    def hidden(self):
        return self.review_override == "hide"

    @property
    def in_review(self):
        return self.review is not None and self.review_override != "keep"


def _face_px(f):
    x1, y1, x2, y2 = f["box"]
    return min(x2 - x1, y2 - y1)


def main_faces(faces, cfg=CONFIG):
    """Faces that carry the photo: not the people in the background."""
    sized = [f for f in faces if f.get("box") and f.get("blur") is not None]
    if not sized:
        return []
    biggest = max(_face_px(f) for f in sized)
    return [
        f
        for f in sized
        if _face_px(f) >= cfg.main_face_px and _face_px(f) >= cfg.main_face_rel * biggest
    ]


def _clip01(x):
    return float(min(1.0, max(0.0, x)))


def exposure_score(exposure, cfg=CONFIG):
    highlights, shadows, mean = exposure
    blown = 8 * (highlights or 0) + 8 * (shadows or 0)
    off = max(0.0, 0.18 - (mean or 0.5), (mean or 0.5) - 0.85) * 3
    return _clip01(1 - blown - off)


def score_faces(rec, cfg=CONFIG):
    """Technical + people scores, and the soft / closed-eyes verdicts."""
    mains = main_faces(rec.faces, cfg)
    rec.main_faces = len(mains)
    rec.persons = frozenset(f["person"] for f in mains if f.get("person"))
    exp = exposure_score(rec.exposure, cfg)
    if not mains:
        frame = _clip01(rec.sharpness / cfg.sharp_frame)
        rec.technical = 0.6 * frame + 0.4 * exp
        rec.people = 0.0
        rec.soft = rec.sharpness < cfg.soft_frame
        rec.closed = False
        return
    biggest = max(mains, key=_face_px)
    blurs = [min(f["blur"], cfg.sharp_face_blur) / cfg.sharp_face_blur for f in mains]
    rec.technical = 0.6 * float(np.mean(blurs)) + 0.4 * exp
    soft = [f["blur"] < cfg.soft_face_blur for f in mains]
    rec.soft = biggest["blur"] < cfg.soft_face_blur or sum(soft) * 2 > len(mains)

    def eyes(f):
        eo = f.get("eye_open")
        return 1.0 if eo is None else _clip01((eo - cfg.closed_eyes) / (cfg.open_eyes - cfg.closed_eyes))

    def person(f):
        smile = _clip01((f.get("smile") or 0) / 0.7)
        gaze = f.get("gaze")
        look = 1.0 if gaze is None else _clip01(1 - gaze / 0.08)
        frontal = _clip01(1 - abs(f.get("yaw") or 0) / 45 - abs(f.get("pitch") or 0) / 40)
        return 0.45 * eyes(f) + 0.25 * smile + 0.15 * look + 0.15 * frontal

    rec.people = float(np.mean([person(f) for f in mains]))
    shut = [
        f
        for f in mains
        if f.get("eye_open") is not None
        and f["eye_open"] < cfg.closed_eyes
        and abs(f.get("yaw") or 0) <= cfg.closed_eyes_max_yaw
    ]
    rec.closed = (biggest in shut) or (len(mains) > 1 and len(shut) * 2 >= len(mains))


def combine(rec, cfg=CONFIG):
    if rec.main_faces:
        total = cfg.w_aesthetic + cfg.w_technical + cfg.w_people
        return (
            cfg.w_aesthetic * rec.aes_n + cfg.w_technical * rec.technical + cfg.w_people * rec.people
        ) / total
    total = cfg.w_aesthetic + cfg.w_technical
    return (cfg.w_aesthetic * rec.aes_n + cfg.w_technical * rec.technical) / total


def build_stacks(recs, cfg=CONFIG):
    """Group photos shot within stack_gap_s of each other whose CLIP vectors
    agree. Only photos with a real capture time can be stacked by time."""
    parent = {r.id: r.id for r in recs}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    timed = sorted((r for r in recs if r.has_time), key=lambda r: (r.t, r.id))
    for i, a in enumerate(timed):
        for b in timed[i + 1 :]:
            if (b.t - a.t).total_seconds() > cfg.stack_gap_s:
                break
            if float(np.dot(a.clip, b.clip)) >= cfg.stack_sim:
                parent[find(b.id)] = find(a.id)
    groups = {}
    for r in recs:
        groups.setdefault(find(r.id), []).append(r)
    return list(groups.values())


def _percentile_rank(values):
    order = np.argsort(np.argsort(values))
    n = len(values)
    return (order / (n - 1)).tolist() if n > 1 else [0.5] * n


def target_size(n, cfg=CONFIG):
    return int(min(cfg.highlight_max, max(cfg.highlight_min, round(n * cfg.highlight_share))))


def pick_highlights(recs, cfg=CONFIG):
    """Greedy and diversity-aware: best combined score, with bonuses for an
    untouched stretch of the timeline, for people not yet shown and for the
    orientation the picks lack, and a similarity cap between picks."""
    ok = [r for r in recs if r.is_best and not r.in_review and not r.hidden]
    removed = {r.id for r in recs if r.manual_highlight == "remove"}
    forced = [r for r in recs if r.manual_highlight == "add" and not r.hidden]
    pool = [r for r in ok if r.id not in removed]
    target = min(target_size(len(recs), cfg), len({r.id for r in pool + forced}))

    ordered = sorted(recs, key=lambda r: (r.t, r.id))
    n_chunks = max(1, round(target * cfg.chunks_per_pick))
    chunk = {r.id: min(n_chunks - 1, i * n_chunks // len(ordered)) for i, r in enumerate(ordered)}

    seen = {}
    for r in recs:
        for p in r.persons:
            seen[p] = seen.get(p, 0) + 1
    wanted = {p for p, c in seen.items() if c >= cfg.person_min_photos}
    portrait_share = sum(r.portrait for r in recs) / max(1, len(recs))

    picked, chunks, shown = [], set(), set()

    def take(r):
        picked.append(r)
        chunks.add(chunk[r.id])
        shown.update(r.persons & wanted)

    def too_close(r):
        return any(float(np.dot(r.clip, p.clip)) > cfg.pick_sim_cap for p in picked)

    for r in forced:
        if r not in picked:
            take(r)

    def value(r):
        v = r.combined
        if chunk[r.id] not in chunks:
            v += cfg.bonus_time
        v += min(cfg.bonus_person_cap, cfg.bonus_person * len((r.persons & wanted) - shown))
        share = sum(p.portrait for p in picked) / max(1, len(picked))
        want = portrait_share - share if r.portrait else (1 - portrait_share) - (1 - share)
        return v + cfg.bonus_orientation * max(0.0, want)

    while len(picked) < target:
        left = [r for r in pool if r not in picked and not too_close(r)]
        if not left:
            break
        take(max(left, key=value))

    # people the greedy pass missed still get their best photo, up to the cap
    while len(picked) < cfg.highlight_max:
        missing = wanted - shown
        if not missing:
            break
        left = [r for r in pool if r not in picked and r.persons & missing and not too_close(r)]
        if not left:
            break
        take(max(left, key=lambda r: (len(r.persons & missing), r.combined)))

    balance_orientation(picked, pool, forced, portrait_share, cfg)
    return picked


def balance_orientation(picked, pool, forced, portrait_share, cfg=CONFIG):
    """Each orientation gets at least half its share of the album, rounded
    down. A missing one comes from the best unpicked candidate, swapped in for
    the weakest pick of the other orientation that nobody else depends on."""
    if not picked:
        return
    for portrait in (True, False):
        want = int((portrait_share if portrait else 1 - portrait_share) * len(picked) * 0.5)
        while sum(r.portrait == portrait for r in picked) < want:
            cands = [
                r for r in pool
                if r.portrait == portrait and r not in picked
                and not any(float(np.dot(r.clip, p.clip)) > cfg.pick_sim_cap for p in picked)
            ]
            if not cands:
                return
            others = [r for r in picked if r.portrait != portrait and r not in forced]
            # keep anyone who is the only pick showing a person
            alone = lambda r: any(
                p in r.persons and not any(p in o.persons for o in picked if o is not r)
                for p in r.persons
            )
            others = [r for r in others if not alone(r)]
            if not others:
                return
            picked.remove(min(others, key=lambda r: r.combined))
            picked.append(max(cands, key=lambda r: r.combined))


def select(recs, cfg=CONFIG):
    """Fill every derived field on the records. Returns them."""
    if not recs:
        return recs
    ranks = _percentile_rank([r.aesthetic for r in recs])
    for r, rank in zip(recs, ranks):
        r.aes_n = rank
        score_faces(r, cfg)
        r.combined = combine(r, cfg)
        r.review = "blurry" if r.soft else ("eyes_closed" if r.closed else None)
        r.is_best = False
        r.highlight = False

    for group in build_stacks(recs, cfg):
        sid = min(r.id for r in group)
        pinned = [r for r in group if r.best_pinned]
        # a stack's best is never a photo already flagged, unless all are
        clean = [r for r in group if r.review is None] or group
        best = max(pinned or clean, key=lambda r: (r.combined, -r.id))
        for r in group:
            r.stack_id = sid
            r.is_best = r is best
            if r is not best and r.review is None:
                r.review = "duplicate"

    for r in pick_highlights(recs, cfg):
        r.highlight = True
    return recs


def _faces_by_photo(session, album_id):
    """Each photo's faces with the person they belong to, from face_embedding."""
    out = {}
    rows = session.query(
        FaceEmbedding.photo_id, FaceEmbedding.face_id, FaceEmbedding.bbox, FaceEmbedding.pose
    ).filter(FaceEmbedding.album_id == album_id)
    for photo_id, face_id, bbox, pose in rows:
        pose = pose or {}
        out.setdefault(photo_id, []).append(
            {
                "box": (bbox or {}).get("box"),
                "person": face_id,
                "blur": pose.get("blur"),
                "eye_open": pose.get("eye_open"),
                "smile": pose.get("smile"),
                "gaze": pose.get("gaze"),
                "yaw": pose.get("yaw"),
                "pitch": pose.get("pitch"),
            }
        )
    return out


def load_album(session, album_id):
    faces = _faces_by_photo(session, album_id)
    rows = (
        session.query(FileMetadata, PhotoScores)
        .join(PhotoScores, PhotoScores.photo_id == FileMetadata.id)
        .filter(FileMetadata.album_id == album_id, PhotoScores.clip.isnot(None))
        .all()
    )
    recs = []
    for meta, sc in rows:
        t = capture_time(meta)
        recs.append(
            Rec(
                id=meta.id,
                filename=meta.filename,
                t=t,
                has_time=t != (meta.upload_date or datetime.min),
                portrait=(meta.orientation or "") == "portrait",
                aesthetic=sc.aesthetic or 0.0,
                sharpness=sc.sharpness if sc.sharpness is not None else 1e9,
                exposure=(sc.clipped_highlights, sc.clipped_shadows, sc.exposure_mean),
                clip=np.asarray(sc.clip, dtype=np.float32),
                faces=faces.get(meta.id, []),
                manual_highlight=sc.manual_highlight,
                review_override=sc.review_override,
                best_pinned=bool(sc.best_pinned),
            )
        )
    return recs


def select_album(album_id, cfg=CONFIG):
    """Score-derived selection for one album, written back to photo_scores."""
    with session_scope() as session:
        recs = select(load_album(session, album_id), cfg)
        by_id = {r.id: r for r in recs}
        for sc in session.query(PhotoScores).filter(PhotoScores.album_id == album_id):
            r = by_id.get(sc.photo_id)
            if not r:
                continue
            sc.technical, sc.people, sc.main_faces = r.technical, r.people, r.main_faces
            sc.combined = r.combined
            sc.stack_id, sc.is_stack_best = r.stack_id, r.is_best
            sc.in_highlights, sc.review_reason = r.highlight, r.review
        album = session.get(Album, album_id)
        if album:
            album.smart_state = "ready"
        return len(recs)


def set_state(album_id, state):
    with session_scope() as session:
        album = session.get(Album, album_id)
        if album:
            album.smart_state = state


def store_photo_scores(session, photo_id, album_id, photo):
    """Upsert the face service's whole-photo scores. Derived fields reset and
    the studio's overrides stay."""
    exp = photo.get("exposure") or {}
    values = dict(
        album_id=album_id,
        aesthetic=photo.get("aesthetic"),
        sharpness=photo.get("sharpness"),
        clipped_highlights=exp.get("clipped_highlights"),
        clipped_shadows=exp.get("clipped_shadows"),
        exposure_mean=exp.get("mean"),
        clip=photo.get("clip"),
    )
    row = session.query(PhotoScores).filter_by(photo_id=photo_id).first()
    if row:
        for k, v in values.items():
            setattr(row, k, v)
    else:
        session.add(PhotoScores(photo_id=photo_id, **values))


def count_scored(session, album_id):
    return (
        session.query(func.count(PhotoScores.id))
        .filter(PhotoScores.album_id == album_id, PhotoScores.clip.isnot(None))
        .scalar()
    )



def hidden_photo_ids(session, album_id):
    """Photos the studio hid from clients."""
    return {
        pid
        for (pid,) in session.query(PhotoScores.photo_id).filter(
            PhotoScores.album_id == album_id, PhotoScores.review_override == "hide"
        )
    }


def highlight_filenames(session, album_id):
    """Highlights in shooting order, without anything the studio hid."""
    rows = (
        session.query(FileMetadata)
        .join(PhotoScores, PhotoScores.photo_id == FileMetadata.id)
        .filter(
            FileMetadata.album_id == album_id,
            PhotoScores.in_highlights.is_(True),
            PhotoScores.review_override.is_distinct_from("hide"),
        )
        .all()
    )
    return [m.filename for m in sorted(rows, key=lambda m: (capture_time(m), m.id))]


def publish(session, album, published, by_studio=True):
    album.smart_published = published
    if by_studio:
        album.smart_touched = True


def auto_publish_on_delivery(session, album):
    """Delivering a gallery shows its highlights, unless the studio already
    decided one way or the other."""
    if album and album.smart_state == "ready" and not album.smart_touched:
        publish(session, album, True, by_studio=False)
