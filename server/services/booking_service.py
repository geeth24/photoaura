"""Booking packages, the payment schedule and contract rendering."""

import hashlib
import os
import re
from datetime import date, datetime, timezone
from typing import Optional

CONTRACTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "contracts")
TEMPLATE_PATH = os.path.join(CONTRACTS_DIR, "photography_services.md")
LOGO_PATH = os.path.join(CONTRACTS_DIR, "rs-logo.png")

ZELLE = "zelle@reactiveshots.com"
PAYMENT_METHODS = ["Zelle", "Cash", "Check"]
METHODS = {"zelle": "Zelle", "cash": "Cash", "check": "Check", "other": "Other"}
CONSENT_TEXT = (
    "I agree to sign this agreement electronically, and that typing my name below is my signature."
)
PHOTOGRAPHER = "Geeth Gunnampalli"

# mirrors reactiveshots.com pricing
BOOKING_PACKAGES = [
    {"key": "event-photo", "category": "Event", "name": "Photos Only", "pricing": "hourly",
     "rate_cents": 15000, "min_hours": 3, "includes_video": False, "revisions": 2},
    {"key": "event-photo-video", "category": "Event", "name": "Photo + Video", "pricing": "hourly",
     "rate_cents": 30000, "min_hours": 3, "includes_video": True, "revisions": 2},
    {"key": "portrait-essential", "category": "Portrait", "name": "Essential (1 hr)", "pricing": "flat",
     "rate_cents": 20000, "min_hours": None, "includes_video": False, "revisions": 1},
    {"key": "portrait-extended", "category": "Portrait", "name": "Extended (2 hr)", "pricing": "flat",
     "rate_cents": 35000, "min_hours": None, "includes_video": False, "revisions": 2},
    {"key": "auto-quick", "category": "Automotive", "name": "Quick Shoot (30 min)", "pricing": "flat",
     "rate_cents": 15000, "min_hours": None, "includes_video": False, "revisions": 1},
    {"key": "auto-photo", "category": "Automotive", "name": "Photos Only (1 hr)", "pricing": "flat",
     "rate_cents": 25000, "min_hours": None, "includes_video": False, "revisions": 1},
    {"key": "auto-photo-video", "category": "Automotive", "name": "Photo & Video (1 hr)", "pricing": "flat",
     "rate_cents": 40000, "min_hours": None, "includes_video": True, "revisions": 1},
    {"key": "re-basic", "category": "Real Estate", "name": "Basic", "pricing": "flat",
     "rate_cents": 20000, "min_hours": None, "includes_video": False, "revisions": 1},
    {"key": "re-premium", "category": "Real Estate", "name": "Premium", "pricing": "flat",
     "rate_cents": 30000, "min_hours": None, "includes_video": False, "revisions": 2},
    {"key": "re-luxury", "category": "Real Estate", "name": "Luxury", "pricing": "flat",
     "rate_cents": 45000, "min_hours": None, "includes_video": False, "revisions": 3},
    {"key": "custom", "category": "Custom", "name": "Custom", "pricing": "flat",
     "rate_cents": None, "min_hours": None, "includes_video": False, "revisions": None},
]
PACKAGES_BY_KEY = {p["key"]: p for p in BOOKING_PACKAGES}

PHOTO_OVERTIME_CENTS = 15000
VIDEO_OVERTIME_CENTS = 30000

SCHEDULE = [
    ("retainer", "Booking retainer", 10),
    ("event_day", "Event-day payment", 40),
    ("final", "Final payment", 50),
]
MEMO_WORDS = {"retainer": "retainer", "event_day": "event day", "final": "final", "extra": "final"}


def schedule_amounts(total_fee: int) -> dict:
    """10 / 40 / 50 of the fee; the final absorbs any rounding."""
    retainer = (total_fee * 10 + 50) // 100
    event_day = (total_fee * 40 + 50) // 100
    return {"retainer": retainer, "event_day": event_day, "final": total_fee - retainer - event_day}


# ---- formatting ----

def money(cents: int) -> str:
    """1350.00 dollars -> "1,350.00"."""
    sign = "-" if cents < 0 else ""
    cents = abs(int(cents))
    return f"{sign}{cents // 100:,}.{cents % 100:02d}"


def dollars(cents: int) -> str:
    return f"${money(cents)}"


def long_date(d) -> str:
    if not d:
        return ""
    if isinstance(d, str):
        d = date.fromisoformat(d)
    return f"{d.strftime('%A, %B')} {d.day}, {d.year}"


def clock(hhmm: Optional[str]) -> str:
    """"17:00" -> "5:00 PM"."""
    if not hhmm:
        return ""
    h, m = (int(x) for x in hhmm.split(":")[:2])
    return f"{(h % 12) or 12}:{m:02d} {'AM' if h < 12 else 'PM'}"


def hours_text(hours: Optional[float]) -> str:
    if hours is None:
        return ""
    n = f"{hours:g}"
    return f"{n} hour" if n == "1" else f"{n} hours"


def package_label(package_key: str, package_name: Optional[str], hours, rate_cents) -> str:
    """"Event Photography — Photos Only (3 hours at $150/hr)"."""
    pkg = PACKAGES_BY_KEY.get(package_key) or PACKAGES_BY_KEY["custom"]
    if pkg["key"] == "custom":
        return package_name or "Custom Package"
    label = f"{pkg['category']} Photography — {pkg['name']}"
    if pkg["pricing"] == "hourly" and hours:
        rate = f"${rate_cents // 100:,}" if rate_cents % 100 == 0 else dollars(rate_cents)
        label += f" ({hours_text(hours)} at {rate}/hr)"
    return label


def overtime_rate(package_key: str, includes_video: bool, entered: Optional[int]) -> int:
    pkg = PACKAGES_BY_KEY.get(package_key)
    if pkg and pkg["pricing"] == "hourly":
        return pkg["rate_cents"]
    if entered:
        return entered
    return VIDEO_OVERTIME_CENTS if includes_video else PHOTO_OVERTIME_CENTS


# ---- contract template ----

_COMMENT = re.compile(r"<!--(.*?)-->", re.S)
_SECTION = re.compile(r"\{\{([#^])(\w+)\}\}(.*?)\{\{/\2\}\}", re.S)
_FIELD = re.compile(r"\{\{(\w+)\}\}")


def _template() -> tuple:
    with open(TEMPLATE_PATH, encoding="utf-8") as f:
        raw = f.read()
    m = _COMMENT.search(raw)
    version = None
    if m:
        v = re.search(r"version:\s*(\S+)", m.group(1))
        version = v.group(1) if v else None
    body = _COMMENT.sub("", raw, count=1).strip() + "\n"
    return version, body


def template_version() -> Optional[str]:
    return _template()[0]


def render_contract(fields: dict, flags: dict) -> tuple:
    """Fill the master template. Returns (version, markdown)."""
    version, body = _template()

    def section(m):
        on = bool(flags.get(m.group(2)))
        show = on if m.group(1) == "#" else not on
        return m.group(3) if show else ""

    body = _SECTION.sub(section, body)

    def field(m):
        key = m.group(1)
        if key not in fields:
            raise KeyError(f"contract field missing: {key}")
        return str(fields[key] if fields[key] is not None else "")

    return version, _FIELD.sub(field, body)


def contract_hash(markdown: str) -> str:
    return hashlib.sha256(markdown.encode("utf-8")).hexdigest()


def contract_fields(b, client_name: str, client_email: str, number: str, agreement_on: date) -> dict:
    """Template values for a booking-like object (a Booking row or a preview)."""
    amounts = schedule_amounts(b.total_fee_cents or 0)
    rate = overtime_rate(b.package_key, b.includes_video, b.hourly_rate_cents)
    pkg = PACKAGES_BY_KEY.get(b.package_key) or {}
    pkg_rate = pkg.get("rate_cents") if pkg.get("pricing") == "hourly" else None
    return {
        "agreement_date": long_date(agreement_on),
        "client_name": client_name or "",
        "client_email": client_email or "",
        "client_phone": b.client_phone or "",
        "event_type": b.event_type or "",
        "event_date": long_date(b.event_date),
        # several stops are stored one per line; the contract lists them on one line
        "event_location": "; ".join(l.strip() for l in (b.location or "").splitlines() if l.strip()),
        "start_time": clock(b.start_time),
        "end_time": clock(b.end_time),
        "package": package_label(b.package_key, b.package_name, b.hours, pkg_rate or 0),
        "total_fee": money(b.total_fee_cents or 0),
        "retainer_amount": money(amounts["retainer"]),
        "event_day_amount": money(amounts["event_day"]),
        "final_amount": money(amounts["final"]),
        "hourly_rate": money(rate),
        "booking_number": number,
    }


def today_local() -> date:
    """The studio is in Dallas; fall back to UTC if tz data is missing."""
    try:
        from zoneinfo import ZoneInfo

        return datetime.now(ZoneInfo("America/Chicago")).date()
    except Exception:
        return datetime.utcnow().date()


def local_date(dt: Optional[datetime]) -> Optional[date]:
    """Dallas calendar date of a stored (naive UTC) timestamp, so an evening
    signature isn't dated tomorrow."""
    if not dt:
        return None
    try:
        from zoneinfo import ZoneInfo

        return dt.replace(tzinfo=timezone.utc).astimezone(ZoneInfo("America/Chicago")).date()
    except Exception:
        return dt.date()
