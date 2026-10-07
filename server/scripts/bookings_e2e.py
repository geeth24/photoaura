"""End-to-end check of bookings, e-signature, payments and proof mode.

Runs the real app in-process against a LOCAL Postgres and a throwaway S3
prefix, captures emails instead of sending them, and deletes everything it
put in S3 when it's done.

    cd server
    pip install "httpx<0.28"   # TestClient needs it
    POSTGRES_HOST=localhost POSTGRES_PORT=55432 POSTGRES_PASSWORD=... \\
    AWS_BUCKET=photoaura-dev AWS_REGION=us-east-1 DATA_DIR=/tmp/aura-e2e \\
    python -m scripts.bookings_e2e
"""

import io
import os
import sys
import time
import uuid
from datetime import datetime

if os.environ.get("POSTGRES_HOST", "localhost") not in ("localhost", "127.0.0.1"):
    sys.exit("refusing to run: POSTGRES_HOST must be a local database")
if not os.environ.get("AWS_BUCKET"):
    sys.exit("set AWS_BUCKET (objects only go under a random zz-booking-test-* prefix)")
os.environ["RESEND_API_KEY"] = ""
os.environ.setdefault("DATA_DIR", "/tmp/aura-e2e")
os.environ.setdefault("NEXT_PUBLIC_CLIENT_URL", "http://localhost:3000")

from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

from config import settings  # noqa: E402
from db.base import session_scope  # noqa: E402
from db.migrate import run_migrations  # noqa: E402
from db.models import Album, Booking, FileMetadata, User, UserEmail  # noqa: E402
from routers.auth.auth_router import create_token  # noqa: E402
from routers.bookings.bookings_router import _invoice as invoice_data  # noqa: E402
from services import email_service  # noqa: E402
from services.aws_service import s3_client  # noqa: E402
from services.booking_service import local_date  # noqa: E402

BUCKET = settings.AWS_BUCKET
RUN = uuid.uuid4().hex[:8]
ALBUM_NAME = f"zz-booking-test-{RUN}"
SLUG = ALBUM_NAME
LOCKED = "Downloads unlock once your final payment is received."

rendered, sent = [], []


def _fake_render(template, props):
    rendered.append((template, props))
    return {"subject": f"[{template}]", "html": "<p>test</p>"}


def _fake_send(to, subject, html, attachments=None):
    sent.append({"to": to, "subject": subject, "attachments": attachments or []})
    return True


email_service._render = _fake_render
email_service._send = _fake_send

failures = []


def check(cond, msg):
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        failures.append(msg)


def emails(template):
    return [p for t, p in rendered if t == template]


def jpeg(color, size=(1200, 800), orientation=None) -> bytes:
    img = Image.new("RGB", size, color)
    buf = io.BytesIO()
    if orientation:
        exif = Image.Exif()
        exif[0x0112] = orientation
        img.save(buf, format="JPEG", exif=exif.tobytes())
    else:
        img.save(buf, format="JPEG")
    return buf.getvalue()


def keys(prefix):
    out = []
    for page in s3_client.get_paginator("list_objects_v2").paginate(Bucket=BUCKET, Prefix=prefix):
        out += [o["Key"] for o in page.get("Contents", [])]
    return out


def seed_users():
    with session_scope() as s:
        def user(name, email, role, parent=None):
            u = s.query(User).filter_by(user_name=f"{name}-{RUN}").first()
            if not u:
                u = User(user_name=f"{name}-{RUN}", full_name=name.title(), user_email=email, role=role,
                         parent_user_id=parent)
                s.add(u)
                s.flush()
                s.add(UserEmail(user_id=u.id, email=email, is_primary=True))
            return u

        admin = user("admin", f"admin-{RUN}@example.test", "admin")
        client = user("existing client", f"client-{RUN}@example.test", "client")
        family = user("family", f"family-{RUN}@example.test", "client", parent=client.id)
        s.flush()
        return [create_token(u, 60 * 24)["access_token"] for u in (admin, client, family)] + [client.id]


def wait_job(c, auth):
    for _ in range(120):
        r = c.get(f"/api/upload-status/{SLUG}", headers=auth).json()
        if r.get("finished"):
            return r
        time.sleep(0.25)
    return r


def main():
    run_migrations()
    admin_tok, client_tok, family_tok, client_id = seed_users()
    A = {"Authorization": f"Bearer {admin_tok}"}
    C = {"Authorization": f"Bearer {client_tok}"}
    F = {"Authorization": f"Bearer {family_tok}"}
    contract_keys = []

    with TestClient(__import__("main").app) as c:
        try:
            print("packages + preview")
            pk = c.get("/api/booking-packages", headers=A).json()
            check(len(pk) == 11 and pk[0]["key"] == "event-photo" and pk[0]["rate_cents"] == 15000, "11 packages")
            check(c.get("/api/booking-packages", headers=C).status_code == 403, "packages are admin-only")
            body = {
                "client": {"full_name": "Priya Sharma", "email": f"priya-{RUN}@example.test"},
                "client_phone": "+1 (555) 010-0100",
                "event_type": "Wedding",
                "event_date": "2026-11-14",
                "start_time": "17:00",
                "end_time": "21:30",
                "location": "Hilton Anatole, Dallas",
                "package_key": "event-photo",
                "hours": 4.5,
                "details_for_client": "Ceremony 5 PM, reception 7 PM",
                "notes_internal": "met at expo",
            }
            pv = c.post("/api/bookings/preview", json=body, headers=A).json()
            check(pv["amounts"] == {"total_fee": 67500, "total_due": 67500, "retainer": 6750,
                                    "event_day": 27000, "final": 33750}, f"preview amounts {pv['amounts']}")
            md = pv["contract_markdown"]
            check("Saturday, November 14, 2026" in md and "5:00 PM – 9:30 PM" in md, "dates and times formatted")
            check("Event Photography — Photos Only (4.5 hours at $150/hr)" in md, "package line")
            check("$675.00" in md and "$67.50" in md and "($150.00/hour)" in md, "money formatted")
            check("{{" not in md and "videography" not in md.lower(), "no placeholders, photo-only wording")
            short = c.post("/api/bookings/preview", json={**body, "hours": 2}, headers=A)
            check(short.status_code == 400, "hourly minimum enforced")
            with session_scope() as s:
                check(s.query(User).filter_by(user_email=f"priya-{RUN}@example.test").first() is None,
                      "preview wrote nothing")
            vid = c.post("/api/bookings/preview", json={**body, "package_key": "event-photo-video"}, headers=A).json()
            check("VIDEOGRAPHY" in vid["contract_markdown"] and "highlight video" in vid["contract_markdown"],
                  "video sections render")

            print("create + send (new client)")
            r = c.post("/api/bookings", json=body, headers=A)
            check(r.status_code == 200, f"create {r.status_code} {r.text[:200]}")
            bk = r.json()
            num = bk["number"]
            check(num.startswith("RS-") and bk["status"] == "draft", f"number {num}, draft")
            check([p["amount_cents"] for p in bk["payments"]] == [6750, 27000, 33750], "10/40/50 schedule")
            check(bk["money"] == {"total_fee": 67500, "extras": 0, "total_due": 67500, "paid": 0, "balance": 67500},
                  "money block")
            new_client_id = bk["client"]["user_id"]
            check(bk["client"]["email"] == f"priya-{RUN}@example.test", "new client user created")
            check(c.get(f"/api/me/bookings/{num}", headers=C).status_code == 404, "other clients can't see it")
            check(c.get(f"/api/bookings/{num}/invoice.pdf", headers=A).status_code == 409, "no invoice for a draft")

            rendered.clear()
            r = c.post(f"/api/bookings/{num}/send", headers=A).json()
            check(r["status"] == "sent" and r["contract"]["hash"] and r["email_sent"], "sent")
            inv = emails("booking-invite")
            check(len(inv) == 1 and inv[0]["bookingNumber"] == num and inv[0]["retainer"] == "$67.50"
                  and inv[0]["totalDue"] == "$675.00" and f"/bookings/{num}" in inv[0]["link"].replace("%2F", "/"),
                  f"booking-invite props {inv}")
            first_hash = r["contract"]["hash"]

            # the client signs in through the invite link
            token = inv[0]["link"].split("token=")[1].split("&")[0]
            P = {"Authorization": "Bearer " + c.post("/api/auth/verify-link", json={"token": token}).json()["access_token"]}

            print("client view + edits while sent")
            me = c.get("/api/me/bookings", headers=P).json()
            check(len(me) == 1 and me[0]["action"] == "sign", "client list shows sign action")
            cb = c.get(f"/api/me/bookings/{num}", headers=P).json()
            check("notes_internal" not in cb and "signed_ip" not in cb["contract"], "client shape hides internals")
            check(cb["contract"]["markdown"].startswith("# PHOTOGRAPHY"), "client gets the contract snapshot")
            check(cb["payment_instructions"]["memo"] == f"{num} retainer", "memo names the retainer")

            print("invoice")
            filename = f'attachment; filename="Reactive Shots Studios Invoice INV-{num}.pdf"'
            got = c.get(f"/api/me/bookings/{num}/invoice.pdf", headers=P)
            check(got.status_code == 200 and got.content[:4] == b"%PDF"
                  and got.headers["content-disposition"] == filename, "client downloads the invoice")
            adm = c.get(f"/api/bookings/{num}/invoice.pdf", headers=A)
            check(adm.status_code == 200 and adm.content[:4] == b"%PDF"
                  and adm.headers["content-disposition"] == filename, "admin downloads the invoice")
            check(c.get(f"/api/me/bookings/{num}/invoice.pdf", headers=C).status_code == 404, "stranger gets 404")
            check(c.get(f"/api/me/bookings/{num}/invoice.pdf", headers=F).status_code == 404,
                  "unrelated family gets 404")
            check(c.get(f"/api/bookings/{num}/invoice.pdf", headers=P).status_code == 403,
                  "admin invoice route is admin-only")
            check(c.get(f"/api/bookings/{num}/invoice.pdf", headers=C).status_code == 403, "stranger gets 403")
            mine = c.get("/api/me/invoices", headers=P).json()
            check(len(mine) == 1 and mine[0]["invoice_number"] == f"INV-{num}" and mine[0]["booking_number"] == num
                  and mine[0]["total_cents"] == 67500 and mine[0]["paid_cents"] == 0
                  and mine[0]["balance_cents"] == 67500 and mine[0]["status"] == "open", f"/api/me/invoices {mine}")
            check(all(x["booking_number"] != num for x in c.get("/api/me/invoices", headers=C).json()),
                  "other clients' invoices aren't listed")
            with session_scope() as s:
                b = s.query(Booking).filter_by(number=num).first()
                data = invoice_data(s, b)
                check(data["number"] == f"INV-{num}" and data["issued"] == local_date(b.sent_at), "invoice number + date")
            check(data["lines"] == [{"description": "Event Photography — Photos Only", "qty": "4.5 hours",
                                     "rate_cents": 15000, "amount_cents": 67500}], f"package line {data['lines']}")
            check([x["state"] for x in data["schedule"]] == ["upcoming"] * 3, "nothing due before signing")

            r = c.patch(f"/api/bookings/{num}", json={"hours": 5}, headers=A).json()
            check(r["money"]["total_fee"] == 75000 and r["contract"]["hash"] != first_hash, "edit re-renders contract")
            r = c.post(f"/api/me/bookings/{num}/sign",
                       json={"full_name": "Priya Sharma", "consent": True, "contract_hash": first_hash}, headers=P)
            check(r.status_code == 409, "stale hash -> 409")
            cur = c.get(f"/api/me/bookings/{num}", headers=P).json()["contract"]["hash"]
            r = c.post(f"/api/me/bookings/{num}/sign",
                       json={"full_name": "Priya Sharma", "consent": False, "contract_hash": cur}, headers=P)
            check(r.status_code == 400, "no consent -> 400")
            r = c.post(f"/api/me/bookings/{num}/sign",
                       json={"full_name": "   ", "consent": True, "contract_hash": cur}, headers=P)
            check(r.status_code == 400, "empty name -> 400")
            check(c.get(f"/api/bookings/{num}/contract.pdf", headers=P).status_code == 404, "no PDF before signing")
            pr = c.get(f"/api/bookings/{num}/contract.pdf?preview=1", headers=A)
            check(pr.status_code == 200 and pr.content[:4] == b"%PDF", "admin preview PDF")

            print("sign")
            rendered.clear()
            sent.clear()
            r = c.post(f"/api/me/bookings/{num}/sign",
                       json={"full_name": "Priya  Sharma", "consent": True, "contract_hash": cur},
                       headers={**P, "X-Forwarded-For": "203.0.113.9, 10.0.0.1", "User-Agent": "e2e-agent/1.0"})
            check(r.status_code == 200 and r.json()["status"] == "signed", f"signed {r.status_code}")
            ab = c.get(f"/api/bookings/{num}", headers=A).json()
            check(ab["contract"]["signed_ip"] == "203.0.113.9" and ab["contract"]["signed_name"] == "Priya Sharma",
                  "IP is the first forwarded hop, name normalised")
            check(ab["payments"][0]["state"] == "due" and ab["payments"][2]["state"] == "upcoming", "retainer due")
            with session_scope() as s:
                b = s.query(Booking).filter_by(number=num).first()
                contract_keys.append(b.pdf_key)
                check(b.signed_user_agent == "e2e-agent/1.0" and b.signed_hash == cur and b.pdf_key, "audit stored")
            signed_mail = emails("booking-signed")
            check(len(signed_mail) == 2 and signed_mail[0]["memo"] == f"{num} retainer"
                  and signed_mail[0]["retainer"] == "$75.00", "booking-signed to client + studio")
            check(all(a["attachments"] and a["attachments"][0]["content"][:4] == b"%PDF" for a in sent),
                  "signed PDF attached")
            pdf = c.get(f"/api/bookings/{num}/contract.pdf", headers=P)
            check(pdf.status_code == 200 and pdf.content[:4] == b"%PDF", "client downloads signed PDF")
            check(c.get(f"/api/bookings/{num}/contract.pdf", headers=C).status_code == 404, "stranger can't")
            r = c.patch(f"/api/bookings/{num}", json={"hours": 6}, headers=A)
            check(r.status_code == 409, "terms locked after signing")
            r = c.patch(f"/api/bookings/{num}", json={"notes_internal": "vip"}, headers=A)
            check(r.status_code == 200, "internal notes still editable")

            print("payments")
            pay = {p["kind"]: p["id"] for p in ab["payments"]}
            rendered.clear()
            r = c.post(f"/api/bookings/{num}/payments/{pay['retainer']}/receive",
                       json={"amount_cents": 7500, "method": "zelle", "note": "conf 123"}, headers=A).json()
            check(r["status"] == "booked", "retainer -> booked")
            rc = emails("payment-received")
            check(len(rc) == 1 and rc[0]["amount"] == "$75.00" and rc[0]["method"] == "Zelle"
                  and rc[0]["balance"] == "$675.00" and rc[0]["nextLabel"] == "Event-day payment", f"receipt {rc}")
            r = c.post(f"/api/bookings/{num}/payments/{pay['retainer']}/undo", headers=A).json()
            check(r["status"] == "signed" and r["money"]["paid"] == 0, "undo moves status back")
            r = c.post(f"/api/bookings/{num}/payments/{pay['retainer']}/receive",
                       json={"amount_cents": 7500, "method": "cash", "received_at": "2026-10-07"}, headers=A).json()
            check(r["status"] == "booked" and r["payments"][0]["received_at"] == "2026-10-07T00:00:00Z",
                  "receipt with a plain date")
            c.post(f"/api/bookings/{num}/payments/{pay['retainer']}/undo", headers=A)
            r = c.post(f"/api/bookings/{num}/payments/{pay['retainer']}/receive",
                       json={"amount_cents": 5000, "method": "cash"}, headers=A).json()
            check(r["status"] == "signed", "partial retainer isn't booked yet")
            rendered.clear()
            r = c.post(f"/api/bookings/{num}/payments/{pay['retainer']}/receive",
                       json={"amount_cents": 2500, "method": "zelle"}, headers=A).json()
            check(r["status"] == "booked" and r["payments"][0]["received_cents"] == 7500
                  and emails("payment-received")[0]["amount"] == "$25.00", "second partial adds up")
            with session_scope() as s:
                rows = invoice_data(s, s.query(Booking).filter_by(number=num).first())["received"]
            check([(x["method"], x["amount_cents"]) for x in rows] == [("Cash", 5000), ("Zelle", 2500)],
                  f"each part is its own invoice row {rows}")
            r = c.post(f"/api/bookings/{num}/payments/{pay['event_day']}/receive",
                       json={"amount_cents": 30000, "method": "check"}, headers=A).json()
            check(r["status"] == "event_complete", "event day -> event_complete")
            r = c.post(f"/api/bookings/{num}/payments", json={"label": "Overtime (30 min)", "amount_cents": 7500},
                       headers=A).json()
            check(r["money"]["extras"] == 7500 and r["money"]["total_due"] == 82500, "overtime extra")
            check(r["next_payment"]["amount_cents"] == 37500 + 7500, "final + extras reported together")
            fam = c.get("/api/me/bookings", headers=F).json()
            check(any(x["number"] == num for x in fam) is False, "unrelated family can't see it")
            mine = c.get("/api/me/invoices", headers=P).json()[0]
            check(mine["total_cents"] == 82500 and mine["paid_cents"] == 37500 and mine["balance_cents"] == 45000
                  and mine["status"] == "open", f"invoice after event day + overtime {mine}")
            with session_scope() as s:
                data = invoice_data(s, s.query(Booking).filter_by(number=num).first())
            lines = [x["description"] for x in data["lines"]]
            check(lines == ["Event Photography — Photos Only", "Overtime (30 min)"]
                  and data["lines"][0]["qty"] == "5 hours" and data["total_cents"] == 82500, "extra charge line")
            check([(x["description"], x["method"], x["amount_cents"]) for x in data["received"]]
                  == [("Booking retainer", "Cash", 5000), ("Booking retainer", "Zelle", 2500),
                      ("Event-day payment", "Check", 30000)], "payments received")
            check([x["label"] for x in data["schedule"]] == ["Final payment · 50%", "Overtime (30 min)"]
                  and data["memo"] == f"{num} final", "remaining schedule + memo")

            print("album + proof mode")
            check(str(local_date(datetime(2026, 10, 7, 1, 3))) == "2026-10-06", "an 8 PM Dallas signature is dated that day")
            from types import SimpleNamespace as NS
            from utils.utils import create_album_photos_json
            blank = dict.fromkeys(["size", "width", "height", "upload_date", "exif_data", "blur_data_url",
                                   "orientation", "description", "tags"])
            pending = [NS(**blank, id=1, album_id=1, filename="a.jpg", content_type="image/jpeg", held=False),
                       NS(**blank, id=2, album_id=1, filename="b-proof.jpg", content_type="image/jpeg", held=True)]
            got = [p["file_metadata"]["filename"] for p in create_album_photos_json("x", pending, True)]
            check(got == ["b-proof.jpg"], f"clean photos hidden until their proof is ready {got}")
            files = [
                ("files", ("IMG_0001.jpg", jpeg((200, 30, 30)), "image/jpeg")),
                ("files", ("IMG_0002.jpg", jpeg((30, 200, 30), (800, 1200)), "image/jpeg")),
                ("files", ("IMG_0003.jpg", jpeg((30, 30, 200), orientation=6), "image/jpeg")),
            ]
            r = c.post(f"/api/upload-files/?album_name={ALBUM_NAME}&face_detection=false", files=files, headers=A)
            check(r.status_code == 200, f"upload {r.status_code}")
            wait_job(c, A)
            with session_scope() as s:
                album_id = s.query(Album).filter_by(slug=SLUG).first().id
            r = c.post(f"/api/bookings/{num}/album", json={"album_id": album_id}, headers=A).json()
            check(r["album"]["locked"] and r["processing"], "album linked and locking")
            wait_job(c, A)
            with session_scope() as s:
                album = s.query(Album).filter_by(slug=SLUG).first()
                token = album.hold_token
                photos = s.query(FileMetadata).filter_by(album_id=album_id).all()
                check(all(p.held and p.filename.endswith("-proof.jpg") for p in photos), "rows point at proofs")
            k = set(keys(f"{SLUG}/"))
            check(f"{SLUG}/IMG_0001.jpg" not in k and f"{SLUG}/IMG_0001-proof.jpg" in k, "clean original removed")
            check(f"{SLUG}/_hold/{token}/IMG_0001.jpg" in k, "original held")
            proof = Image.open(io.BytesIO(s3_client.get_object(Bucket=BUCKET, Key=f"{SLUG}/IMG_0003-proof.jpg")["Body"].read()))
            check(proof.format == "JPEG" and proof.size == (800, 1200), f"proof orientation applied {proof.size}")

            album_json = c.get(f"/api/album/{SLUG}/", headers=P).json()
            check(album_json["locked"] and album_json["booking_number"] == num, "album JSON locked + booking")
            check("hold_token" not in str(album_json) and token not in str(album_json), "hold token never exposed")
            check(all(p["file_metadata"]["filename"].endswith("-proof.jpg") and p["locked"]
                      for p in album_json["album_photos"]), "photos are proofs")
            home = c.get("/api/me/home", headers=P).json()
            check(any(a["slug"] == SLUG and a["locked"] for a in home["albums"]), "/api/me/home locked")
            photos_json = c.get(f"/api/photos/?user_id={new_client_id}", headers=P).json()
            check(photos_json and all(p["locked"] for p in photos_json), "/api/photos/ locked")
            albums_json = c.get(f"/api/albums/?user_id={new_client_id}", headers=P).json()
            check(any(a["slug"] == SLUG and a["locked"] for a in albums_json), "/api/albums/ locked")
            for path, method in (
                (f"/api/album/{SLUG}/download-ticket", "post"),
                (f"/api/album/{SLUG}/download/IMG_0001-proof.jpg", "get"),
                (f"/api/album/{SLUG}/download-all?secret={album_json['secret']}", "get"),
            ):
                rr = getattr(c, method)(path, headers=P)
                check(rr.status_code == 403 and rr.json()["detail"] == LOCKED, f"{path.split('?')[0]} refused")
            check(c.get(f"/api/album/{SLUG}/view?secret={album_json['secret']}").json()["locked"], "share view locked")

            r = c.post(f"/api/upload-files/?album_name={ALBUM_NAME}&face_detection=false",
                       files=[("files", ("IMG_0004.jpg", jpeg((90, 90, 90)), "image/jpeg"))], headers=A)
            wait_job(c, A)
            with session_scope() as s:
                m = s.query(FileMetadata).filter_by(album_id=album_id, original_filename="IMG_0004.jpg").first()
                check(m is not None and m.held and m.filename == "IMG_0004-proof.jpg", "new upload stored held")

            r = c.post(f"/api/album/{SLUG}/revisions", data={"notify": "false"},
                       files=[("files", ("IMG_0001.jpg", jpeg((250, 250, 0)), "image/jpeg"))], headers=A)
            check(r.status_code == 200, f"revision {r.status_code} {r.text[:200]}")
            wait_job(c, A)
            k = set(keys(f"{SLUG}/"))
            with session_scope() as s:
                m = s.query(FileMetadata).filter_by(album_id=album_id, base_name="img_0001").first()
                check(m.held and m.original_filename == "IMG_0001_v2.jpg" and m.filename == "IMG_0001_v2-proof.jpg",
                      f"revision held ({m.original_filename}, {m.filename})")
            check(f"{SLUG}/_hold/{token}/IMG_0001_v2.jpg" in k and f"{SLUG}/IMG_0001-proof.jpg" not in k
                  and f"{SLUG}/IMG_0001_v2.jpg" not in k, "revision proof regenerated, old proof gone")
            photo_id = album_json["album_photos"][0]["file_metadata"]["id"]
            check(c.get(f"/api/photo/{photo_id}/versions", headers=P).json() == [], "no clean versions while locked")

            print("delivered + final -> unlock")
            rendered.clear()
            r = c.post(f"/api/bookings/{num}/delivered", headers=A).json()
            check(r["status"] == "delivered" and r["delivered_at"], "delivered")
            dl = emails("gallery-delivered")
            check(len(dl) == 1 and dl[0]["finalAmount"] == "$450.00" and dl[0]["memo"] == f"{num} final"
                  and dl[0]["albumName"] == ALBUM_NAME, f"gallery-delivered {dl}")
            check(c.get("/api/me/bookings", headers=P).json()[0]["action"] == "pay", "client action pay")
            pay = {p["kind"]: p["id"] for p in r["payments"] if p["kind"] != "extra"}
            extra_id = [p["id"] for p in r["payments"] if p["kind"] == "extra"][0]
            r = c.post(f"/api/bookings/{num}/payments", json={"label": "Added by mistake", "amount_cents": 1000},
                       headers=A).json()
            mistake_id = [p["id"] for p in r["payments"] if p["label"] == "Added by mistake"][0]
            rendered.clear()
            r = c.post(f"/api/bookings/{num}/payments/{pay['final']}/receive",
                       json={"amount_cents": 37500, "method": "zelle"}, headers=A).json()
            check(r["status"] == "delivered", "final without the overtime isn't paid in full")
            r = c.post(f"/api/bookings/{num}/payments/{extra_id}/receive",
                       json={"amount_cents": 7500, "method": "zelle"}, headers=A).json()
            check(r["status"] == "delivered", "an unpaid extra keeps it open")
            r = c.delete(f"/api/bookings/{num}/payments/{mistake_id}", headers=A).json()
            check(r["status"] == "paid" and r["money"]["balance"] == 0, "paid once the stray charge is removed")
            mine = c.get("/api/me/invoices", headers=P).json()[0]
            check(mine["status"] == "paid" and mine["balance_cents"] == 0 and mine["paid_cents"] == 82500,
                  "invoice paid in full")
            with session_scope() as s:
                data = invoice_data(s, s.query(Booking).filter_by(number=num).first())
            check(data["schedule"] == [] and data["paid_on"] is not None, "nothing left on the schedule")
            check(c.get(f"/api/me/bookings/{num}/invoice.pdf", headers=P).content[:4] == b"%PDF", "paid invoice PDF")
            wait_job(c, A)
            k = set(keys(f"{SLUG}/"))
            with session_scope() as s:
                photos = s.query(FileMetadata).filter_by(album_id=album_id).all()
                album = s.query(Album).filter_by(slug=SLUG).first()
                check(not album.proof_locked, "album unlocked")
                check(sorted(p.filename for p in photos) == ["IMG_0001_v2.jpg", "IMG_0002.jpg", "IMG_0003.jpg", "IMG_0004.jpg"]
                      and not any(p.held for p in photos), "filenames restored")
                b = s.query(Booking).filter_by(number=num).first()
                check(b.unlocked_at is not None, "unlocked_at set")
            check(not any(x.endswith("-proof.jpg") for x in k) and not any("/_hold/" in x for x in k),
                  "proofs and hold copies removed")
            check(f"{SLUG}/IMG_0001.jpg" in k and f"{SLUG}/IMG_0001_v2.jpg" in k, "every version restored")
            ul = emails("gallery-unlocked")
            check(len(ul) == 1 and ul[0]["albumName"] == ALBUM_NAME, "gallery-unlocked email")
            check(len(emails("payment-received")) == 2, "receipts for final + overtime")
            check(c.post(f"/api/album/{SLUG}/download-ticket", headers=P).status_code == 200, "downloads open")
            check(c.get(f"/api/album/{SLUG}/", headers=P).json()["locked"] is False, "album JSON unlocked")
            r = c.post(f"/api/bookings/{num}/unlock", headers=A)
            check(r.status_code == 200, "unlock is idempotent")

            print("cancel")
            r = c.post("/api/bookings", json={**body, "client_user_id": client_id, "client": None,
                                              "package_key": "custom", "total_fee_cents": 12345}, headers=A).json()
            check(r["payments"][0]["amount_cents"] == 1235 and r["payments"][2]["amount_cents"] == 6172, "custom fee")
            other = r["number"]
            c.post(f"/api/bookings/{other}/send", headers=A)
            ob = c.get(f"/api/me/bookings/{other}", headers=C).json()
            c.post(f"/api/me/bookings/{other}/sign", headers=C,
                   json={"full_name": "Test Client", "consent": True, "contract_hash": ob["contract"]["hash"]})
            ofinal = [p["id"] for p in c.get(f"/api/bookings/{other}", headers=A).json()["payments"] if p["kind"] == "final"][0]
            r = c.post(f"/api/bookings/{other}/payments/{ofinal}/receive",
                       json={"amount_cents": 6172, "method": "cash"}, headers=A).json()
            check(r["status"] == "signed", f"final alone isn't paid in full ({r['status']})")
            got = c.get(f"/api/me/bookings/{other}/invoice.pdf", headers=F)
            check(got.status_code == 200 and got.content[:4] == b"%PDF", "family member downloads the invoice")
            check(any(x["booking_number"] == other for x in c.get("/api/me/invoices", headers=F).json()),
                  "family member's invoice list")
            check(c.get(f"/api/me/bookings/{other}/invoice.pdf", headers=P).status_code == 404,
                  "another client gets 404")
            r = c.post(f"/api/bookings/{other}/cancel", json={"reason": "date moved"}, headers=A).json()
            mine = next(x for x in c.get("/api/me/invoices", headers=C).json() if x["booking_number"] == other)
            check(mine["status"] == "cancelled" and mine["balance_cents"] == 0, "cancelled invoice owes nothing")
            check(c.get(f"/api/bookings/{other}/invoice.pdf", headers=A).status_code == 200, "cancelled invoice PDF")
            check(r["status"] == "cancelled" and r["cancel_reason"] == "date moved", "cancelled")
            lst = c.get("/api/bookings?status=cancelled", headers=A).json()
            check(any(x["number"] == r["number"] for x in lst), "status filter")
        finally:
            print("cleanup")
            c.delete(f"/api/album/delete/{SLUG}/", headers=A)
            leftover = keys(f"{SLUG}/")
            for key in leftover + [k for k in contract_keys if k]:
                s3_client.delete_object(Bucket=BUCKET, Key=key)
            with session_scope() as s:
                for b in s.query(Booking).filter(Booking.pdf_key.isnot(None)).all():
                    if b.pdf_key not in contract_keys:
                        s3_client.delete_object(Bucket=BUCKET, Key=b.pdf_key)
            check(keys(f"{SLUG}/") == [], "S3 prefix empty")

    print(f"\n{len(failures)} failures" if failures else "\nall checks passed")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
