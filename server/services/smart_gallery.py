"""Smart gallery: stacks near-duplicates, flags the photos worth a second look
and picks a Highlights set. Scores come from the face service at upload; the
selection here is pure and album-wide, so it can run again any time without
the studio's manual choices being lost."""

import json
import os
from dataclasses import dataclass
from datetime import datetime
from functools import lru_cache
from pathlib import Path

import numpy as np
from sqlalchemy import func

from db.base import session_scope
from db.models import Album, AlbumMoment, FaceEmbedding, FileMetadata, PhotoScores
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

    # moments: a time gap this many times the album's median gap starts a new one,
    # within these bounds
    moment_gap_k: float = _env("MOMENT_GAP_K", 8.0)
    moment_gap_min_s: float = _env("MOMENT_GAP_MIN_S", 150.0)
    moment_gap_max_s: float = _env("MOMENT_GAP_MAX_S", 900.0)
    # scene change: the mean look of this many photos before vs after a point
    moment_window: int = _env("MOMENT_WINDOW", 5)
    moment_scene_sim: float = _env("MOMENT_SCENE_SIM", 0.80)
    # smaller moments fold into a neighbor
    moment_min_photos: int = _env("MOMENT_MIN_PHOTOS", 4)
    # the count follows the album's size, between these
    moment_photos_per: int = _env("MOMENT_PHOTOS_PER", 16)
    moment_min_cap: int = 3
    moment_max_cap: int = 14
    # merging down to the cap prefers similar, small, close-in-time neighbors
    moment_size_weight: float = 0.5
    moment_gap_weight: float = 0.2
    moment_gap_scale_s: float = 1800.0
    # a label has to stand this many album-wide standard deviations above the
    # album's average for it, and this far above the runner-up
    moment_label_lift: float = _env("MOMENT_LABEL_LIFT", 0.6)
    moment_label_margin: float = _env("MOMENT_LABEL_MARGIN", 0.25)
    moment_label_reuse: int = 2


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
    moment_key: str = None
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


def _unit_mean(recs):
    m = np.mean([r.clip for r in recs], axis=0)
    return m / (np.linalg.norm(m) or 1.0)


def moment_cap(n, cfg=CONFIG):
    return int(min(cfg.moment_max_cap, max(cfg.moment_min_cap, round(n / cfg.moment_photos_per))))


def _time_cuts(timed, cfg):
    gaps = np.diff([r.t.timestamp() for r in timed])
    limit = min(cfg.moment_gap_max_s, max(cfg.moment_gap_min_s, cfg.moment_gap_k * float(np.median(gaps))))
    return {i + 1 for i, g in enumerate(gaps) if g > limit}


def _scene_cuts(timed, cfg):
    """Points where the look of the next few photos departs from the last few.
    Only the deepest dip in each window counts, so one change is one cut."""
    w, n = cfg.moment_window, len(timed)
    clips = np.stack([r.clip for r in timed])
    sim = np.ones(n)
    for i in range(1, n):
        a, b = clips[max(0, i - w) : i].mean(axis=0), clips[i : i + w].mean(axis=0)
        sim[i] = float(a @ b / ((np.linalg.norm(a) * np.linalg.norm(b)) or 1.0))
    return {
        i
        for i in range(1, n)
        if sim[i] < cfg.moment_scene_sim and sim[i] <= sim[max(1, i - w) : i + w].min()
    }


def _closeness(a, b, n, cfg):
    """How much two neighboring segments want to be one: similar looks, small
    together, and not far apart in time."""
    sim = float(_unit_mean(a) @ _unit_mean(b))
    gap = (b[0].t - a[-1].t).total_seconds()
    return (
        sim
        - cfg.moment_size_weight * (len(a) + len(b)) / n
        - cfg.moment_gap_weight * min(1.0, gap / cfg.moment_gap_scale_s)
    )


def segment_moments(recs, cfg=CONFIG):
    """Split the album's timed, visible photos into moments, in time order.
    Gaps in shooting and scene changes cut; segments under moment_min_photos
    fold into their closer neighbor; the count is capped by the album's size."""
    timed = sorted((r for r in recs if r.has_time and not r.hidden), key=lambda r: (r.t, r.id))
    n = len(timed)
    if n < 2 * cfg.moment_min_photos:
        return []
    cuts = sorted(_time_cuts(timed, cfg) | _scene_cuts(timed, cfg))
    segs = [timed[a:b] for a, b in zip([0] + cuts, cuts + [n])]

    def fold(i):
        near = [j for j in (i - 1, i + 1) if 0 <= j < len(segs)]
        j = max(near, key=lambda j: _closeness(*sorted_pair(i, j), n, cfg))
        lo, hi = min(i, j), max(i, j)
        segs[lo : hi + 1] = [segs[lo] + segs[hi]]

    def sorted_pair(i, j):
        return (segs[i], segs[j]) if i < j else (segs[j], segs[i])

    while len(segs) > 1:
        small = [i for i, g in enumerate(segs) if len(g) < cfg.moment_min_photos]
        if not small:
            break
        fold(min(small, key=lambda i: len(segs[i])))
    cap = moment_cap(n, cfg)
    while len(segs) > cap:
        i = max(range(len(segs) - 1), key=lambda i: _closeness(segs[i], segs[i + 1], n, cfg))
        segs[i : i + 2] = [segs[i] + segs[i + 1]]
    return segs if len(segs) >= 2 else []


# Labels come from CLIP text vectors computed at build time (see
# face-service/export_moment_labels.py), so the backend needs no text model.
ASSETS = Path(__file__).resolve().parent.parent / "assets"


@lru_cache(maxsize=1)
def moment_vocab():
    """(labels, unit vectors) or None when the files aren't there."""
    try:
        labels = json.loads((ASSETS / "moment_labels.json").read_text())["labels"]
        vectors = np.load(ASSETS / "moment_labels.npy").astype(np.float32)
    except (OSError, KeyError, ValueError):
        return None
    return (labels, vectors) if len(labels) == len(vectors) else None


@dataclass
class Moment:
    ordinal: int
    recs: list
    label: str
    # label name before the " 2" suffix; None when the label is a fallback
    matched: str = None
    lift: float = 0.0
    margin: float = 0.0
    custom: bool = False

    @property
    def key(self):
        return f"m{self.ordinal}"


def label_moments(segments, album_clips, vocab, cfg=CONFIG):
    """One Moment per segment. A moment takes the vocabulary label its photos
    sit furthest above the album's own average for, in album-wide standard
    deviations, as long as it leads the runner-up. Without a clear winner it is
    "Moment N". A label serves at most moment_label_reuse moments, the strongest."""
    moments = [Moment(i, g, f"Moment {i}") for i, g in enumerate(segments, 1)]
    if not vocab or not moments:
        return moments
    labels, vectors = vocab
    everything = album_clips @ vectors.T
    mean, std = everything.mean(axis=0), everything.std(axis=0) + 1e-6
    claims = {}
    for m in moments:
        sims = np.stack([r.clip for r in m.recs]) @ vectors.T
        lift = ((sims - mean) / std).mean(axis=0)
        order = np.argsort(-lift)
        best, runner = int(order[0]), int(order[1])
        m.lift, m.margin = float(lift[best]), float(lift[best] - lift[runner])
        if m.lift >= cfg.moment_label_lift and m.margin >= cfg.moment_label_margin:
            claims.setdefault(labels[best], []).append(m)
    for name, claimants in claims.items():
        keep = sorted(claimants, key=lambda m: -m.lift)[: cfg.moment_label_reuse]
        for n, m in enumerate(sorted(keep, key=lambda m: m.ordinal), 1):
            m.label, m.matched = (name if n == 1 else f"{name} {n}"), name
    return moments


def find_moments(recs, cfg=CONFIG, vocab=None):
    """Segment and label. Also records each photo's moment_key."""
    for r in recs:
        r.moment_key = None
    segments = segment_moments(recs, cfg)
    if not segments:
        return []
    clips = np.stack([r.clip for r in recs])
    moments = label_moments(segments, clips, vocab, cfg)
    for m in moments:
        for r in m.recs:
            r.moment_key = m.key
    return moments


def carry_custom_labels(moments, old_groups, old_custom, min_overlap=0.5):
    """Give each studio-renamed moment's name to the new moment holding mostly
    the same photos. old_groups: {key: set(photo ids)}, old_custom: {key: label}."""
    pairs = []
    for key, label in old_custom.items():
        before = old_groups.get(key, set())
        for m in moments:
            now = {r.id for r in m.recs}
            union = len(before | now)
            if union and len(before & now) / union >= min_overlap:
                pairs.append((len(before & now) / union, key, m))
    used_keys, used_moments = set(), set()
    for _, key, m in sorted(pairs, key=lambda p: -p[0]):
        if key in used_keys or m.ordinal in used_moments:
            continue
        used_keys.add(key)
        used_moments.add(m.ordinal)
        m.label, m.custom = old_custom[key], True


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
        moments = find_moments(recs, cfg, moment_vocab())
        old_rows = session.query(AlbumMoment).filter_by(album_id=album_id).all()
        old_groups = {}
        for pid, key in session.query(PhotoScores.photo_id, PhotoScores.moment_key).filter(
            PhotoScores.album_id == album_id, PhotoScores.moment_key.isnot(None)
        ):
            old_groups.setdefault(key, set()).add(pid)
        carry_custom_labels(moments, old_groups, {m.key: m.label for m in old_rows if m.label_custom})
        by_id = {r.id: r for r in recs}
        for sc in session.query(PhotoScores).filter(PhotoScores.album_id == album_id):
            r = by_id.get(sc.photo_id)
            if not r:
                continue
            sc.technical, sc.people, sc.main_faces = r.technical, r.people, r.main_faces
            sc.combined = r.combined
            sc.stack_id, sc.is_stack_best = r.stack_id, r.is_best
            sc.in_highlights, sc.review_reason = r.highlight, r.review
            sc.moment_key = r.moment_key
        for row in old_rows:
            session.delete(row)
        session.flush()
        for m in moments:
            session.add(
                AlbumMoment(
                    album_id=album_id, key=m.key, ordinal=m.ordinal, label=m.label, label_custom=m.custom
                )
            )
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


def moments_json(session, album_id, studio=False):
    """The album's moments for the API, in time order, built from the photos
    that are visible: a hidden photo never shows, and the range, count and cover
    always match what the viewer can open."""
    rows = session.query(AlbumMoment).filter_by(album_id=album_id).order_by(AlbumMoment.ordinal).all()
    if not rows:
        return []
    photos = (
        session.query(PhotoScores, FileMetadata)
        .join(FileMetadata, FileMetadata.id == PhotoScores.photo_id)
        .filter(
            PhotoScores.album_id == album_id,
            PhotoScores.moment_key.isnot(None),
            PhotoScores.review_override.is_distinct_from("hide"),
        )
        .all()
    )
    by_key = {}
    for sc, meta in photos:
        by_key.setdefault(sc.moment_key, []).append((capture_time(meta), meta.id, sc, meta))
    out = []
    for row in rows:
        items = sorted(by_key.get(row.key, []), key=lambda x: (x[0], x[1]))
        if not items:
            continue
        # the cover is the best combined score, leaving out what the review flags
        sound = [x for x in items if x[2].review_reason is None or x[2].review_override == "keep"]
        cover = max(sound or items, key=lambda x: (x[2].combined if x[2].combined is not None else -1.0, -x[1]))
        entry = {
            "key": row.key,
            "label": row.label,
            "start": items[0][0].isoformat(),
            "end": items[-1][0].isoformat(),
            "count": len(items),
            "cover": cover[3].filename,
            "filenames": [x[3].filename for x in items],
        }
        if studio:
            entry["custom"] = bool(row.label_custom)
        out.append(entry)
    return out


def rename_moment(session, album_id, key, label):
    """The studio's own name for a moment; blank goes back to the automatic one,
    which the caller gets by re-running the selection."""
    row = session.query(AlbumMoment).filter_by(album_id=album_id, key=key).first()
    if not row:
        return False
    label = " ".join(label.split())
    row.label_custom = bool(label)
    if label:
        row.label = label
    return True


def publish(session, album, published, by_studio=True):
    album.smart_published = published
    if by_studio:
        album.smart_touched = True


def auto_publish_on_delivery(session, album):
    """Delivering a gallery shows its highlights, unless the studio already
    decided one way or the other."""
    if album and album.smart_state == "ready" and not album.smart_touched:
        publish(session, album, True, by_studio=False)
