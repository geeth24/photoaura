"""Invoice PDF for a booking, on the same paper as the signed agreement."""

from datetime import date
from typing import Optional

from fpdf.enums import MethodReturnValue

from services.booking_service import PHOTOGRAPHER, ZELLE, clock, dollars, long_date
from services.studio_pdf import BODY_TOP, BRAND, INK, MARGIN, MUTED, RULE, StudioDoc, inline, rule

STUDIO_NAME = "Reactive Shots Studios"
STUDIO_EMAIL = "geeth@reactiveshots.com"
STUDIO_PHONE = "+1 (972) 829-5173"
STUDIO_SITE = "reactiveshots.com"

TEXT, ROW = 9.5, 4.9
FAINT_RULE = (228, 228, 228)
TINT = (234, 247, 255)


def day(d, short: bool = False) -> str:
    """"October 6, 2026", or "Oct 6, 2026"."""
    if not d:
        return ""
    if isinstance(d, str):
        d = date.fromisoformat(d)
    return f"{d.strftime('%b' if short else '%B')} {d.day}, {d.year}"


def _width(pdf: StudioDoc) -> float:
    return pdf.w - 2 * MARGIN


def _ensure(pdf: StudioDoc, h: float):
    if pdf.get_y() + h > pdf.page_break_trigger:
        pdf.add_page()


def _micro(pdf: StudioDoc, text: str, x: float, y: float, w: float, align: str = "L"):
    pdf.set_xy(x, y)
    pdf.set_font("Lato", "B", 7.5)
    pdf.set_text_color(*MUTED)
    pdf.set_char_spacing(0.8)
    pdf.cell(w, 4, text.upper(), align=align)
    pdf.set_char_spacing(0)
    pdf.set_text_color(*INK)


def _heading(pdf: StudioDoc, text: str, need: float = 30):
    _ensure(pdf, need)
    pdf.set_x(MARGIN)
    pdf.set_font("Lato", "B", 12)
    pdf.cell(0, 6, text, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)


def _table(pdf: StudioDoc, cols: list, rows: list):
    """cols: [(label, width, align)], a width of 0 takes what's left.
    rows: [[cell, ...]], a cell is text or (text, style, color)."""
    total = _width(pdf)
    widths = [w for _, w, _ in cols]
    widths = [w or total - sum(widths) for w in widths]
    # (x offset, usable width) per column; left columns after the first get a gutter
    boxes = [
        (2, w - 2) if align == "R" else ((3, w - 5) if i else (0, w - 2))
        for i, ((_, _, align), w) in enumerate(zip(cols, widths))
    ]
    _ensure(pdf, 8 + ROW * 2)
    top = pdf.get_y()
    x = MARGIN
    for (label, _, align), w, (dx, bw) in zip(cols, widths, boxes):
        _micro(pdf, label, x + dx, top, bw, align)
        x += w
    y = top + 6
    pdf.set_draw_color(*RULE)
    pdf.set_line_width(0.3)
    pdf.line(MARGIN, y, MARGIN + total, y)

    for row in rows:
        cells = [c if isinstance(c, tuple) else (c, "", INK) for c in row]
        lines = 1
        for (text, style, _), (_, bw) in zip(cells, boxes):
            pdf.set_font("Lato", style, TEXT)
            lines = max(lines, len(pdf.multi_cell(bw, ROW, text, dry_run=True, output=MethodReturnValue.LINES)))
        h = lines * ROW + 3.6
        if y + h > pdf.page_break_trigger:
            pdf.add_page()
            y = pdf.get_y()
        x = MARGIN
        for (text, style, color), (_, _, align), w, (dx, bw) in zip(cells, cols, widths, boxes):
            pdf.set_xy(x + dx, y + 1.8)
            pdf.set_font("Lato", style, TEXT)
            pdf.set_text_color(*color)
            pdf.multi_cell(bw, ROW, text, align=align)
            x += w
        pdf.set_text_color(*INK)
        y += h
        pdf.set_draw_color(*FAINT_RULE)
        pdf.set_line_width(0.25)
        pdf.line(MARGIN, y, MARGIN + total, y)
    pdf.set_xy(MARGIN, y)


def _title(pdf: StudioDoc, inv: dict):
    top = BODY_TOP
    pdf.set_xy(MARGIN, top)
    pdf.set_font("Lato", "B", 26)
    pdf.set_char_spacing(2)
    pdf.cell(100, 11, "INVOICE")
    pdf.set_char_spacing(0)
    pdf.set_xy(MARGIN, top + 12)
    pdf.set_font("Lato", "", 11)
    pdf.set_text_color(*MUTED)
    pdf.cell(100, 5.5, inv["number"])
    pdf.set_text_color(*INK)

    meta = [("Issue date", day(inv["issued"])), ("Booking", inv["booking_number"]), ("As of", day(inv["as_of"]))]
    right = MARGIN + _width(pdf)
    y = top + 1.5
    for label, value in meta:
        _micro(pdf, label, right - 78, y + 0.6, 30, "R")
        pdf.set_xy(right - 46, y)
        pdf.set_font("Lato", "", 10)
        pdf.cell(46, 5, value, align="R")
        y += 6
    pdf.set_y(top + 20)


def _parties(pdf: StudioDoc, inv: dict):
    gap = 8
    w = (_width(pdf) - 2 * gap) / 3
    top = pdf.get_y()
    client, event = inv["client"], inv["event"]
    times = " – ".join(t for t in (clock(event["start_time"]), clock(event["end_time"])) if t)
    columns = [
        ("From", [PHOTOGRAPHER, f"d/b/a {STUDIO_NAME}", STUDIO_EMAIL, STUDIO_PHONE, STUDIO_SITE]),
        ("Bill to", [client["name"], client["email"], client["phone"]]),
        ("Event", [event["type"], long_date(event["date"]), times, event["location"]]),
    ]
    bottom = top
    for i, (label, lines) in enumerate(columns):
        x = MARGIN + i * (w + gap)
        _micro(pdf, label, x, top, w)
        pdf.set_xy(x, top + 6)
        for j, line in enumerate(l for l in lines if l):
            link = f"https://{line}" if line == STUDIO_SITE else (f"mailto:{line}" if "@" in line else "")
            pdf.set_x(x)
            pdf.set_font("Lato", "B" if j == 0 else "", TEXT)
            pdf.set_text_color(*(BRAND if line == STUDIO_SITE else INK))
            pdf.multi_cell(w, ROW, line, align="L", link=link, new_x="LEFT", new_y="NEXT")
        pdf.set_text_color(*INK)
        bottom = max(bottom, pdf.get_y())
    pdf.set_y(bottom)


def _amount_row(pdf: StudioDoc, label: str, value: str, x: float, w: float, size: float = 10, bold=False):
    y = pdf.get_y()
    pdf.set_xy(x, y)
    pdf.set_font("Lato", "B" if bold else "", size)
    pdf.cell(w - 40, 7, label)
    pdf.cell(40, 7, value, align="R")
    pdf.set_xy(x, y + 7)


def _paid_stamp(pdf: StudioDoc, x: float, y: float, paid_on: Optional[date]):
    w, h = 62, 21
    with pdf.rotation(6, x + w / 2, y + h / 2):
        pdf.set_draw_color(*BRAND)
        pdf.set_line_width(0.7)
        pdf.rect(x, y, w, h)
        pdf.set_line_width(0.25)
        pdf.rect(x + 1.4, y + 1.4, w - 2.8, h - 2.8)
        pdf.set_text_color(*BRAND)
        pdf.set_font("Lato", "B", 15)
        pdf.set_char_spacing(1.6)
        pdf.set_xy(x, y + 4)
        pdf.cell(w, 8, "PAID IN FULL", align="C")
        pdf.set_char_spacing(0)
        pdf.set_font("Lato", "", 8)
        pdf.set_xy(x, y + 12)
        pdf.cell(w, 4.5, f"Thank you  ·  {day(paid_on)}" if paid_on else "Thank you", align="C")
        pdf.set_text_color(*INK)


def _how_to_pay(pdf: StudioDoc, inv: dict, x: float, y: float, w: float):
    _micro(pdf, "How to pay", x, y, w)
    lines = [
        f"**Zelle** to {ZELLE}",
        f"Memo: **{inv['memo']}**",
        f"**Cash** or **check** in person, with {inv['booking_number']} on the check's memo line",
    ]
    pdf.set_left_margin(x)
    pdf.set_right_margin(pdf.w - x - w)
    pdf.set_xy(x, y + 6)
    for line in lines:
        inline(pdf, line, size=TEXT, line_h=ROW)
        pdf.ln(ROW + 1.2)
    bottom = pdf.get_y()
    pdf.set_left_margin(MARGIN)
    pdf.set_right_margin(MARGIN)
    return bottom


def _balance(pdf: StudioDoc, inv: dict):
    """Amount paid and the balance due on the right; how to pay (or the
    paid-in-full stamp) beside it."""
    _ensure(pdf, 34)
    w = 82
    x = MARGIN + _width(pdf) - w
    top = pdf.get_y() + 4
    pdf.set_y(top)
    _amount_row(pdf, "Amount paid", dollars(inv["paid_cents"]), x, w)
    pdf.ln(1.5)

    balance = inv["balance_cents"]
    y = pdf.get_y()
    pdf.set_fill_color(*TINT)
    pdf.rect(x, y, w, 12, style="F")
    pdf.set_fill_color(*BRAND)
    pdf.rect(x, y, 0.9, 12, style="F")
    pdf.set_xy(x + 4, y + 2.5)
    pdf.set_font("Lato", "B", 11)
    pdf.cell(w - 46, 7, "Balance due")
    pdf.set_font("Lato", "B", 16)
    pdf.set_text_color(*(BRAND if balance > 0 else INK))
    pdf.cell(40, 7, dollars(balance), align="R")
    pdf.set_text_color(*INK)
    bottom = y + 12

    if balance > 0:
        bottom = max(bottom, _how_to_pay(pdf, inv, MARGIN, top + 1, _width(pdf) - w - 14))
    elif inv["status"] != "cancelled":
        _paid_stamp(pdf, MARGIN + 8, top - 1, inv.get("paid_on"))
    pdf.set_y(bottom + 5)


def _cancelled_note(pdf: StudioDoc, inv: dict):
    _ensure(pdf, 20)
    y = pdf.get_y()
    w = _width(pdf)
    pdf.set_draw_color(*RULE)
    pdf.set_line_width(0.3)
    pdf.rect(MARGIN, y, w, 15)
    pdf.set_xy(MARGIN + 5, y + 3)
    pdf.set_font("Lato", "B", 10)
    when = f" on {day(inv['cancelled_on'])}" if inv.get("cancelled_on") else ""
    pdf.cell(w - 10, 4.8, f"This booking was cancelled{when}.", new_x="LEFT", new_y="NEXT")
    pdf.set_font("Lato", "", TEXT)
    pdf.set_text_color(*MUTED)
    pdf.cell(w - 10, 4.8, "No further payments are due.")
    pdf.set_text_color(*INK)
    pdf.set_y(y + 19)


def render_invoice(inv: dict) -> bytes:
    """inv: the dict from the bookings router's _invoice()."""
    pdf = StudioDoc(f"Invoice {inv['number']}")
    pdf.add_page()
    _title(pdf, inv)
    rule(pdf, before=3, after=5)
    _parties(pdf, inv)
    rule(pdf, before=4, after=5)

    _table(pdf, [("Description", 0, "L"), ("Qty", 24, "R"), ("Rate", 30, "R"), ("Amount", 30, "R")], [
        [line["description"], line["qty"], dollars(line["rate_cents"]), dollars(line["amount_cents"])]
        for line in inv["lines"]
    ])
    pdf.ln(1)
    _amount_row(pdf, "Total", dollars(inv["total_cents"]), MARGIN + _width(pdf) - 82, 82, size=11, bold=True)
    pdf.ln(5)

    _heading(pdf, "Payments received")
    if inv["received"]:
        _table(pdf, [("Date", 36, "L"), ("Description", 0, "L"), ("Method", 30, "L"), ("Amount", 30, "R")], [
            [day(r["date"]), r["description"], r["method"], dollars(r["amount_cents"])] for r in inv["received"]
        ])
    else:
        pdf.set_font("Lato", "", TEXT)
        pdf.set_text_color(*MUTED)
        pdf.cell(0, 5, "No payments received yet.", new_x="LMARGIN", new_y="NEXT")
        pdf.set_text_color(*INK)
    _balance(pdf, inv)

    if inv["status"] == "cancelled":
        _cancelled_note(pdf, inv)
    elif inv["schedule"]:
        _heading(pdf, "Payment schedule", need=16 + 9 * len(inv["schedule"]))
        rows = []
        for s in inv["schedule"]:
            due = s["state"] == "due"
            rows.append([s["label"], dollars(s["amount_cents"]),
                         ("Due now", "B", BRAND) if due else ("Upcoming", "", MUTED), (s["when"], "", MUTED)])
        _table(pdf, [("Payment", 0, "L"), ("Amount", 28, "R"), ("Status", 26, "L"), ("When", 62, "L")], rows)

    # a sign-off alone on a new page looks like a mistake, so it only goes where it fits
    if pdf.get_y() + 12 <= pdf.page_break_trigger:
        pdf.ln(7)
        pdf.set_font("Lato", "I", TEXT)
        pdf.set_text_color(*MUTED)
        pdf.cell(0, 5, f"Thank you for choosing {STUDIO_NAME}.", align="C")
        pdf.set_text_color(*INK)
    return bytes(pdf.output())
