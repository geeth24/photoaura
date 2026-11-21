"""Checks for reels in the web UI's API: the Highlights picker, the default
reel, the publish switch, who sees which reels on the album and share pages,
and the 0027 migration both ways.

Runs the real app in-process against a LOCAL Postgres at migration 0027, with
S3 replaced by an in-memory fake and invented albums (generated images), and
removes what it made. One reel is really rendered, so ffmpeg must be on PATH.
The migration check goes down to 0026 and back up on that database, so don't
point it at one you care about.

    cd server
    POSTGRES_HOST=localhost POSTGRES_PORT=55432 POSTGRES_DB=... \\
    AWS_BUCKET=x DATA_DIR=/tmp/aura-e2e python -m scripts.reels_test
"""

import io
import os
import random
import sys
import time
import uuid
from datetime import datetime, timedelta

if os.environ.get("POSTGRES_HOST", "localhost") not in ("localhost", "127.0.0.1"):
    sys.exit("refusing to run: POSTGRES_HOST must be a local database")
os.environ.setdefault("DATA_DIR", "/tmp/aura-e2e")

import sqlalchemy as sa  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

from db.base import engine, session_scope  # noqa: E402
from db.models import (  # noqa: E402
    Album, AlbumReel, FileMetadata, PhotoScores, User, UserAlbumPermission,
)
from routers.auth.auth_router import create_token  # noqa: E402
from routers.reels import reels_router  # noqa: E402
from services import reel_service  # noqa: E402
from services.aws_service import s3_client  # noqa: E402
from services.reel_service import DEFAULT_REEL_PHOTOS, pick_reel_photos  # noqa: E402

RUN = uuid.uuid4().hex[:8]
BASE = datetime(2026, 5, 9, 15, 0, 0)
failures = []


def check(cond, msg):
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        failures.append(msg)


class FakeS3:
    def __init__(self):
        self.store, self.gets = {}, []

    def get_object(self, Bucket, Key):
        self.gets.append(Key)
        return {"Body": io.BytesIO(self.store[Key])}

    def upload_fileobj(self, f, Bucket, Key, ExtraArgs=None):
        self.store[Key] = f.read()

    def head_object(self, Bucket, Key):
        if Key not in self.store:
            raise Exception("404")
        return {"Metadata": {}}

    def delete_object(self, Bucket, Key):
        self.store.pop(Key, None)


fake = FakeS3()
for name in ("get_object", "upload_fileobj", "head_object", "delete_object"):
    setattr(s3_client, name, getattr(fake, name))


def picker_checks():
    print("the Highlights picker")
    at = lambda s: BASE + timedelta(seconds=s)
    check(pick_reel_photos([]) == [], "nothing in, nothing out")

    few = [(f"p{i}.jpg", at(100 - i * 10), 0.5) for i in range(5)]
    check(pick_reel_photos(few) == [f"p{i}.jpg" for i in reversed(range(5))], "5 photos: all of them, in time order")
    eighteen = [(f"p{i:02d}.jpg", at(i * 60), 0.1) for i in range(18)]
    check(pick_reel_photos(eighteen) == [f for f, _, _ in eighteen], "exactly 18: all of them")
    nineteen = eighteen + [("p18.jpg", at(18 * 60), 0.9)]
    check(len(pick_reel_photos(nineteen)) == 18, "19 photos: 18 picked")

    # 36 photos 10 s apart: each of the 18 buckets holds a pair, the odd one scores higher
    pairs = [(f"q{i:02d}.jpg", at(i * 10), 0.8 if i % 2 else 0.2) for i in range(36)]
    picks = pick_reel_photos(pairs)
    check(picks == [f"q{i:02d}.jpg" for i in range(1, 36, 2)], "one per time bucket, the best score in each")

    # two bursts an hour apart: 16 buckets sit empty and are topped up from the best of the rest
    rng = random.Random(4)
    early = [(f"a{i:02d}.jpg", at(i), 0.5 + rng.random() / 2) for i in range(20)]
    late = [(f"b{i:02d}.jpg", at(3600 + i), rng.random() / 4) for i in range(10)]
    picks = pick_reel_photos(early + late)
    best_late = max(late, key=lambda x: x[2])[0]
    check(len(picks) == 18, f"empty buckets filled up to 18 ({len(picks)})")
    check(best_late in picks, "the late burst keeps its best photo even though it scores low")
    check(sum(p.startswith("a") for p in picks) == 17, "the rest come from the best of the early burst")
    left = [x for x in early if x[0] not in picks]
    worst_kept = min(x[2] for x in early if x[0] in picks)
    check(all(x[2] <= worst_kept for x in left), "nothing left out scores above anything kept")
    order = {f: t for f, t, _ in early + late}
    check(picks == sorted(picks, key=lambda f: (order[f], f)), "picks come back in time order")

    same = [(f"s{i:02d}.jpg", BASE, i / 40) for i in range(30)] + [("s99.jpg", BASE, None)]
    picks = pick_reel_photos(same)
    check(picks == [f"s{i:02d}.jpg" for i in range(12, 30)], "one capture time for all: the 18 best by score")
    check("s99.jpg" not in picks, "a photo with no score ranks last")

    shuffled = early + late
    rng.shuffle(shuffled)
    check(pick_reel_photos(shuffled) == pick_reel_photos(early + late), "input order doesn't matter")


def jpeg(color, size=(1600, 1066)):
    im = Image.new("RGB", size, color)
    d = ImageDraw.Draw(im)
    d.ellipse((size[0] // 3, size[1] // 4, 2 * size[0] // 3, 3 * size[1] // 4), fill=tuple(255 - c for c in color))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=85)
    return buf.getvalue()


def make_album(s, slug, photos):
    """photos: [(filename, capture time or None, combined or None (unscored), highlight, hidden, video)]"""
    album = Album(name=slug, slug=slug, location=slug, date=datetime.now(), image_count=len(photos),
                  shared=False, upload=False, secret=uuid.uuid4().hex, face_detection=True)
    s.add(album)
    s.flush()
    for fn, t, combined, highlight, hidden, video in photos:
        meta = FileMetadata(
            album_id=album.id, filename=fn, base_name=fn.rsplit(".", 1)[0],
            content_type="video/mp4" if video else "image/jpeg", width=1600, height=1066,
            upload_date=datetime(2026, 5, 10), orientation="landscape",
            exif_data='{"DateTimeOriginal": "%s"}' % t.strftime("%Y:%m:%d %H:%M:%S") if t else None,
        )
        s.add(meta)
        s.flush()
        if combined is not None:
            s.add(PhotoScores(photo_id=meta.id, album_id=album.id, combined=combined,
                              in_highlights=highlight, review_override="hide" if hidden else None))
    return album


def add_reel(s, album, status="ready", published=False, aspect="9:16", age=0):
    row = AlbumReel(album_id=album.id, aspect=aspect, s3_key=f"{album.slug}/_reels/{RUN}-{age}-{aspect.replace(':', 'x')}.mp4",
                    status=status, duration=21.4 if status == "ready" else None, published=published,
                    created_at=datetime(2026, 5, 11) - timedelta(minutes=age))
    s.add(row)
    s.flush()
    return row.id


def api_checks():
    slugs = {k: f"zz-reels-{k}-{RUN}" for k in ("big", "none", "hidden", "real")}
    rng = random.Random(9)
    # 40 photos over three hours; two of three are highlights, two highlights
    # are hidden by the studio, and a highlighted video
    big = []
    for i in range(40):
        big.append((f"big-{i:02d}.jpg", BASE + timedelta(seconds=i * 270), round(rng.random(), 4), i % 3 != 2, i in (4, 19), False))
    big.append(("big-clip.mp4", BASE + timedelta(seconds=600), 0.99, True, False, True))
    real = [(f"real-{i}.jpg", BASE + timedelta(minutes=i * 7), 0.5 + i / 20, True, False, False) for i in range(6)]
    colors = [(200, 120, 80), (60, 110, 170), (40, 140, 90), (180, 170, 60), (120, 70, 150), (90, 90, 90)]

    with session_scope() as s:
        albums = {
            "big": make_album(s, slugs["big"], big),
            "none": make_album(s, slugs["none"], [(f"n{i}.jpg", BASE + timedelta(minutes=i), None, False, False, False) for i in range(4)]),
            "hidden": make_album(s, slugs["hidden"], [(f"h{i}.jpg", BASE + timedelta(minutes=i), 0.7, True, True, False) for i in range(3)]),
            "real": make_album(s, slugs["real"], real),
        }
        ids = {k: a.id for k, a in albums.items()}
        secrets = {k: a.secret for k, a in albums.items()}
        for (fn, *_), color in zip(real, colors):
            fake.store[f"{slugs['real']}/{fn}"] = jpeg(color)
        admin = User(user_name=f"admin-{RUN}", role="admin", full_name="Admin", user_email=f"a-{RUN}@example.test")
        client = User(user_name=f"client-{RUN}", role="client", full_name="Client", user_email=f"c-{RUN}@example.test")
        outsider = User(user_name=f"other-{RUN}", role="client", full_name="Other", user_email=f"o-{RUN}@example.test")
        s.add_all([admin, client, outsider])
        s.flush()
        for k in ("big", "real"):
            s.add(UserAlbumPermission(user_id=client.id, album_id=ids[k]))
        user_ids = [admin.id, client.id, outsider.id]
        A = {"Authorization": "Bearer " + create_token(admin, 60)["access_token"]}
        C = {"Authorization": "Bearer " + create_token(client, 60)["access_token"]}
        O = {"Authorization": "Bearer " + create_token(outsider, 60)["access_token"]}

    calls = []
    real_start = reels_router.start_reel_job

    def record(album_id, slug, filenames, aspect, music_key=None):
        calls.append(list(filenames))
        with session_scope() as s:
            reel_id, _ = reel_service._new_row(s, album_id, slug, aspect)
        return "recorded", reel_id

    try:
        c = TestClient(__import__("main").app)
        reels_url = lambda k: f"/api/album/{slugs[k]}/reels"

        print("default reel from the Highlights")
        reels_router.start_reel_job = record
        r = c.post(reels_url("big"), headers=A, json={"aspect": "9:16"})
        check(r.status_code == 200 and "reel_id" in r.json(), f"no filenames: the reel starts ({r.status_code})")
        picks = calls[-1] if calls else []
        with session_scope() as s:
            want = pick_reel_photos([
                (m.filename, reel_service.capture_time(m), sc.combined)
                for m, sc in s.query(FileMetadata, PhotoScores).join(PhotoScores, PhotoScores.photo_id == FileMetadata.id)
                .filter(FileMetadata.album_id == ids["big"], PhotoScores.in_highlights.is_(True),
                        PhotoScores.review_override.is_distinct_from("hide"), FileMetadata.content_type == "image/jpeg")
            ])
        check(len(picks) == DEFAULT_REEL_PHOTOS, f"{DEFAULT_REEL_PHOTOS} photos picked from 26 highlights ({len(picks)})")
        check(picks == want, "the picks are the picker's, in time order")
        highlights = {fn for fn, _, _, hl, hidden, video in big if hl and not hidden and not video}
        check(set(picks) <= highlights, "only highlights, none the studio hid")
        check("big-clip.mp4" not in picks, "a highlighted video is left out")
        r = c.post(reels_url("big"), headers=A, json={"aspect": "16:9", "filenames": None})
        check(r.status_code == 200 and calls[-1] == picks, "filenames: null means the same default")
        r = c.post(reels_url("big"), headers=A, json={"aspect": "9:16", "filenames": ["big-00.jpg", "big-01.jpg"]})
        check(r.status_code == 200 and calls[-1] == ["big-00.jpg", "big-01.jpg"], "given filenames are still used as they are")
        r = c.post(reels_url("big"), headers=A, json={"aspect": "9:16", "filenames": []})
        check(r.status_code == 422, f"an empty list is still refused ({r.status_code})")
        n = len(calls)
        r = c.post(reels_url("none"), headers=A, json={"aspect": "9:16"})
        check(r.status_code == 400 and "no Highlights" in r.json()["detail"], f"album without highlights: 400 ({r.status_code} {r.json().get('detail')})")
        r = c.post(reels_url("hidden"), headers=A, json={"aspect": "9:16"})
        check(r.status_code == 400, f"album whose highlights are all hidden: 400 ({r.status_code})")
        check(len(calls) == n, "and no job starts for them")
        r = c.post(reels_url("big"), headers=C, json={"aspect": "9:16"})
        check(r.status_code == 403, f"clients can't make reels ({r.status_code})")
        reels_router.start_reel_job = real_start

        print("a real render from the default picks")
        fake.gets.clear()
        r = c.post(reels_url("real"), headers=A, json={"aspect": "9:16"})
        reel_id = r.json().get("reel_id")
        row = None
        for _ in range(900):
            row = next(x for x in c.get(reels_url("real"), headers=A).json()["reels"] if x["id"] == reel_id)
            if row["status"] != "rendering":
                break
            time.sleep(0.2)
        check(row and row["status"] == "ready", f"renders to ready ({row and row['status']} {row and row['error']})")
        photo_gets = sorted(k for k in fake.gets if not k.startswith("_music/"))
        check(photo_gets == sorted(f"{slugs['real']}/{fn}" for fn, *_ in real), "from all six highlights")
        check(row["published"] is False, "a new reel starts unpublished")
        check(row["s3_key"] in fake.store and row["poster_key"] in fake.store, "video and poster are stored")

        print("publish switch")
        patch = lambda k, rid, body, h=A: c.patch(f"{reels_url(k)}/{rid}", headers=h, json=body)
        check(patch("real", reel_id, {"published": True}, C).status_code == 403, "clients can't publish")
        check(c.patch(f"{reels_url('real')}/{reel_id}", json={"published": True}).status_code == 401, "no token: 401")
        check(patch("real", 99999999, {"published": True}).status_code == 404, "unknown reel: 404")
        check(patch("big", reel_id, {"published": True}).status_code == 404, "a reel through another album's slug: 404")
        check(patch("real", reel_id, {}).status_code == 422, "missing published: 422")
        with session_scope() as s:
            alb = s.get(Album, ids["real"])
            rendering = add_reel(s, alb, status="rendering", age=1)
            failed = add_reel(s, alb, status="failed", age=2)
        r = patch("real", rendering, {"published": True})
        check(r.status_code == 409 and "finished" in r.json()["detail"], f"a rendering reel: 409 ({r.status_code})")
        check(patch("real", failed, {"published": True}).status_code == 409, "a failed reel: 409")
        r = patch("real", reel_id, {"published": True})
        check(r.status_code == 200 and r.json()["published"] is True and r.json()["id"] == reel_id, "publishing a ready reel returns it published")
        listed = next(x for x in c.get(reels_url("real"), headers=A).json()["reels"] if x["id"] == reel_id)
        check(listed["published"] is True, "the studio list shows it published")
        with session_scope() as s:
            check(s.get(AlbumReel, rendering).published is False, "the refused reel stayed unpublished")

        print("who sees which reels")
        album = lambda k, h=None, q="": c.get(f"/api/album/{slugs[k]}/{q}", headers=h or {}).json()
        with session_scope() as s:
            alb = s.get(Album, ids["big"])
            old_pub = add_reel(s, alb, published=True, aspect="16:9", age=30)
            new_unpub = add_reel(s, alb, published=False, age=5)
            new_pub = add_reel(s, alb, published=True, age=10)
            add_reel(s, alb, status="failed", published=True, age=1)
            add_reel(s, alb, status="rendering", age=0)
            s.query(AlbumReel).filter(AlbumReel.album_id == ids["big"], AlbumReel.s3_key.notlike(f"%/{RUN}-%")).delete(synchronize_session=False)
        mine = album("big", A)["reels"]
        check([x["id"] for x in mine] == [new_unpub, new_pub, old_pub], "admin: every ready reel, newest first")
        keys = {"id", "aspect", "url", "poster_url", "duration", "width", "height", "published"}
        check(all(set(x) == keys for x in mine), "exactly the item fields")
        x = next(x for x in mine if x["id"] == old_pub)
        cdn = os.environ.get("AWS_CLOUDFRONT_URL", "")
        check((x["aspect"], x["width"], x["height"]) == ("16:9", 1920, 1080), "16:9 is 1920 x 1080")
        check(x["url"].startswith(f"https://{cdn}/{slugs['big']}/_reels/") and x["poster_url"] == x["url"] + ".poster.jpg", "url and poster_url on the CDN")
        check(not album("big", A)["smart_published"] and not album("real", A)["smart_published"], "neither album has its highlights published")
        theirs = album("big", C)["reels"]
        check([x["id"] for x in theirs] == [new_pub, old_pub], "client: published and ready only, without smart_published")
        check(all(x["published"] for x in theirs), "every client reel says published")
        check(album("real", C)["reels"][0]["id"] == reel_id, "client sees the rendered reel once it's published")
        check(album("big", None, f"?secret={secrets['big']}")["reels"] == theirs, "a share secret on the album page gets the same as the client")
        check(c.get(f"/api/album/{slugs['big']}/", headers=O).status_code == 404, "a client without access gets nothing")
        check(album("none", A)["reels"] == [], "an album with no reels: [] for the studio")
        shared = c.get(f"/api/album/{slugs['big']}/view?secret={secrets['big']}").json()
        check([x["id"] for x in shared["reels"]] == [new_pub, old_pub], "share view: published and ready only")
        check(c.get(f"/api/album/{slugs['big']}/view").status_code == 403, "share view without the secret is still refused")
        patch("big", new_pub, {"published": False})
        check([x["id"] for x in album("big", C)["reels"]] == [old_pub], "unpublishing takes it away from the client")
        check(new_pub in [x["id"] for x in album("big", A)["reels"]], "but not from the studio")
        shared = c.get(f"/api/album/{slugs['big']}/view?secret={secrets['big']}").json()
        check([x["id"] for x in shared["reels"]] == [old_pub], "and the share view drops it too")
    finally:
        reels_router.start_reel_job = real_start
        with session_scope() as s:
            for aid in ids.values():
                s.query(AlbumReel).filter_by(album_id=aid).delete()
                s.query(UserAlbumPermission).filter_by(album_id=aid).delete()
                s.query(PhotoScores).filter_by(album_id=aid).delete()
                s.query(FileMetadata).filter_by(album_id=aid).delete()
                s.query(Album).filter_by(id=aid).delete()
            s.query(User).filter(User.id.in_(user_ids)).delete(synchronize_session=False)


def migration_checks():
    print("migration 0027 down and up")
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    cfg = Config(os.path.join(here, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(here, "alembic"))
    has = lambda: "published" in {c["name"] for c in sa.inspect(engine).get_columns("album_reels")}
    head = lambda: sa.text("select version_num from alembic_version")
    with engine.connect() as conn:
        start = conn.execute(head()).scalar()
    check(start >= "0027", f"database has 0027 applied (at {start})")
    check(has(), "album_reels.published exists")
    command.downgrade(cfg, "0026")
    engine.dispose()
    with engine.connect() as conn:
        check(conn.execute(head()).scalar() == "0026", "downgrade lands on 0026")
    check(not has(), "downgrade drops the column")
    command.upgrade(cfg, start)
    engine.dispose()
    with engine.connect() as conn:
        check(conn.execute(head()).scalar() == start, f"upgrade returns to {start}")
        default = conn.execute(sa.text(
            "select column_default, is_nullable from information_schema.columns "
            "where table_name = 'album_reels' and column_name = 'published'"
        )).one()
    check(has() and default[0] == "false" and default[1] == "NO", f"and brings it back, not null, default false ({tuple(default)})")
    from alembic.script import ScriptDirectory
    check(ScriptDirectory.from_config(cfg).get_revision("0027").down_revision == "0026", "0027 follows 0026")


if __name__ == "__main__":
    picker_checks()
    api_checks()
    migration_checks()
    print()
    if failures:
        print(f"{len(failures)} FAILED")
        sys.exit(1)
    print("all passed")
