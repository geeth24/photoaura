"""Checks for smart gallery Moments: segmentation on a made-up timeline, labels
and their fallback, who sees moments and which photos, renames surviving a
re-selection, and the 0025 migration both ways.

Runs the real app in-process against a LOCAL Postgres at migration 0025, with
an invented album (random vectors), and removes what it made. The migration
check goes down to 0024 and back up on that database, so don't point it at one
you care about.

    cd server
    POSTGRES_HOST=localhost POSTGRES_PORT=55432 POSTGRES_DB=... \\
    AWS_BUCKET=x DATA_DIR=/tmp/aura-e2e python -m scripts.moments_test
"""

import os
import sys
import uuid
from datetime import datetime, timedelta

if os.environ.get("POSTGRES_HOST", "localhost") not in ("localhost", "127.0.0.1"):
    sys.exit("refusing to run: POSTGRES_HOST must be a local database")
os.environ.setdefault("DATA_DIR", "/tmp/aura-e2e")

import numpy as np  # noqa: E402
import sqlalchemy as sa  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from db.base import engine, session_scope  # noqa: E402
from db.models import (  # noqa: E402
    Album, AlbumMoment, FileMetadata, PhotoScores, User, UserAlbumPermission,
)
from routers.auth.auth_router import create_token  # noqa: E402
from services import smart_gallery as sg  # noqa: E402

RUN = uuid.uuid4().hex[:8]
SLUG = f"zz-moments-test-{RUN}"
failures = []
BASE = datetime(2026, 1, 3, 17, 0, 0)


def check(cond, msg):
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        failures.append(msg)


def unit(v):
    return v / np.linalg.norm(v)


def look_of(name):
    """An image vector that resembles one label and no other, so a moment
    built from it has a single right answer."""
    labels, vectors = sg.moment_vocab()
    return unit(np.linalg.pinv(vectors)[:, labels.index(name)])


def rec(i, t, clip, hidden=False):
    return sg.Rec(
        id=i, filename=f"p{i}.jpg", t=t or BASE, has_time=t is not None, portrait=False,
        aesthetic=5.0, sharpness=1500.0, exposure=(0, 0, 0.5), clip=clip, faces=[],
        review_override="hide" if hidden else None,
    )


def timeline(spec, rng, start_id=1):
    """spec: [(count, seconds apart, scene vector, seconds of gap before it)]"""
    out, t, i = [], BASE, start_id
    for count, step, vec, gap in spec:
        t += timedelta(seconds=gap)
        for _ in range(count):
            out.append(rec(i, t, unit(vec + 0.012 * rng.normal(size=768))))
            t += timedelta(seconds=step)
            i += 1
    return out


def segmentation_checks():
    print("segmentation on a made-up timeline")
    rng = np.random.default_rng(3)
    a, b, c, d = (unit(rng.normal(size=768)) for _ in range(4))

    recs = timeline([(20, 10, a, 0), (20, 10, a, 720), (20, 10, c, 10)], rng)
    segs = sg.segment_moments(recs)
    check([len(s) for s in segs] == [20, 20, 20], f"time gap and scene change each cut once ({[len(s) for s in segs]})")
    check(all(x[-1].t <= y[0].t for x, y in zip(segs, segs[1:])), "moments come in time order")
    check(sorted(r.id for s in segs for r in s) == sorted(r.id for r in recs), "every photo lands in exactly one moment")

    recs = timeline([(20, 10, a, 0), (2, 10, b, 900), (20, 10, c, 900)], rng)
    segs = sg.segment_moments(recs)
    check(len(segs) == 2 and sum(map(len, segs)) == 42, f"a 2-photo stretch folds into a neighbor ({[len(s) for s in segs]})")

    recs = timeline([(20, 10, a, 0), (20, 10, b, 0), (20, 10, c, 0)], rng)
    check(len(sg.segment_moments(recs)) == 3, "scene change alone cuts when there is no gap")

    recs = timeline([(20, 10, a, 0)] * 1, rng)
    check(sg.segment_moments(recs) == [], "one steady stretch is not split into moments")
    check(sg.segment_moments(recs[:5]) == [], "a handful of photos gets none")

    spec = [(5, 10, unit(rng.normal(size=768)), 0 if k == 0 else 1200) for k in range(60)]
    recs = timeline(spec, rng)
    segs = sg.segment_moments(recs)
    check(len(segs) == sg.moment_cap(len(recs)) == 14, f"300 photos in 60 bursts cap at 14 ({len(segs)})")
    check(sg.moment_cap(40) == 3 and sg.moment_cap(1000) == 14, "cap scales with size, 3 to 14")
    check(all(len(s) >= sg.CONFIG.moment_min_photos for s in segs), "no moment under the minimum size")

    recs = timeline([(20, 10, a, 0), (20, 10, a, 720)], rng)
    recs.append(rec(900, None, a))
    recs[3] = rec(recs[3].id, recs[3].t, recs[3].clip, hidden=True)
    segs = sg.segment_moments(recs)
    ids = {r.id for s in segs for r in s}
    check(900 not in ids, "a photo without a capture time is in no moment")
    check(recs[3].id not in ids, "a hidden photo is in no moment")


def label_checks():
    print("labels and the fallback")
    labels, vectors = sg.moment_vocab()
    check(len(labels) == len(vectors) >= 12 and vectors.shape[1] == 768, f"vocabulary loads ({len(labels)} labels)")
    check(np.allclose(np.linalg.norm(vectors, axis=1), 1.0, atol=1e-4), "label vectors are unit length")
    check(len(set(labels)) == len(labels), "labels are unique")
    rng = np.random.default_rng(5)
    cake, dance = look_of("Cake cutting"), look_of("Dance floor")

    def scene(vec, n=10):
        return [rec(0, BASE, unit(vec + 0.012 * rng.normal(size=768))) for _ in range(n)]

    segs = [scene(cake), scene(dance), scene(unit(rng.normal(size=768))), scene(unit(rng.normal(size=768)))]
    clips = np.stack([r.clip for s in segs for r in s])
    ms = sg.label_moments(segs, clips, sg.moment_vocab())
    check(ms[0].label == "Cake cutting" and ms[1].label == "Dance floor", f"clear matches get their label ({ms[0].label}, {ms[1].label})")
    check(ms[2].label == "Moment 3" and ms[3].label == "Moment 4", "nothing confident falls back to Moment N")
    check(sg.label_moments(segs, clips, None)[0].label == "Moment 1", "no vocabulary files: every moment is Moment N")

    same = [scene(cake) for _ in range(4)] + [scene(dance) for _ in range(2)]
    clips = np.stack([r.clip for s in same for r in s])
    ms = sg.label_moments(same, clips, sg.moment_vocab())
    cakes = [m.label for m in ms if m.matched == "Cake cutting"]
    check(len(cakes) <= 2, f"a label serves at most two moments ({cakes})")
    check(cakes[:2] == ["Cake cutting", "Cake cutting 2"][: len(cakes)], "the second use gets a 2")

    print("studio names carry over by photo overlap")
    mk = lambda ids, n: sg.Moment(n, [rec(i, BASE, np.zeros(768)) for i in ids], f"Moment {n}")
    new = [mk(range(1, 11), 1), mk(range(11, 21), 2), mk(range(5, 15), 3)]
    sg.carry_custom_labels(new, {"m1": set(range(1, 11)), "m2": set(range(11, 21))}, {"m1": "Aarti", "m2": "Cake"})
    check([m.label for m in new] == ["Aarti", "Cake", "Moment 3"], "each name goes to the moment holding the same photos")
    new = [mk(range(100, 110), 1)]
    sg.carry_custom_labels(new, {"m1": set(range(1, 11))}, {"m1": "Aarti"})
    check(new[0].label == "Moment 1", "a moment with different photos does not inherit it")


def build_album():
    """45 photos: three scenes 12 minutes apart (cake, dance, nothing in
    particular) and three with no capture time."""
    rng = np.random.default_rng(11)
    scenes = [look_of("Cake cutting"), look_of("Dance floor"), unit(rng.normal(size=768))]
    with session_scope() as s:
        album = Album(name=SLUG, slug=SLUG, location=SLUG, date=datetime.now(), image_count=45,
                      shared=False, upload=False, secret=uuid.uuid4().hex, face_detection=True)
        s.add(album)
        s.flush()
        album_id = album.id
        n = 0
        for si, vec in enumerate(scenes):
            for k in range(14):
                t = BASE + timedelta(seconds=si * 2000 + k * 20)
                add_photo(s, album_id, n, t, unit(vec + 0.012 * rng.normal(size=768)), aesthetic=9.0 if (si, k) == (1, 5) else 5.0)
                n += 1
        for k in range(3):
            add_photo(s, album_id, n, None, unit(rng.normal(size=768)))
            n += 1
    return album_id


def add_photo(s, album_id, i, t, clip, aesthetic=5.0):
    meta = FileMetadata(
        album_id=album_id, filename=f"shot-{i:03d}.jpg", base_name=f"shot-{i:03d}", content_type="image/jpeg",
        width=1600, height=1066, upload_date=datetime(2026, 1, 4), orientation="landscape",
        exif_data='{"DateTimeOriginal": "%s"}' % t.strftime("%Y:%m:%d %H:%M:%S") if t else None,
    )
    s.add(meta)
    s.flush()
    s.add(PhotoScores(
        photo_id=meta.id, album_id=album_id, aesthetic=aesthetic, sharpness=1500.0,
        clipped_highlights=0.0, clipped_shadows=0.0, exposure_mean=0.5, clip=clip.tolist(),
    ))


def cleanup(album_id, user_ids):
    with session_scope() as s:
        s.query(UserAlbumPermission).filter_by(album_id=album_id).delete()
        s.query(AlbumMoment).filter_by(album_id=album_id).delete()
        s.query(PhotoScores).filter_by(album_id=album_id).delete()
        s.query(FileMetadata).filter_by(album_id=album_id).delete()
        s.query(Album).filter_by(id=album_id).delete()
        s.query(User).filter(User.id.in_(user_ids)).delete(synchronize_session=False)


def api_checks():
    album_id = build_album()
    with session_scope() as s:
        admin = User(user_name=f"admin-{RUN}", role="admin", full_name="Admin", user_email=f"a-{RUN}@example.test")
        client = User(user_name=f"client-{RUN}", role="client", full_name="Client", user_email=f"c-{RUN}@example.test")
        s.add_all([admin, client])
        s.flush()
        s.add(UserAlbumPermission(user_id=client.id, album_id=album_id))
        user_ids = [admin.id, client.id]
        A = {"Authorization": "Bearer " + create_token(admin, 60 * 24)["access_token"]}
        C = {"Authorization": "Bearer " + create_token(client, 60 * 24)["access_token"]}
    try:
        with TestClient(__import__("main").app) as c:
            get = lambda h: c.get(f"/api/album/{SLUG}/", headers=h).json()
            sg.select_album(album_id)

            print("the contract")
            ms = get(A)["moments"]
            check(isinstance(ms, list) and len(ms) == 3, f"admin gets three moments ({len(ms)})")
            check(all(set(m) == {"key", "label", "start", "end", "count", "cover", "filenames"} for m in ms), "exactly the contract's fields")
            check([m["key"] for m in ms] == ["m1", "m2", "m3"], "keys m1..m3 in order")
            check(all(datetime.fromisoformat(m["start"]) <= datetime.fromisoformat(m["end"]) for m in ms), "start and end are ISO 8601, start first")
            check(all(datetime.fromisoformat(a["end"]) < datetime.fromisoformat(b["start"]) for a, b in zip(ms, ms[1:])), "ordered by time, no overlap")
            check(all(m["count"] == len(m["filenames"]) == 14 for m in ms), "count matches filenames (14 each)")
            check(all(m["cover"] in m["filenames"] for m in ms), "cover is one of the moment's photos")
            check(all(m["filenames"] == sorted(m["filenames"]) for m in ms), "filenames in capture order")
            check(ms[0]["label"] == "Cake cutting" and ms[1]["label"] == "Dance floor" and ms[2]["label"] == "Moment 3",
                  f"labels: {[m['label'] for m in ms]}")
            allm = {f for m in ms for f in m["filenames"]}
            photos = {p["file_metadata"]["filename"] for p in get(A)["album_photos"]}
            check(len(photos) == 45 and len(allm) == 42, "the three untimed photos are in All but in no moment")
            check(ms[1]["cover"] == "shot-019.jpg", "cover is the best combined score")

            print("who sees moments")
            check(get(C)["moments"] is None, "client gets null before publishing")
            c.post(f"/api/album/{SLUG}/smart/publish", headers=A, json={"published": True})
            check(get(C)["moments"] == ms, "client gets the same moments once published")
            c.post(f"/api/album/{SLUG}/smart/publish", headers=A, json={"published": False})
            check(get(C)["moments"] is None and get(A)["moments"] == ms, "unpublish hides them from the client, not the admin")
            c.post(f"/api/album/{SLUG}/smart/publish", headers=A, json={"published": True})

            print("hidden photos")
            gone, cover = ms[1]["filenames"][2], ms[1]["cover"]
            c.post(f"/api/album/{SLUG}/smart/review", headers=A, json={"hide": [gone, cover]})
            cm = get(C)["moments"]
            check(all(gone not in m["filenames"] and cover not in m["filenames"] for m in cm), "hidden photos never reach the client's moments")
            check(cm[1]["count"] == 12 and cm[1]["cover"] not in (gone, cover), "count and cover follow what is visible")
            ps = {p["file_metadata"]["filename"] for p in get(C)["album_photos"]}
            check(gone not in ps, "and they are gone from the client's All too")
            check(len(c.get(f"/api/album/{SLUG}/smart", headers=A).json()["moments"]) == 3, "studio smart view still lists three")
            c.post(f"/api/album/{SLUG}/smart/review", headers=A, json={"clear": [gone, cover]})

            print("renames")
            smart = c.get(f"/api/album/{SLUG}/smart", headers=A).json()
            check(all("custom" in m for m in smart["moments"]) and not any(m["custom"] for m in smart["moments"]), "studio view marks custom names (none yet)")
            check(c.post(f"/api/album/{SLUG}/smart/moments/m2", headers=C, json={"label": "x"}).status_code == 403, "clients can't rename")
            check(c.post(f"/api/album/{SLUG}/smart/moments/m9", headers=A, json={"label": "x"}).status_code == 404, "unknown key is a 404")
            check(c.post(f"/api/album/{SLUG}/smart/moments/m2", headers=A, json={"label": "x" * 61}).status_code == 422, "labels over 60 characters are refused")
            r = c.post(f"/api/album/{SLUG}/smart/moments/m2", headers=A, json={"label": "  Sangeet   night "})
            check(r.status_code == 200 and r.json()["moments"][1]["label"] == "Sangeet night" and r.json()["moments"][1]["custom"], "rename trims, saves and marks custom")
            check(get(C)["moments"][1]["label"] == "Sangeet night", "the client sees the new name")
            hide = ms[1]["filenames"][:2] + ms[0]["filenames"][:1]
            c.post(f"/api/album/{SLUG}/smart/review", headers=A, json={"hide": hide})
            sg.select_album(album_id)
            after = get(A)["moments"]
            check(after[1]["label"] == "Sangeet night", "the name survives a re-selection that moved photos around")
            check(after[0]["label"] == "Cake cutting", "automatic labels are untouched")
            c.post(f"/api/album/{SLUG}/smart/review", headers=A, json={"clear": hide})
            r = c.post(f"/api/album/{SLUG}/smart/moments/m2", headers=A, json={"label": ""})
            check(r.json()["moments"][1]["label"] == "Dance floor" and not r.json()["moments"][1]["custom"], "a blank name goes back to the automatic one")

            print("re-selection is stable")
            before = get(A)["moments"]
            sg.select_album(album_id)
            check(get(A)["moments"] == before, "running it again changes nothing")
            with session_scope() as s:
                keys = [k for (k,) in s.query(PhotoScores.moment_key).filter_by(album_id=album_id)]
                check(sum(k is None for k in keys) == 3 and len(set(keys) - {None}) == 3, "moment_key set on 42 photos, null on the 3 untimed")
    finally:
        cleanup(album_id, user_ids)


def migration_checks():
    print("migration 0025 down and up")
    cfg = Config(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "alembic"))
    insp = lambda: sa.inspect(engine)
    has = lambda: ("album_moments" in insp().get_table_names(), "moment_key" in {c["name"] for c in insp().get_columns("photo_scores")})
    head = lambda: sa.text("select version_num from alembic_version")
    with engine.connect() as conn:
        start = conn.execute(head()).scalar()
    check(start >= "0025", f"database has 0025 applied (at {start})")
    check(has() == (True, True), "table and column exist")
    command.downgrade(cfg, "0024")
    engine.dispose()
    with engine.connect() as conn:
        check(conn.execute(head()).scalar() == "0024", "downgrade lands on 0024 (the revision it follows)")
    check(has() == (False, False), "downgrade drops the table and the column")
    command.upgrade(cfg, start)
    engine.dispose()
    with engine.connect() as conn:
        check(conn.execute(head()).scalar() == start, f"upgrade returns to {start}")
    check(has() == (True, True), "and brings both back")
    from alembic.script import ScriptDirectory
    rev = ScriptDirectory.from_config(cfg).get_revision("0025")
    check(rev.down_revision == "0024", "0025 follows 0024")


if __name__ == "__main__":
    segmentation_checks()
    label_checks()
    api_checks()
    migration_checks()
    print()
    if failures:
        print(f"{len(failures)} FAILED")
        sys.exit(1)
    print("all passed")
