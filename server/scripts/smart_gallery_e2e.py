"""End-to-end check of the smart gallery: scores stored, stacks, highlights,
manual overrides, publish visibility and what clients can see.

Runs the real app in-process against a LOCAL Postgres with a made-up album
(random vectors and invented faces), fakes S3, and removes everything it made.

    cd server
    pip install "httpx<0.28"   # TestClient needs it
    POSTGRES_HOST=localhost POSTGRES_PORT=55432 POSTGRES_DB=... \\
    AWS_BUCKET=x DATA_DIR=/tmp/aura-e2e python -m scripts.smart_gallery_e2e
"""

import io
import os
import random
import sys
import uuid
from datetime import datetime, timedelta

if os.environ.get("POSTGRES_HOST", "localhost") not in ("localhost", "127.0.0.1"):
    sys.exit("refusing to run: POSTGRES_HOST must be a local database")
os.environ.setdefault("DATA_DIR", "/tmp/aura-e2e")

import numpy as np  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

import utils.face_recog as fr  # noqa: E402
from db.base import session_scope  # noqa: E402
from db.models import (  # noqa: E402
    Album, FaceData, FaceEmbedding, FileMetadata, PhotoFaceLink, PhotoScores, User, UserAlbumPermission,
)
from routers.auth.auth_router import create_token  # noqa: E402
from services import smart_gallery as sg  # noqa: E402
from services.aws_service import s3_client  # noqa: E402

RUN = uuid.uuid4().hex[:8]
SLUG = f"zz-smart-test-{RUN}"
N_SINGLES, N_BURSTS, BURST = 80, 10, 4
failures = []


def check(cond, msg):
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        failures.append(msg)


def unit(v):
    return v / np.linalg.norm(v)


class FakeS3:
    def __init__(self):
        buf = io.BytesIO()
        Image.new("RGB", (2400, 1600), (120, 120, 120)).save(buf, "JPEG")
        self.img = buf.getvalue()

    def get_object(self, Bucket, Key):
        return {"Body": io.BytesIO(self.img)}

    def upload_fileobj(self, *a, **k):
        pass

    def delete_objects(self, *a, **k):
        return {}

    def delete_object(self, *a, **k):
        return {}


for _m in ("get_object", "upload_fileobj", "delete_objects", "delete_object"):
    setattr(s3_client, _m, getattr(FakeS3(), _m))


def make_photos():
    """Invented shoot: singles spread over three hours plus bursts of near-
    identical frames, six invented people, a few soft and blinking frames."""
    rng = np.random.default_rng(7)
    py = random.Random(7)
    people = {p: unit(rng.normal(size=512)) for p in range(6)}
    # P0-P3 are everywhere, P4 appears in exactly three photos, P5 in two
    plan = []
    base = datetime(2026, 1, 3, 14, 0, 0)

    def shot(t, clip, who, **kw):
        plan.append(dict(t=t, clip=clip, who=who, **kw))

    slots = sorted(py.sample(range(0, 3 * 3600, 20), N_SINGLES + N_BURSTS))
    burst_slots = set(py.sample(range(len(slots)), N_BURSTS))
    for i, s in enumerate(slots):
        t = base + timedelta(seconds=s)
        if i in burst_slots:
            v = unit(rng.normal(size=768))
            who = py.sample(range(4), 2)
            for k in range(BURST):
                shot(t + timedelta(seconds=k * 0.5), unit(v + 0.008 * rng.normal(size=768)), who,
                     burst=len(plan), aesthetic=5.0 + 0.2 * k)
        else:
            shot(t, unit(rng.normal(size=768)), py.sample(range(4), py.choice([0, 1, 1, 2, 3])))
    # P4 / P5 on ordinary singles
    singles = [p for p in plan if "burst" not in p]
    for p in singles[5:8]:
        p["who"] = p["who"] + [4]
    for p in singles[20:22]:
        p["who"] = p["who"] + [5]
    # flaws on late singles, so each person has met a sharp, open-eyed face first
    for p in singles[30:34]:
        p["soft"] = True
        p["who"] = p["who"] or [py.randrange(4)]
    for p in singles[34:38]:
        p["blink"] = True
        p["who"] = p["who"] or [py.randrange(4)]
    for p in singles[38:40]:
        p["who"] = []
        p["soft_frame"] = True
    for p in plan:
        p.setdefault("aesthetic", py.uniform(4.6, 6.4))
    plan.sort(key=lambda p: p["t"])
    return plan, people, rng


def face(emb, px=220, **over):
    f = dict(
        bbox=[100, 100, 100 + px, 100 + px], det_score=0.95, sharpness=1500.0, blur=70.0,
        embedding=emb.tolist(), emb_norm=25.0, kps=[[0, 0]] * 5, yaw=2.0, pitch=1.0, roll=0.0,
        eye_open=0.32, smile=0.5, gaze=0.02, landmark_agreement=0.03,
    )
    f.update(over)
    return f


def build(plan, people, rng):
    with session_scope() as s:
        album = Album(name=SLUG, slug=SLUG, location=SLUG, date=datetime.now(), image_count=len(plan),
                      shared=False, upload=False, secret=uuid.uuid4().hex, face_detection=True)
        s.add(album)
        s.flush()
        album_id = album.id
        ids = []
        for i, p in enumerate(plan):
            stamp = p["t"].strftime("%Y:%m:%d %H:%M:%S")
            portrait = (i % 10) < 3
            meta = FileMetadata(
                album_id=album_id, filename=f"shot-{i:03d}.jpg", base_name=f"shot-{i:03d}",
                content_type="image/jpeg", width=1600 if not portrait else 1066,
                height=1066 if not portrait else 1600, upload_date=datetime(2026, 1, 4),
                exif_data='{"DateTimeOriginal": "%s"}' % stamp,
                orientation="portrait" if portrait else "landscape",
            )
            s.add(meta)
            s.flush()
            ids.append(meta.id)
    for p, pid in zip(plan, ids):
        faces = []
        for who in p["who"]:
            emb = unit(people[who] + 0.012 * rng.normal(size=512))
            over = {}
            if p.get("soft"):
                over["blur"] = 10.0
            if p.get("blink"):
                over["eye_open"] = 0.08
            faces.append(face(emb, **over))
        photo = dict(
            aesthetic=p["aesthetic"], clip=p["clip"].tolist(),
            sharpness=40.0 if p.get("soft_frame") else 1500.0,
            exposure=dict(clipped_highlights=0.002, clipped_shadows=0.004, mean=0.5),
        )
        fr._embed_image = lambda bucket, key, r={"faces": faces, "photo": photo}: r
        fr.detect_and_store_faces(f"{SLUG}/x.jpg", pid, album_id, "test")
    return album_id, ids


def pure_size_checks():
    cfg = sg.CONFIG
    print("highlight size bounds")
    check(sg.target_size(120) == cfg.highlight_min, "small album gets the minimum (20)")
    check(sg.target_size(300) == 36, "300 photos -> 12% = 36")
    check(sg.target_size(2000) == cfg.highlight_max, "huge album is capped at 80")


def cleanup(album_id, user_ids, person_ids):
    with session_scope() as s:
        s.query(UserAlbumPermission).filter_by(album_id=album_id).delete()
        s.query(PhotoScores).filter_by(album_id=album_id).delete()
        s.query(PhotoFaceLink).filter_by(album_id=album_id).delete()
        s.query(FaceEmbedding).filter_by(album_id=album_id).delete()
        s.query(FileMetadata).filter_by(album_id=album_id).delete()
        s.query(Album).filter_by(id=album_id).delete()
        s.query(FaceData).filter(FaceData.external_id.in_(person_ids)).delete(synchronize_session=False)
        s.query(User).filter(User.id.in_(user_ids)).delete(synchronize_session=False)


def main():
    pure_size_checks()
    plan, people, rng = make_photos()
    with session_scope() as s:
        before_people = {e for (e,) in s.query(FaceData.external_id)}
    album_id, ids = build(plan, people, rng)
    with session_scope() as s:
        person_ids = [e for (e,) in s.query(FaceData.external_id) if e not in before_people]
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
            n = len(plan)
            print(f"scores stored ({n} photos)")
            with session_scope() as s:
                rows = s.query(PhotoScores).filter_by(album_id=album_id).all()
                check(len(rows) == n, "one photo_scores row per photo")
                check(all(r.clip is not None and len(r.clip) == 768 for r in rows), "768-d CLIP vector stored")
                check(all(r.aesthetic is not None and r.sharpness is not None for r in rows), "aesthetic + sharpness stored")
            first = c.get(f"/api/album/{SLUG}/smart", headers=A)
            check(first.status_code == 200 and first.json()["status"] == "none", f"status none before selection ({first.status_code})")
            check(c.get(f"/api/album/{SLUG}/smart", headers=C).status_code == 403, "smart view is admin-only")

            sg.set_state(album_id, "scoring")
            check(c.get(f"/api/album/{SLUG}/smart", headers=A).json()["status"] == "scoring", "status scoring while running")
            sg.select_album(album_id)
            smart = c.get(f"/api/album/{SLUG}/smart", headers=A).json()
            check(smart["status"] == "ready", "status ready after selection")
            print(f"  counts {smart['counts']}")

            print("stacks")
            check(len(smart["stacks"]) == N_BURSTS, f"{N_BURSTS} burst stacks formed")
            check(all(len(st["members"]) == BURST for st in smart["stacks"]), f"each stack holds {BURST} frames")
            dupes = {f["filename"] for f in smart["review"]["duplicate"]}
            check(len(dupes) == N_BURSTS * (BURST - 1), "every non-best frame is in review as duplicate")
            check(all(st["best"] not in dupes for st in smart["stacks"]), "no stack best is a duplicate")
            check(len({st["id"] for st in smart["stacks"]}) == N_BURSTS, "stack ids are distinct")

            print("review pile")
            check(len(smart["review"]["blurry"]) >= 6, "soft faces and soft frames flagged blurry")
            check(len(smart["review"]["eyes_closed"]) >= 4, "blinks flagged eyes_closed")

            print("highlights size and coverage")
            with session_scope() as s:
                recs = {r.filename: r for r in sg.select(sg.load_album(s, album_id))}
            picked = [recs[f] for f in smart["highlights"]]
            target = sg.target_size(n)
            check(len(picked) >= target and len(picked) <= sg.CONFIG.highlight_max, f"size {len(picked)} (target {target}, cap 80)")
            check(all(r.is_best and not r.in_review for r in picked), "only stack bests, none in review")
            people_counts = {}
            for r in recs.values():
                for p in r.persons:
                    people_counts[p] = people_counts.get(p, 0) + 1
            wanted = {p for p, k in people_counts.items() if k >= 3}
            shown = set().union(*(r.persons for r in picked))
            check(wanted <= shown, f"all {len(wanted)} people with 3+ photos appear")
            order = sorted(recs.values(), key=lambda r: r.t)
            quarters = [order[i * n // 4:(i + 1) * n // 4] for i in range(4)]
            pickset = {r.id for r in picked}
            check(all(any(r.id in pickset for r in q) for q in quarters), "every quarter of the timeline is represented")
            share = sum(r.portrait for r in picked) / len(picked)
            check(0.15 <= share <= 0.55, f"portrait share {share:.0%} (album {sum(r.portrait for r in order) / n:.0%})")
            worst = max(float(np.dot(a.clip, b.clip)) for i, a in enumerate(picked) for b in picked[i + 1:])
            check(worst <= sg.CONFIG.pick_sim_cap, f"no two picks closer than {sg.CONFIG.pick_sim_cap} (max {worst:.2f})")

            print("manual picks stick")
            outside = next(f for f in recs if f not in smart["highlights"] and not recs[f].in_review)
            gone = smart["highlights"][0]
            r = c.post(f"/api/album/{SLUG}/smart/highlights", headers=A, json={"add": [outside], "remove": [gone]})
            check(r.status_code == 200, "adjust highlights ok")
            hl = r.json()["highlights"]
            check(outside in hl and gone not in hl, "added photo is in, removed photo is out")
            rescore = {"faces": [], "photo": dict(
                aesthetic=5.0, clip=unit(rng.normal(size=768)).tolist(), sharpness=1500.0,
                exposure=dict(clipped_highlights=0, clipped_shadows=0, mean=0.5))}
            fr._embed_image = lambda bucket, key: rescore
            fr.detect_and_store_faces(f"{SLUG}/x.jpg", ids[0], album_id, "test")
            sg.select_album(album_id)
            hl2 = c.get(f"/api/album/{SLUG}/smart", headers=A).json()
            check(outside in hl2["highlights"] and gone not in hl2["highlights"], "still there after a fresh re-selection and a re-score")
            check(outside in hl2["manual"]["add"] and gone in hl2["manual"]["remove"], "manual picks listed")

            print("stack best swap")
            st = smart["stacks"][0]
            other = next(m for m in st["members"] if m != st["best"])
            r = c.post(f"/api/album/{SLUG}/smart/stacks/best", headers=A, json={"filename": other}).json()
            check(next(x for x in r["stacks"] if x["id"] == st["id"])["best"] == other, "pinned best wins the stack")

            print("publish visibility")
            def album_json(headers):
                return c.get(f"/api/album/{SLUG}/", headers=headers).json()
            check(album_json(C)["highlights"] is None, "client gets no highlights before publish")
            check(isinstance(album_json(A)["highlights"], list) and album_json(A)["highlights"], "admin always gets highlights")
            r = c.post(f"/api/album/{SLUG}/smart/publish", headers=A, json={"published": True})
            check(r.json()["published"] is True, "published")
            cj = album_json(C)
            check(cj["highlights"] == album_json(A)["highlights"] and len(cj["highlights"]) > 0, "client sees the same highlights once published")
            check(c.post(f"/api/album/{SLUG}/smart/publish", headers=C, json={"published": False}).status_code == 403, "clients can't publish")
            c.post(f"/api/album/{SLUG}/smart/publish", headers=A, json={"published": False})
            check(album_json(C)["highlights"] is None, "unpublishing hides them again")

            print("hide / keep")
            victim = smart["review"]["blurry"][0]["filename"]
            c.post(f"/api/album/{SLUG}/smart/review", headers=A, json={"hide": [victim]})
            names = lambda j: {p["file_metadata"]["filename"] for p in j["album_photos"]}
            check(victim not in names(album_json(C)), "hidden photo is gone from the client gallery")
            check(victim in names(album_json(A)), "admin still sees it")
            c.post(f"/api/album/{SLUG}/smart/review", headers=A, json={"keep": [victim]})
            check(victim in names(album_json(C)), "keep brings it back")
            kept = c.get(f"/api/album/{SLUG}/smart", headers=A).json()
            check(victim in kept["kept"] and all(f["filename"] != victim for g in kept["review"].values() for f in g), "kept photo leaves the review pile")

            print("auto publish on delivery")
            with session_scope() as s:
                album = s.get(Album, album_id)
                album.smart_touched, album.smart_published = True, False
                sg.auto_publish_on_delivery(s, album)
                check(album.smart_published is False, "studio already chose: delivery leaves it alone")
                album.smart_touched = False
                sg.auto_publish_on_delivery(s, album)
                check(album.smart_published is True and album.smart_touched is False, "untouched: delivery publishes")
    finally:
        cleanup(album_id, user_ids, person_ids)

    print()
    if failures:
        print(f"{len(failures)} FAILED")
        sys.exit(1)
    print("all passed")


if __name__ == "__main__":
    main()
