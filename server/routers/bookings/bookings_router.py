"""Bookings: contract, e-signature, cash/Zelle payment tracking and the
proof-mode gallery that unlocks with the final payment."""

import os
import re
import secrets
from datetime import date, datetime, timezone
from typing import Optional, Union
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import Integer, cast, func
from sqlalchemy.orm import Session

from config import settings
from db.base import get_session, session_scope
from db.models import Album, Booking, BookingPayment, FileMetadata, User, UserAlbumPermission, UserEmail
from dependencies import get_current_user, require_admin
from routers.auth.auth_router import CLIENT_URL, issue_magic_link
from routers.user.user import _primary_email, _verify_link
from services import email_service, proof_service, upload_jobs
from services.aws_service import s3_client
from services.booking_service import (
    BOOKING_PACKAGES,
    CONSENT_TEXT,
    MEMO_WORDS,
    METHODS,
    PACKAGES_BY_KEY,
    PAYMENT_METHODS,
    SCHEDULE,
    ZELLE,
    contract_fields,
    contract_hash,
    dollars,
    hours_text,
    long_date,
    render_contract,
    schedule_amounts,
    today_local,
)
from services.contract_pdf import render_pdf
from services.invoice_pdf import day, render_invoice
from utils.utils import slugify

router = APIRouter()
AWS_BUCKET = settings.AWS_BUCKET
STUDIO_EMAIL = os.environ.get("BOOKING_STUDIO_EMAIL", "geeth@reactiveshots.com")

KIND_ORDER = {"retainer": 0, "event_day": 1, "final": 2, "extra": 3}
CONTRACT_FIELDS = {
    "client_user_id", "client", "client_phone", "event_type", "event_date", "start_time",
    "end_time", "location", "package_key", "package_name", "hours", "total_fee_cents",
    "includes_video", "hourly_rate_cents", "revisions",
}
_HHMM = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def _now() -> datetime:
    return datetime.utcnow()


def _iso(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat(timespec="seconds") + "Z" if dt else None


# ---- request bodies ----

class ClientIn(BaseModel):
    full_name: str
    email: str


class BookingIn(BaseModel):
    client_user_id: Optional[int] = None
    client: Optional[ClientIn] = None
    client_phone: Optional[str] = None
    event_type: Optional[str] = None
    event_date: Optional[date] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    location: Optional[str] = None
    package_key: Optional[str] = None
    package_name: Optional[str] = None  # custom packages only
    hours: Optional[float] = None
    total_fee_cents: Optional[int] = None
    includes_video: Optional[bool] = None
    hourly_rate_cents: Optional[int] = None
    revisions: Optional[int] = None
    details_for_client: Optional[str] = None
    notes_internal: Optional[str] = None


class PreviewIn(BookingIn):
    number: Optional[str] = None


class ReceiveIn(BaseModel):
    amount_cents: int
    method: str
    received_at: Optional[Union[datetime, date]] = None  # a plain date is fine
    note: Optional[str] = None


class ExtraIn(BaseModel):
    label: str
    amount_cents: int


class AlbumLinkIn(BaseModel):
    album_id: Optional[int] = None
    create: bool = False


class CancelIn(BaseModel):
    reason: Optional[str] = None


class UnlockIn(BaseModel):
    notify: bool = False


class SignIn(BaseModel):
    full_name: str
    consent: bool = False
    contract_hash: str


# ---- money + status ----

def _paid(p: BookingPayment) -> bool:
    return p.amount_cents <= 0 or (p.received_cents or 0) >= p.amount_cents


def _receipts(p: BookingPayment) -> list:
    """Each part received on a line; rows from before receipts read as one."""
    if p.receipts:
        return list(p.receipts)
    if not p.received_cents:
        return []
    return [{
        "amount_cents": p.received_cents,
        "method": p.method,
        "received_at": p.received_at.isoformat() if p.received_at else None,
        "note": p.note,
    }]


def _payments(b: Booking) -> list:
    return sorted(b.payments, key=lambda p: (KIND_ORDER.get(p.kind, 9), p.id or 0))


def _state(b: Booking, p: BookingPayment) -> str:
    if _paid(p):
        return "paid"
    if p.kind == "retainer" and b.signed_at:
        return "due"
    if p.kind == "event_day" and b.event_date and b.event_date <= today_local():
        return "due"
    if p.kind in ("final", "extra") and b.delivered_at:
        return "due"
    return "upcoming"


def _derive_status(b: Booking) -> str:
    if b.cancelled_at:
        return "cancelled"
    if not b.sent_at:
        return "draft"
    if not b.signed_at:
        return "sent"
    by_kind = {p.kind: p for p in b.payments if p.kind != "extra"}
    if any(p.kind == "final" for p in b.payments) and all(_paid(p) for p in b.payments):
        return "paid"
    if b.delivered_at:
        return "delivered"
    if by_kind.get("event_day") and _paid(by_kind["event_day"]):
        return "event_complete"
    if by_kind.get("retainer") and _paid(by_kind["retainer"]):
        return "booked"
    return "signed"


def _refresh_status(b: Booking) -> str:
    b.status = _derive_status(b)
    b.updated_at = _now()
    return b.status


def _money(b: Booking) -> dict:
    extras = sum(p.amount_cents for p in b.payments if p.kind == "extra")
    total_due = (b.total_fee_cents or 0) + extras
    paid = sum(p.received_cents or 0 for p in b.payments)
    return {
        "total_fee": b.total_fee_cents or 0,
        "extras": extras,
        "total_due": total_due,
        "paid": paid,
        "balance": max(0, total_due - paid),
    }


def _next_payment(b: Booking) -> Optional[dict]:
    """The next unpaid line, due ones first. The final payment and any extra
    charges are paid together, so they're reported as one amount."""
    if b.cancelled_at or not b.sent_at:
        return None
    open_lines = [p for p in _payments(b) if not _paid(p)]
    if not open_lines:
        return None
    due = [p for p in open_lines if _state(b, p) == "due"]
    p = (due or open_lines)[0]
    if p.kind in ("final", "extra"):
        closing = [x for x in open_lines if x.kind in ("final", "extra")]
        amount = sum(x.amount_cents - (x.received_cents or 0) for x in closing)
        label = "Final payment"
    else:
        amount = p.amount_cents - (p.received_cents or 0)
        label = p.label
    return {"kind": p.kind, "label": label, "amount_cents": amount, "due": bool(due)}


def _memo(b: Booking) -> str:
    nxt = _next_payment(b)
    return f"{b.number} {MEMO_WORDS[nxt['kind']]}" if nxt else b.number


def _sync_schedule(b: Booking):
    amounts = schedule_amounts(b.total_fee_cents or 0)
    existing = {p.kind: p for p in b.payments if p.kind != "extra"}
    for kind, label, percent in SCHEDULE:
        p = existing.get(kind)
        if not p:
            p = BookingPayment(kind=kind, label=label, percent=percent, received_cents=0)
            b.payments.append(p)
        p.amount_cents = amounts[kind]


# ---- clients ----

def _find_user_by_email(session, email: str) -> Optional[User]:
    ue = session.query(UserEmail).filter(func.lower(UserEmail.email) == email).first()
    if ue:
        return session.get(User, ue.user_id)
    return session.query(User).filter(func.lower(User.user_email) == email).first()


def _resolve_client(session, data: dict, create: bool):
    """Returns (user or None, full_name, email)."""
    if data.get("client_user_id"):
        u = session.get(User, data["client_user_id"])
        if not u:
            raise HTTPException(status_code=404, detail="Client not found")
        return u, u.full_name, _primary_email(session, u)
    c = data.get("client")
    if not c:
        return None, "", ""
    name = (c.get("full_name") or "").strip()
    email = (c.get("email") or "").strip().lower()
    if not name or "@" not in email:
        raise HTTPException(status_code=400, detail="Enter the client's name and a valid email.")
    u = _find_user_by_email(session, email)
    if u or not create:
        return u, (u.full_name if u else name), (_primary_email(session, u) if u else email)
    u = User(user_name=email, full_name=name, user_email=email, role="client")
    session.add(u)
    session.flush()
    session.add(UserEmail(user_id=u.id, email=email, is_primary=True, verified_at=datetime.now()))
    session.flush()
    return u, name, email


def _client_of(session, b: Booking):
    u = session.get(User, b.client_user_id) if b.client_user_id else None
    return u, (u.full_name if u else ""), (_primary_email(session, u) if u else "")


def _owner_ids(session, me: User) -> list:
    owner = me.parent_user_id or me.id
    family = [r[0] for r in session.query(User.id).filter(User.parent_user_id == owner).all()]
    return [owner] + family


# ---- applying form fields ----

def _apply(b: Booking, data: dict):
    for key in ("client_phone", "event_type", "event_date", "location", "details_for_client", "notes_internal"):
        if key in data:
            value = data[key]
            setattr(b, key, value.strip() if isinstance(value, str) else value)
    for key in ("start_time", "end_time"):
        if key in data:
            value = (data[key] or "").strip() or None
            if value and not _HHMM.match(value):
                raise HTTPException(status_code=400, detail=f"{key} must be HH:MM (24-hour).")
            setattr(b, key, value)

    if "package_key" in data:
        b.package_key = data["package_key"]
    pkg = PACKAGES_BY_KEY.get(b.package_key or "")
    if not pkg:
        raise HTTPException(status_code=400, detail="Pick a package.")

    if pkg["key"] == "custom":
        if "includes_video" in data:
            b.includes_video = bool(data["includes_video"])
        if "revisions" in data:
            b.revisions = data["revisions"]
        if "package_name" in data:
            b.package_name = (data["package_name"] or "").strip() or None
        b.package_name = b.package_name or "Custom Package"
        b.includes_video = bool(b.includes_video)
    else:
        b.includes_video = pkg["includes_video"]
        b.revisions = pkg["revisions"]
        b.package_name = f"{pkg['category']} — {pkg['name']}"

    if "hourly_rate_cents" in data:
        b.hourly_rate_cents = data["hourly_rate_cents"]
    if pkg["pricing"] == "hourly":
        if "hours" in data:
            b.hours = data["hours"]
        if not b.hours or b.hours < pkg["min_hours"]:
            raise HTTPException(
                status_code=400, detail=f"{pkg['name']} needs at least {pkg['min_hours']} hours."
            )
    else:
        b.hours = None

    if "total_fee_cents" in data:
        fee = data["total_fee_cents"]
        if fee is not None and fee < 0:
            raise HTTPException(status_code=400, detail="The fee can't be negative.")
        b.fee_overridden = fee is not None
        if fee is not None:
            b.total_fee_cents = fee
    if not b.fee_overridden:
        if pkg["key"] == "custom":
            raise HTTPException(status_code=400, detail="Enter the fee for a custom package.")
        b.total_fee_cents = (
            int(round(pkg["rate_cents"] * b.hours)) if pkg["pricing"] == "hourly" else pkg["rate_cents"]
        )


def _render(session, b: Booking, agreement_on: Optional[date] = None, client=None) -> tuple:
    _, name, email = client or _client_of(session, b)
    fields = contract_fields(b, name, email, b.number, agreement_on or today_local())
    return render_contract(fields, {"video": bool(b.includes_video)})


def _snapshot_contract(session, b: Booking):
    version, markdown = _render(session, b)
    b.contract_version = version
    b.contract_markdown = markdown
    b.contract_hash = contract_hash(markdown)
    b.contract_rendered_at = _now()


def _next_number(session) -> str:
    top = session.query(func.max(cast(func.substr(Booking.number, 4), Integer))).scalar()
    return f"RS-{max(top or 1000, 1000) + 1}"


def _get(session, number: str) -> Booking:
    b = session.query(Booking).filter(func.upper(Booking.number) == number.upper()).first()
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    return b


# ---- JSON ----

def _payment_json(b: Booking, p: BookingPayment) -> dict:
    return {
        "id": p.id,
        "kind": p.kind,
        "label": p.label,
        "percent": p.percent,
        "amount_cents": p.amount_cents,
        "state": _state(b, p),
        "received_cents": p.received_cents or 0,
        "received_at": _iso(p.received_at),
        "method": p.method,
        "note": p.note,
    }


def _timeline(b: Booking) -> list:
    events = [(b.created_at, "Booking created")]
    events += [(b.sent_at, "Contract sent"), (b.signed_at, "Contract signed")]
    events += [(p.received_at, f"{p.label} received") for p in _payments(b)]
    events += [
        (b.delivered_at, "Gallery delivered"),
        (b.unlocked_at, "Gallery unlocked"),
        (b.cancelled_at, "Booking cancelled"),
    ]
    return [{"at": _iso(at), "label": label} for at, label in sorted((e for e in events if e[0]), key=lambda e: e[0])]


def _booking_json(session, b: Booking, admin: bool) -> dict:
    u, name, email = _client_of(session, b)
    album = session.get(Album, b.album_id) if b.album_id else None
    signed = bool(b.signed_at)
    contract = {
        "version": b.signed_version or b.contract_version,
        "hash": b.signed_hash or b.contract_hash,
        "sent_at": _iso(b.sent_at),
        "signed": signed,
        "signed_at": _iso(b.signed_at),
        "signed_name": b.signed_name,
        "pdf_url": f"/api/bookings/{b.number}/contract.pdf" if signed else None,
        "markdown": b.contract_markdown,
    }
    out = {
        "number": b.number,
        "status": b.status,
        "client": {"user_id": b.client_user_id, "full_name": name, "email": email, "phone": b.client_phone},
        "event": {
            "type": b.event_type,
            "date": b.event_date.isoformat() if b.event_date else None,
            "start_time": b.start_time,
            "end_time": b.end_time,
            "location": b.location,
        },
        "package": {
            "key": b.package_key,
            "name": b.package_name,
            "includes_video": bool(b.includes_video),
            "revisions": b.revisions,
            "hours": b.hours,
            "hourly_rate_cents": b.hourly_rate_cents,
            "fee_overridden": bool(b.fee_overridden),
        },
        "money": _money(b),
        "payments": [_payment_json(b, p) for p in _payments(b)],
        "next_payment": _next_payment(b),
        "contract": contract,
        "album": None,
        "details_for_client": b.details_for_client,
        "delivered_at": _iso(b.delivered_at),
        "unlocked_at": _iso(b.unlocked_at),
        "cancelled_at": _iso(b.cancelled_at),
        "cancel_reason": b.cancel_reason,
        "created_at": _iso(b.created_at),
        "timeline": _timeline(b),
    }
    if admin:
        contract["signed_ip"] = b.signed_ip
        out["notes_internal"] = b.notes_internal
        if album:
            out["album"] = {"id": album.id, "slug": album.slug, "name": album.name, "locked": bool(album.proof_locked)}
    else:
        if album:
            out["album"] = {"slug": album.slug, "name": album.name, "locked": bool(album.proof_locked)}
        out["payment_instructions"] = {"zelle": ZELLE, "memo": _memo(b), "methods": PAYMENT_METHODS}
    return out


def _summary_json(session, b: Booking) -> dict:
    money = _money(b)
    return {
        "number": b.number,
        "status": b.status,
        "event_type": b.event_type,
        "event_date": b.event_date.isoformat() if b.event_date else None,
        "package_name": b.package_name,
        "total_due_cents": money["total_due"],
        "paid_cents": money["paid"],
        "next_payment": _next_payment(b),
    }


# ---- emails ----

def _client_link(session, b: Booking, path: Optional[str] = None):
    """(email, name, magic link) for the booking's client, or None."""
    u, name, email = _client_of(session, b)
    if not u or not email:
        return None
    token = issue_magic_link(session, u, "invite")
    return email, name or "there", _verify_link(token, path or f"/bookings/{b.number}")


def _send_all(messages: list):
    for to, template, props, attachments in messages:
        ok = email_service.send_template(to, template, props, attachments)
        print(f"booking email {template} -> {to}: {'sent' if ok else 'not sent'}")


def _receipt_message(session, b: Booking, p: BookingPayment, amount_cents: int):
    target = _client_link(session, b)
    if not target:
        return None
    email, name, link = target
    money = _money(b)
    nxt = _next_payment(b)
    props = {
        "fullName": name,
        "link": link,
        "bookingNumber": b.number,
        "label": p.label,
        "amount": dollars(amount_cents),
        "method": METHODS.get(p.method or "", "Other"),
        "paidTotal": dollars(money["paid"]),
        "balance": dollars(money["balance"]),
    }
    if nxt:
        props["nextLabel"] = nxt["label"]
        props["nextAmount"] = dollars(nxt["amount_cents"])
    return (email, "payment-received", props, None)


def _after_unlock(booking_id: int, notify: bool):
    message = None
    with session_scope() as s:
        b = s.get(Booking, booking_id)
        if not b:
            return
        b.unlocked_at = b.unlocked_at or _now()
        album = s.get(Album, b.album_id) if b.album_id else None
        if notify and album:
            target = _client_link(s, b, f"/albums/{album.slug}")
            if target:
                email, name, link = target
                message = (email, "gallery-unlocked", {"fullName": name, "link": link, "albumName": album.name}, None)
    if message:
        _send_all([message])


def _schedule_unlock(session, b: Booking, background: BackgroundTasks, notify: bool) -> bool:
    """Start the unlock job for the booking's album. Returns True if one was started."""
    album = session.get(Album, b.album_id) if b.album_id else None
    if not album:
        return False
    booking_id = b.id
    if not (album.proof_locked or _has_held(session, album.id)):
        if notify and not b.unlocked_at:
            background.add_task(_after_unlock, booking_id, True)
        else:
            b.unlocked_at = b.unlocked_at or _now()
        return False
    upload_jobs.start_job(album.slug, face_detection=False, image_count=album.image_count or 0, kind="unlock")
    background.add_task(proof_service.unlock_album, album.id, lambda: _after_unlock(booking_id, notify))
    return True


def _has_held(session, album_id: int) -> bool:
    return session.query(FileMetadata.id).filter_by(album_id=album_id, held=True).first() is not None


# ---- admin ----

@router.get("/api/booking-packages")
def list_packages(_admin=Depends(require_admin)):
    return [dict(p) for p in BOOKING_PACKAGES]


@router.get("/api/bookings")
def list_bookings(
    status: Optional[str] = None,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    q = session.query(Booking)
    if status:
        q = q.filter(Booking.status.in_([s.strip() for s in status.split(",") if s.strip()]))
    rows = q.order_by(Booking.event_date.desc().nullslast(), Booking.id.desc()).all()
    out = []
    for b in rows:
        _, name, email = _client_of(session, b)
        album = session.get(Album, b.album_id) if b.album_id else None
        out.append({
            **_summary_json(session, b),
            "client": {"user_id": b.client_user_id, "full_name": name, "email": email},
            "album_slug": album.slug if album else None,
            "created_at": _iso(b.created_at),
        })
    return out


@router.post("/api/bookings/preview")
def preview_booking(
    body: PreviewIn,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Amounts + rendered contract for the form's live preview. No writes."""
    data = body.model_dump(exclude_unset=True)
    number = data.pop("number", None)
    existing = (
        session.query(Booking).filter(func.upper(Booking.number) == number.upper()).first() if number else None
    )
    b = Booking(includes_video=False, fee_overridden=False, total_fee_cents=0)
    if existing:
        for col in ("client_phone", "event_type", "event_date", "start_time", "end_time", "location",
                    "package_key", "package_name", "hours", "includes_video", "revisions",
                    "hourly_rate_cents", "total_fee_cents", "fee_overridden"):
            setattr(b, col, getattr(existing, col))
    with session.no_autoflush:
        _apply(b, data)
        b.number = existing.number if existing else _next_number(session)
        if "client_user_id" in data or "client" in data:
            client = _resolve_client(session, data, create=False)
        elif existing:
            client = _client_of(session, existing)
        else:
            client = (None, "", "")
        _, markdown = _render(session, b, client=client)
    amounts = schedule_amounts(b.total_fee_cents)
    return {
        "amounts": {"total_fee": b.total_fee_cents, "total_due": b.total_fee_cents, **amounts},
        "contract_markdown": markdown,
    }


@router.post("/api/bookings")
def create_booking(
    body: BookingIn,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    data = body.model_dump(exclude_unset=True)
    if not data.get("client_user_id") and not data.get("client"):
        raise HTTPException(status_code=400, detail="Pick a client or add a new one.")
    if not data.get("event_date"):
        raise HTTPException(status_code=400, detail="Add the event date.")
    b = Booking(status="draft", includes_video=False, fee_overridden=False, total_fee_cents=0)
    _apply(b, data)
    u, _, _ = _resolve_client(session, data, create=True)
    b.client_user_id = u.id
    b.number = _next_number(session)
    _sync_schedule(b)
    session.add(b)
    _refresh_status(b)
    session.commit()
    session.refresh(b)
    return _booking_json(session, b, admin=True)


@router.get("/api/bookings/{number}")
def get_booking(number: str, _admin=Depends(require_admin), session: Session = Depends(get_session)):
    return _booking_json(session, _get(session, number), admin=True)


@router.patch("/api/bookings/{number}")
def update_booking(
    number: str,
    body: BookingIn,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    b = _get(session, number)
    data = body.model_dump(exclude_unset=True)
    terms = CONTRACT_FIELDS & set(data)
    if terms and b.status not in ("draft", "sent"):
        raise HTTPException(
            status_code=409, detail="This booking's contract is signed, so its terms can't change."
        )
    _apply(b, data)
    if "client_user_id" in data or "client" in data:
        u, _, _ = _resolve_client(session, data, create=True)
        if u:
            b.client_user_id = u.id
    if terms:
        _sync_schedule(b)
        # the client re-reviews: the old hash no longer matches
        if b.status == "sent":
            _snapshot_contract(session, b)
    _refresh_status(b)
    session.commit()
    return _booking_json(session, b, admin=True)


@router.post("/api/bookings/{number}/send")
def send_booking(number: str, _admin=Depends(require_admin), session: Session = Depends(get_session)):
    """Snapshot the contract and email the client a sign-in link to review and sign."""
    b = _get(session, number)
    if b.status not in ("draft", "sent"):
        raise HTTPException(status_code=409, detail=f"This booking is already {b.status}.")
    missing = [
        label for label, value in (
            ("event type", b.event_type), ("event date", b.event_date), ("start time", b.start_time),
            ("end time", b.end_time), ("location", b.location),
        ) if not value
    ]
    u, name, email = _client_of(session, b)
    if not u or not email:
        missing.append("client email")
    if missing:
        raise HTTPException(status_code=400, detail=f"Add the {', '.join(missing)} before sending.")

    if b.status == "draft" or not b.contract_markdown:
        _snapshot_contract(session, b)
    b.sent_at = _now()
    _refresh_status(b)
    _, _, link = _client_link(session, b)
    session.commit()

    amounts = schedule_amounts(b.total_fee_cents)
    sent = email_service.send_template(email, "booking-invite", {
        "fullName": name or "there",
        "link": link,
        "bookingNumber": b.number,
        "eventType": b.event_type,
        "eventDate": long_date(b.event_date),
        "packageName": b.package_name,
        "totalDue": dollars(_money(b)["total_due"]),
        "retainer": dollars(amounts["retainer"]),
    })
    return {**_booking_json(session, b, admin=True), "email_sent": sent}


@router.post("/api/bookings/{number}/payments/{payment_id}/receive")
def receive_payment(
    number: str,
    payment_id: int,
    body: ReceiveIn,
    background: BackgroundTasks,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    b = _get(session, number)
    p = next((x for x in b.payments if x.id == payment_id), None)
    if not p:
        raise HTTPException(status_code=404, detail="Payment not found")
    method = (body.method or "").strip().lower()
    if method not in METHODS:
        raise HTTPException(status_code=400, detail="Method must be zelle, cash, check or other.")
    if body.amount_cents <= 0:
        raise HTTPException(status_code=400, detail="Enter the amount received.")

    received_at = body.received_at or _now()
    if not isinstance(received_at, datetime):
        received_at = datetime.combine(received_at, datetime.min.time())
    if received_at.tzinfo:
        received_at = received_at.astimezone(timezone.utc).replace(tzinfo=None)
    was = b.status
    note = (body.note or "").strip() or None
    # a second partial payment adds to the first, and keeps its own receipt
    p.receipts = _receipts(p) + [
        {"amount_cents": body.amount_cents, "method": method, "received_at": received_at.isoformat(), "note": note}
    ]
    p.received_cents = (p.received_cents or 0) + body.amount_cents
    p.received_at = received_at
    p.method = method
    p.note = note
    status = _refresh_status(b)

    messages = []
    receipt = _receipt_message(session, b, p, body.amount_cents)
    if receipt:
        messages.append(receipt)
    if status == "paid" and was != "paid":
        _schedule_unlock(session, b, background, notify=True)
    session.commit()
    if messages:
        background.add_task(_send_all, messages)
    return _booking_json(session, b, admin=True)


@router.post("/api/bookings/{number}/payments/{payment_id}/undo")
def undo_payment(
    number: str,
    payment_id: int,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Clear a receipt recorded by mistake. An unlocked gallery stays unlocked."""
    b = _get(session, number)
    p = next((x for x in b.payments if x.id == payment_id), None)
    if not p:
        raise HTTPException(status_code=404, detail="Payment not found")
    p.received_cents = 0
    p.received_at = None
    p.method = None
    p.note = None
    p.receipts = None
    _refresh_status(b)
    session.commit()
    return _booking_json(session, b, admin=True)


@router.post("/api/bookings/{number}/payments")
def add_charge(
    number: str,
    body: ExtraIn,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    """An extra charge (e.g. overtime), due with the final payment."""
    b = _get(session, number)
    if b.cancelled_at:
        raise HTTPException(status_code=409, detail="This booking is cancelled.")
    label = (body.label or "").strip()
    if not label or body.amount_cents <= 0:
        raise HTTPException(status_code=400, detail="Add a label and an amount.")
    b.payments.append(BookingPayment(kind="extra", label=label, amount_cents=body.amount_cents, received_cents=0))
    _refresh_status(b)
    session.commit()
    return _booking_json(session, b, admin=True)


@router.delete("/api/bookings/{number}/payments/{payment_id}")
def remove_charge(
    number: str,
    payment_id: int,
    background: BackgroundTasks,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Remove an extra charge added by mistake (unpaid extras only)."""
    b = _get(session, number)
    p = next((x for x in b.payments if x.id == payment_id), None)
    if not p:
        raise HTTPException(status_code=404, detail="Payment not found")
    if p.kind != "extra" or p.received_at:
        raise HTTPException(status_code=409, detail="Only unpaid extra charges can be removed.")
    was = b.status
    b.payments.remove(p)
    if _refresh_status(b) == "paid" and was != "paid":
        _schedule_unlock(session, b, background, notify=True)
    session.commit()
    return _booking_json(session, b, admin=True)


def _unique_slug(session, name: str) -> str:
    base = slugify(name)
    slug, n = base, 2
    while session.query(Album.id).filter_by(slug=slug).first():
        slug, n = f"{base}-{n}", n + 1
    return slug


@router.post("/api/bookings/{number}/album")
def link_album(
    number: str,
    background: BackgroundTasks,
    body: AlbumLinkIn = Body(...),
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Link the booking's gallery and lock it into proof mode until paid."""
    b = _get(session, number)
    if b.cancelled_at:
        raise HTTPException(status_code=409, detail="This booking is cancelled.")
    if body.create:
        _, client_name, _ = _client_of(session, b)
        name = " ".join(x for x in (client_name, b.event_type) if x) or b.number
        slug = _unique_slug(session, name)
        album = Album(
            name=name,
            slug=slug,
            location=os.path.join(settings.DATA_DIR, slug),
            date=b.event_date.isoformat() if b.event_date else str(datetime.now()),
            image_count=0,
            shared=False,
            upload=False,
            secret=str(uuid4()),
            face_detection=True,
        )
        session.add(album)
        session.flush()
    elif body.album_id:
        album = session.get(Album, body.album_id)
        if not album:
            raise HTTPException(status_code=404, detail="Album not found")
    else:
        raise HTTPException(status_code=400, detail="Pass album_id or create: true.")

    other = (
        session.query(Booking.number)
        .filter(Booking.album_id == album.id, Booking.id != b.id, Booking.cancelled_at.is_(None))
        .first()
    )
    if other:
        raise HTTPException(status_code=409, detail=f"That album belongs to booking {other[0]}.")

    previous = session.get(Album, b.album_id) if b.album_id and b.album_id != album.id else None
    b.album_id = album.id

    # the client (and their family) see the gallery from their library
    if b.client_user_id:
        client = session.get(User, b.client_user_id)
        owner = client.parent_user_id or client.id
        if not session.query(UserAlbumPermission).filter_by(user_id=owner, album_id=album.id).first():
            session.add(UserAlbumPermission(user_id=owner, album_id=album.id))

    convert = False
    if b.status != "paid":
        convert = proof_service.lock(session, album)
    b.updated_at = _now()
    session.commit()

    if convert:
        upload_jobs.start_job(album.slug, face_detection=False, image_count=album.image_count or 0, kind="lock")
        background.add_task(proof_service.convert_album, album.id)
    # this booking locked the old album; nothing else is holding it now
    if previous and (previous.proof_locked or _has_held(session, previous.id)):
        still_used = session.query(Booking.id).filter(
            Booking.album_id == previous.id, Booking.cancelled_at.is_(None), Booking.status != "paid"
        ).first()
        if not still_used:
            upload_jobs.start_job(previous.slug, face_detection=False, image_count=previous.image_count or 0, kind="unlock")
            background.add_task(proof_service.unlock_album, previous.id)
    return {**_booking_json(session, b, admin=True), "processing": convert}


@router.post("/api/bookings/{number}/delivered")
def mark_delivered(
    number: str,
    background: BackgroundTasks,
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    b = _get(session, number)
    if b.cancelled_at:
        raise HTTPException(status_code=409, detail="This booking is cancelled.")
    if not b.signed_at:
        raise HTTPException(status_code=409, detail="The contract isn't signed yet.")
    album = session.get(Album, b.album_id) if b.album_id else None
    if not album:
        raise HTTPException(status_code=400, detail="Link the gallery first.")
    b.delivered_at = b.delivered_at or _now()
    _refresh_status(b)

    nxt = _next_payment(b)
    message = None
    if nxt and nxt["kind"] in ("final", "extra"):
        target = _client_link(session, b, f"/albums/{album.slug}")
        if target:
            email, name, link = target
            message = (email, "gallery-delivered", {
                "fullName": name,
                "link": link,
                "bookingNumber": b.number,
                "albumName": album.name,
                "finalAmount": dollars(nxt["amount_cents"]),
                "zelle": ZELLE,
                "memo": _memo(b),
            }, None)
    session.commit()
    if message:
        background.add_task(_send_all, [message])
    return _booking_json(session, b, admin=True)


@router.post("/api/bookings/{number}/unlock")
def unlock_booking_album(
    number: str,
    background: BackgroundTasks,
    body: Optional[UnlockIn] = Body(None),
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Admin override: release full-resolution files before the final payment."""
    b = _get(session, number)
    if not b.album_id:
        raise HTTPException(status_code=400, detail="This booking has no gallery linked.")
    started = _schedule_unlock(session, b, background, notify=bool(body and body.notify))
    session.commit()
    return {**_booking_json(session, b, admin=True), "processing": started}


@router.post("/api/bookings/{number}/cancel")
def cancel_booking(
    number: str,
    body: CancelIn = Body(CancelIn()),
    _admin=Depends(require_admin),
    session: Session = Depends(get_session),
):
    b = _get(session, number)
    b.cancelled_at = b.cancelled_at or _now()
    b.cancel_reason = (body.reason or "").strip() or None
    _refresh_status(b)
    session.commit()
    return _booking_json(session, b, admin=True)


# ---- contract PDF ----

def _store_pdf(session, b: Booking) -> bytes:
    _, name, email = _client_of(session, b)
    pdf = render_pdf(b, b.contract_markdown, name, email)
    # random, not the hash: the hash can be recomputed by anyone who knows the terms
    key = f"contracts/{b.number}-{secrets.token_urlsafe(12)}.pdf"
    try:
        s3_client.put_object(Bucket=AWS_BUCKET, Key=key, Body=pdf, ContentType="application/pdf")
        b.pdf_key = key
    except Exception as e:
        print(f"booking {b.number}: storing the signed PDF failed: {e}")
    return pdf


def _pdf_response(pdf: bytes, filename: str) -> Response:
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"', "Cache-Control": "private, no-store"},
    )


@router.get("/api/bookings/{number}/contract.pdf")
def contract_pdf(
    number: str,
    preview: bool = False,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """The signed agreement, for the admin or the booking's client."""
    me = session.query(User).filter_by(user_name=current_user.user_name).first()
    if not me:
        raise HTTPException(status_code=401, detail="Account not found")
    b = _get(session, number)
    admin = me.role == "admin"
    if not admin and b.client_user_id not in _owner_ids(session, me):
        raise HTTPException(status_code=404, detail="Booking not found")

    if not b.signed_at:
        if not (admin and preview):
            raise HTTPException(status_code=404, detail="The contract isn't signed yet.")
        _, name, email = _client_of(session, b)
        markdown = b.contract_markdown or _render(session, b)[1]
        return _pdf_response(render_pdf(b, markdown, name, email), f"{b.number}-agreement-preview.pdf")

    pdf = None
    if b.pdf_key:
        try:
            pdf = s3_client.get_object(Bucket=AWS_BUCKET, Key=b.pdf_key)["Body"].read()
        except Exception as e:
            print(f"booking {b.number}: reading the stored PDF failed: {e}")
    if pdf is None:
        pdf = _store_pdf(session, b)
        session.commit()
    return _pdf_response(pdf, f"{b.number}-agreement.pdf")


# ---- invoice ----

def _invoice_lines(b: Booking) -> list:
    pkg = PACKAGES_BY_KEY.get(b.package_key or "") or PACKAGES_BY_KEY["custom"]
    fee = b.total_fee_cents or 0
    if pkg["key"] == "custom":
        name = b.package_name or "Custom Package"
    else:
        name = f"{pkg['category']} Photography — {pkg['name']}"
    hourly = pkg["pricing"] == "hourly" and b.hours
    if hourly and not b.fee_overridden:
        package = {
            "description": name,
            "qty": hours_text(b.hours),
            "rate_cents": pkg["rate_cents"],
            "amount_cents": fee,
        }
    else:
        # an agreed fee replaces hours x rate
        package = {
            "description": f"{name} ({hours_text(b.hours)})" if hourly else name,
            "qty": "1",
            "rate_cents": fee,
            "amount_cents": fee,
        }
    extras = [
        {"description": p.label, "qty": "1", "rate_cents": p.amount_cents, "amount_cents": p.amount_cents}
        for p in _payments(b)
        if p.kind == "extra"
    ]
    return [package] + extras


def _due_when(b: Booking, p: BookingPayment) -> str:
    when = {
        "retainer": "When you sign the agreement",
        "event_day": f"On the event day, {day(b.event_date, short=True)}" if b.event_date else "On the event day",
        "final": "When your gallery is delivered",
        "extra": "With the final payment",
    }[p.kind]
    return f"{when} · {dollars(p.received_cents)} received" if p.received_cents else when


def _invoice_balance(b: Booking) -> int:
    # a cancelled booking's invoice is void: nothing more is owed
    return 0 if b.cancelled_at else _money(b)["balance"]


def _invoice_status(b: Booking) -> str:
    if b.cancelled_at:
        return "cancelled"
    if _invoice_balance(b) == 0:
        return "paid"
    nxt = _next_payment(b)
    return "due" if nxt and nxt["due"] else "open"


def _invoice(session, b: Booking) -> dict:
    """Everything the invoice PDF prints, built fresh from the booking."""
    _, name, email = _client_of(session, b)
    money = _money(b)
    received = [p for p in _payments(b) if (p.received_cents or 0) > 0]
    paid_dates = [p.received_at for p in received if p.received_at]
    return {
        "number": f"INV-{b.number}",
        "booking_number": b.number,
        "issued": b.sent_at.date(),
        "as_of": today_local(),
        "status": b.status,
        "cancelled_on": b.cancelled_at.date() if b.cancelled_at else None,
        "client": {"name": name, "email": email, "phone": b.client_phone},
        "event": {
            "type": b.event_type,
            "date": b.event_date,
            "start_time": b.start_time,
            "end_time": b.end_time,
            "location": b.location,
        },
        "lines": _invoice_lines(b),
        "total_cents": money["total_due"],
        "paid_cents": money["paid"],
        "balance_cents": _invoice_balance(b),
        "paid_on": max(paid_dates).date() if paid_dates else None,
        "received": [
            {
                "date": datetime.fromisoformat(r["received_at"]).date() if r.get("received_at") else None,
                "description": p.label,
                "method": METHODS.get(r.get("method") or "", "Other"),
                "amount_cents": r["amount_cents"],
            }
            for p in received
            for r in _receipts(p)
        ],
        # what's still to pay; paid lines are already under payments received
        "schedule": [
            {
                "label": f"{p.label} · {p.percent}%" if p.percent else p.label,
                "amount_cents": p.amount_cents - (p.received_cents or 0),
                "state": _state(b, p),
                "when": _due_when(b, p),
            }
            for p in _payments(b)
            if not _paid(p)
        ],
        "memo": _memo(b),
    }


def _invoice_response(session, b: Booking) -> Response:
    pdf = render_invoice(_invoice(session, b))
    return _pdf_response(pdf, f"Reactive Shots Studios Invoice INV-{b.number}.pdf")


@router.get("/api/bookings/{number}/invoice.pdf")
def invoice_pdf(number: str, _admin=Depends(require_admin), session: Session = Depends(get_session)):
    b = _get(session, number)
    if not b.sent_at:
        raise HTTPException(status_code=409, detail="The invoice is issued once the booking is sent.")
    return _invoice_response(session, b)


# ---- client ----

def _me(session, current_user) -> User:
    me = session.query(User).filter_by(user_name=current_user.user_name).first()
    if not me:
        raise HTTPException(status_code=401, detail="Account not found")
    return me


def _my_booking(session, me: User, number: str) -> Booking:
    b = (
        session.query(Booking)
        .filter(
            func.upper(Booking.number) == number.upper(),
            Booking.client_user_id.in_(_owner_ids(session, me)),
            Booking.sent_at.isnot(None),
        )
        .first()
    )
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    return b


@router.get("/api/me/bookings")
def my_bookings(current_user=Depends(get_current_user), session: Session = Depends(get_session)):
    me = _me(session, current_user)
    rows = (
        session.query(Booking)
        .filter(Booking.client_user_id.in_(_owner_ids(session, me)), Booking.sent_at.isnot(None))
        .order_by(Booking.event_date.desc().nullslast(), Booking.id.desc())
        .all()
    )
    out = []
    for b in rows:
        item = _summary_json(session, b)
        nxt = item["next_payment"]
        if b.status == "sent":
            action = "sign"
        elif nxt and nxt["due"]:
            action = "pay"
        else:
            action = None
        album = session.get(Album, b.album_id) if b.album_id else None
        out.append({
            **item,
            "action": action,
            "balance_cents": _money(b)["balance"],
            "album_slug": album.slug if album else None,
        })
    return out


@router.get("/api/me/bookings/{number}")
def my_booking(number: str, current_user=Depends(get_current_user), session: Session = Depends(get_session)):
    me = _me(session, current_user)
    return _booking_json(session, _my_booking(session, me, number), admin=False)


@router.get("/api/me/bookings/{number}/invoice.pdf")
def my_invoice_pdf(number: str, current_user=Depends(get_current_user), session: Session = Depends(get_session)):
    me = _me(session, current_user)
    return _invoice_response(session, _my_booking(session, me, number))


@router.get("/api/me/invoices")
def my_invoices(current_user=Depends(get_current_user), session: Session = Depends(get_session)):
    me = _me(session, current_user)
    rows = (
        session.query(Booking)
        .filter(Booking.client_user_id.in_(_owner_ids(session, me)), Booking.sent_at.isnot(None))
        .order_by(Booking.event_date.desc().nullslast(), Booking.id.desc())
        .all()
    )
    out = []
    for b in rows:
        money = _money(b)
        out.append({
            "booking_number": b.number,
            "invoice_number": f"INV-{b.number}",
            "event_type": b.event_type,
            "event_date": b.event_date.isoformat() if b.event_date else None,
            "issued_at": _iso(b.sent_at),
            "total_cents": money["total_due"],
            "paid_cents": money["paid"],
            "balance_cents": _invoice_balance(b),
            "status": _invoice_status(b),
            "next_payment": _next_payment(b),
        })
    return out


def _client_ip(request: Request) -> Optional[str]:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


@router.post("/api/me/bookings/{number}/sign")
def sign_booking(
    number: str,
    body: SignIn,
    request: Request,
    background: BackgroundTasks,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    me = _me(session, current_user)
    b = _my_booking(session, me, number)
    if b.signed_at:
        raise HTTPException(status_code=409, detail="This agreement is already signed.")
    if b.cancelled_at:
        raise HTTPException(status_code=409, detail="This booking was cancelled.")
    if not body.consent:
        raise HTTPException(status_code=400, detail="Please agree to sign electronically.")
    typed = " ".join((body.full_name or "").split())
    if not typed:
        raise HTTPException(status_code=400, detail="Type your full name to sign.")
    if body.contract_hash != b.contract_hash:
        raise HTTPException(
            status_code=409, detail="The agreement changed since you opened it. Please review the latest version."
        )

    b.signed_at = _now()
    b.signed_name = typed
    b.signed_ip = _client_ip(request)
    b.signed_user_agent = request.headers.get("user-agent")
    b.signed_consent = CONSENT_TEXT
    b.signed_version = b.contract_version
    b.signed_hash = b.contract_hash
    _refresh_status(b)
    pdf = _store_pdf(session, b)

    attachment = [{"filename": f"{b.number}-agreement.pdf", "content": pdf}]
    retainer = next((p for p in b.payments if p.kind == "retainer"), None)
    props = {
        "bookingNumber": b.number,
        "eventDate": long_date(b.event_date),
        "retainer": dollars(retainer.amount_cents if retainer else 0),
        "zelle": ZELLE,
        "memo": f"{b.number} retainer",
    }
    messages = []
    target = _client_link(session, b)
    if target:
        email, name, link = target
        messages.append((email, "booking-signed", {"fullName": name, "link": link, **props}, attachment))
        studio_props = {"fullName": name, "link": f"{CLIENT_URL}/bookings/{b.number}", **props}
        messages.append((STUDIO_EMAIL, "booking-signed", studio_props, attachment))
    session.commit()
    if messages:
        background.add_task(_send_all, messages)
    return _booking_json(session, b, admin=False)
