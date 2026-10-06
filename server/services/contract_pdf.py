"""Signed-contract PDF laid out like the studio's own agreement: centred RS logo
on every page, Lato, numbered sections between grey rules, then the signature
block and an e-signature audit trail."""

import re
from datetime import datetime
from typing import Optional

from services.booking_service import CONSENT_TEXT, PHOTOGRAPHER, long_date
from services.studio_pdf import BODY, BRAND, INK, LINE, MARGIN, MUTED, StudioDoc, inline, rule

BULLET_GLYPH, BULLET_TEXT = 6.35, 12.7  # 0.25" glyph, 0.5" text, as in the document
SUB_GLYPH, SUB_TEXT = 19.05, 25.4


def _blocks(markdown: str):
    """(kind, text) blocks: title, heading, bullet, sub, para (lines joined by \\n)."""
    out, para = [], []

    def flush():
        if para:
            out.append(("para", "\n".join(para)))
            para.clear()

    for line in markdown.splitlines():
        if not line.strip():
            flush()
        elif line.startswith("# "):
            flush()
            out.append(("title", line[2:].strip()))
        elif line.startswith("## "):
            flush()
            out.append(("heading", line[3:].strip()))
        elif re.match(r"^\s{2,}- ", line):
            flush()
            out.append(("sub", line.strip()[2:]))
        elif line.startswith("- "):
            flush()
            out.append(("bullet", line[2:]))
        else:
            para.append(line.rstrip())
    flush()
    return out


def _bullet(pdf: StudioDoc, text: str, sub: bool):
    glyph_x, text_x = (SUB_GLYPH, SUB_TEXT) if sub else (BULLET_GLYPH, BULLET_TEXT)
    if pdf.get_y() > pdf.h - MARGIN - LINE * 2:
        pdf.add_page()
    y = pdf.get_y()
    # drawn rather than typed: Lato has no ● / ○ glyphs
    r = 0.85
    cx, cy = MARGIN + glyph_x + r, y + LINE / 2
    pdf.set_draw_color(*INK)
    pdf.set_fill_color(*INK)
    pdf.set_line_width(0.2)
    pdf.ellipse(cx - r, cy - r, r * 2, r * 2, style="D" if sub else "F")
    pdf.set_left_margin(MARGIN + text_x)
    pdf.set_xy(MARGIN + text_x, y)
    inline(pdf, text)
    pdf.set_left_margin(MARGIN)
    pdf.ln(LINE)
    pdf.ln(LINE * 0.75)  # the original leaves a blank line after each item


def _para_line(pdf: StudioDoc, line: str):
    if "d/b/a Reactive Shots Studios" in line:
        # the studio line is blue in the original, with the site underlined
        head, _, site = line.partition("|")
        pdf.set_text_color(*BRAND)
        pdf.set_font("Lato", "B", BODY)
        pdf.write(LINE, head.strip() + " | ")
        pdf.set_font("Lato", "BU", BODY)
        pdf.write(LINE, site.strip(), link="https://" + site.strip())
        pdf.set_text_color(*INK)
        pdf.set_font("Lato", "", BODY)
        return
    if line.startswith("Email: ") and "| Phone:" in line:
        email, _, phone = line[len("Email: "):].partition("| Phone:")
        email, phone = email.strip(), phone.strip()
        pdf.set_font("Lato", "", BODY)
        pdf.write(LINE, "Email: ")
        pdf.set_font("Lato", "U", BODY)
        pdf.write(LINE, email, link="mailto:" + email)
        pdf.set_font("Lato", "B", BODY)
        pdf.write(LINE, "  |  ")
        pdf.set_font("Lato", "", BODY)
        pdf.write(LINE, "Phone: ")
        pdf.set_font("Lato", "U", BODY)
        pdf.write(LINE, phone, link="tel:" + re.sub(r"[^\d+]", "", phone))
        pdf.set_font("Lato", "", BODY)
        return
    inline(pdf, line)


def _kv(pdf: StudioDoc, rows, label_w: float = 40):
    for label, value in rows:
        y = pdf.get_y()
        pdf.set_x(pdf.l_margin)
        pdf.set_font("Lato", "B", 8.5)
        pdf.set_text_color(*MUTED)
        pdf.cell(label_w, 4.6, label)
        pdf.set_font("Lato", "", 8.5)
        pdf.set_text_color(*INK)
        pdf.set_xy(pdf.l_margin + label_w, y)
        pdf.multi_cell(0, 4.6, value or "-", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(0.8)


def _utc(dt: Optional[datetime]) -> str:
    return dt.strftime("%Y-%m-%d %H:%M:%S UTC") if dt else "-"


def _signatures(pdf: StudioDoc, booking, client_name: str):
    if pdf.get_y() > pdf.h - MARGIN - 34:
        pdf.add_page()
    signed = bool(booking.signed_at)
    col_w = (pdf.w - 2 * MARGIN - 12) / 2
    top = pdf.get_y()
    cols = [
        ("Photographer Signature:", PHOTOGRAPHER if booking.sent_at else "",
         long_date(booking.sent_at.date()) if booking.sent_at else ""),
        ("Client Signature:", booking.signed_name if signed else "",
         long_date(booking.signed_at.date()) if signed else ""),
    ]
    for i, (label, signature, date) in enumerate(cols):
        x = MARGIN + i * (col_w + 12)
        pdf.set_xy(x, top)
        pdf.set_font("Lato", "B", BODY)
        pdf.cell(col_w, LINE, label)
        pdf.set_xy(x, top + 7)
        pdf.set_font("Lato", "I", 18)
        pdf.cell(col_w, 9, signature or "")
        pdf.set_draw_color(*INK)
        pdf.set_line_width(0.25)
        pdf.line(x, top + 17, x + col_w, top + 17)
        pdf.set_xy(x, top + 19)
        pdf.set_font("Lato", "B", BODY)
        pdf.write(LINE, "Date: ")
        pdf.set_font("Lato", "", BODY)
        pdf.write(LINE, date or "")
        pdf.set_xy(x, top + 25)
        pdf.set_font("Lato", "", 8.5)
        pdf.set_text_color(*MUTED)
        note = "Signed electronically" if signature else ("Awaiting signature" if i else "Not yet sent")
        pdf.cell(col_w, 4.5, note)
        pdf.set_text_color(*INK)
    pdf.set_y(top + 33)


def render_pdf(booking, markdown: str, client_name: str, client_email: str) -> bytes:
    pdf = StudioDoc(f"Booking {booking.number}")
    pdf.add_page()
    first_heading = True

    for kind, text in _blocks(markdown):
        if kind == "title":
            pdf.set_font("Lato", "B", 13)
            pdf.multi_cell(0, 7, text, align="C", new_x="LMARGIN", new_y="NEXT")
            pdf.ln(4)
        elif kind == "heading":
            # every section sits between grey rules, like the original
            # the signatures section keeps its signature block on the same page
            need = 80 if "Signatures" in text else 35
            if pdf.get_y() > pdf.h - MARGIN - need:
                pdf.add_page()
            else:
                rule(pdf, before=1 if first_heading else 2, after=6)
            first_heading = False
            pdf.set_font("Lato", "B", 13)
            pdf.multi_cell(0, 6.5, text, new_x="LMARGIN", new_y="NEXT")
            pdf.ln(3)
        elif kind in ("bullet", "sub"):
            _bullet(pdf, text, sub=kind == "sub")
        else:
            pdf.set_x(pdf.l_margin)
            for i, line in enumerate(text.split("\n")):
                if i:
                    pdf.ln(LINE)
                _para_line(pdf, line)
            pdf.ln(LINE + 3.5)

    rule(pdf, before=0, after=6)
    _signatures(pdf, booking, client_name)

    # audit trail on its own section so the agreement itself reads like the original
    if pdf.get_y() > pdf.h - MARGIN - 70:
        pdf.add_page()
    rule(pdf, before=4, after=5)
    pdf.set_font("Lato", "B", 11)
    pdf.cell(0, 6, "Electronic signature record", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    signed = bool(booking.signed_at)
    _kv(pdf, [
        ("Booking number", booking.number),
        ("Contract version", booking.signed_version or booking.contract_version),
        ("Document SHA-256", booking.signed_hash or booking.contract_hash),
        ("Sent to client", _utc(booking.sent_at)),
        ("Signed by", f"{booking.signed_name} <{client_email}>" if signed else "-"),
        ("Signed at", _utc(booking.signed_at)),
        ("IP address", booking.signed_ip if signed else "-"),
        ("User agent", booking.signed_user_agent if signed else "-"),
        ("Consent", (booking.signed_consent or CONSENT_TEXT) if signed else "-"),
    ])
    return bytes(pdf.output())
