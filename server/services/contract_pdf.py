"""Signed-contract PDF: the contract markdown, a signature block and an
e-signature audit trail. Core Helvetica only, so the slim image needs no fonts."""

import re
from datetime import datetime
from typing import Optional

from fpdf import FPDF

from services.booking_service import CONSENT_TEXT, LOGO_PATH, PHOTOGRAPHER, long_date

INK = (28, 28, 30)
MUTED = (110, 110, 115)
RULE = (215, 215, 220)
_BOLD = re.compile(r"\*\*(.+?)\*\*")


def _safe(text: str) -> str:
    # core fonts are cp1252; anything outside it (e.g. a name in another script) degrades to "?"
    return (text or "").encode("cp1252", "replace").decode("cp1252")


class _Doc(FPDF):
    def __init__(self, number: str):
        super().__init__(format="letter")
        self.core_fonts_encoding = "windows-1252"
        self.number = number
        self.set_margins(22, 20, 22)
        self.set_auto_page_break(True, margin=20)
        self.alias_nb_pages()

    def footer(self):
        self.set_y(-14)
        self.set_font("helvetica", size=8)
        self.set_text_color(*MUTED)
        self.cell(0, 5, f"Reactive Shots Studios  |  {self.number}", align="L")
        self.set_x(self.l_margin)
        self.cell(0, 5, f"Page {self.page_no()} of {{nb}}", align="R")


def _inline(pdf: _Doc, text: str, size: float, line_h: float):
    """Write text with **bold** runs, wrapping at the current left margin."""
    pos = 0
    for m in _BOLD.finditer(text):
        if m.start() > pos:
            pdf.set_font("helvetica", "", size)
            pdf.write(line_h, _safe(text[pos:m.start()]))
        pdf.set_font("helvetica", "B", size)
        pdf.write(line_h, _safe(m.group(1)))
        pos = m.end()
    if pos < len(text):
        pdf.set_font("helvetica", "", size)
        pdf.write(line_h, _safe(text[pos:]))
    pdf.set_font("helvetica", "", size)


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


def _bullet(pdf: _Doc, mark: str, text: str, indent: float, size: float, line_h: float):
    left = pdf.l_margin
    pdf.set_x(left + indent)
    pdf.set_font("helvetica", "", size)
    pdf.cell(5, line_h, mark)
    pdf.set_left_margin(left + indent + 5)
    pdf.set_x(left + indent + 5)
    _inline(pdf, text, size, line_h)
    pdf.set_left_margin(left)
    pdf.ln(line_h + 1.2)


def _header(pdf: _Doc):
    try:
        pdf.image(LOGO_PATH, x=pdf.l_margin, y=14, w=13, h=13)
    except Exception:
        pass
    pdf.set_xy(pdf.l_margin + 16, 15)
    pdf.set_font("helvetica", "B", 11)
    pdf.set_text_color(*INK)
    pdf.cell(0, 5, "Reactive Shots Studios")
    pdf.set_xy(pdf.l_margin + 16, 20.5)
    pdf.set_font("helvetica", "", 8.5)
    pdf.set_text_color(*MUTED)
    pdf.cell(0, 4, "reactiveshots.com")
    pdf.set_xy(pdf.l_margin, 17)
    pdf.set_font("helvetica", "", 9)
    pdf.cell(0, 5, f"Booking {pdf.number}", align="R")
    pdf.set_draw_color(*RULE)
    pdf.line(pdf.l_margin, 31, pdf.w - pdf.r_margin, 31)
    pdf.set_y(37)
    pdf.set_text_color(*INK)


def _kv(pdf: _Doc, rows, label_w: float = 42):
    for label, value in rows:
        pdf.set_font("helvetica", "B", 8.5)
        pdf.set_text_color(*MUTED)
        y = pdf.get_y()
        pdf.set_x(pdf.l_margin)
        pdf.cell(label_w, 4.6, _safe(label))
        pdf.set_font("helvetica", "", 8.5)
        pdf.set_text_color(*INK)
        pdf.set_xy(pdf.l_margin + label_w, y)
        pdf.multi_cell(0, 4.6, _safe(value or "-"), new_x="LMARGIN", new_y="NEXT")
        pdf.ln(0.6)


def _utc(dt: Optional[datetime]) -> str:
    return dt.strftime("%Y-%m-%d %H:%M:%S UTC") if dt else "-"


def render_pdf(booking, markdown: str, client_name: str, client_email: str) -> bytes:
    pdf = _Doc(booking.number)
    pdf.add_page()
    _header(pdf)

    body, line_h = 9.5, 4.9
    for kind, text in _blocks(markdown):
        if kind == "title":
            pdf.set_font("helvetica", "B", 14)
            pdf.multi_cell(0, 7, _safe(text), align="C", new_x="LMARGIN", new_y="NEXT")
            pdf.ln(4)
        elif kind == "heading":
            if pdf.get_y() > pdf.h - 45:
                pdf.add_page()
            pdf.ln(2.5)
            pdf.set_font("helvetica", "B", 11)
            pdf.multi_cell(0, 6, _safe(text), new_x="LMARGIN", new_y="NEXT")
            pdf.ln(1.5)
        elif kind == "bullet":
            _bullet(pdf, "\u2022", text, 1.5, body, line_h)
        elif kind == "sub":
            _bullet(pdf, "\u2013", text, 7, body, line_h)
        else:
            pdf.set_x(pdf.l_margin)
            for i, line in enumerate(text.split("\n")):
                if i:
                    pdf.ln(line_h)
                _inline(pdf, line, body, line_h)
            pdf.ln(line_h + 2.5)

    # signature block
    if pdf.get_y() > pdf.h - 80:
        pdf.add_page()
    pdf.ln(4)
    col_w = (pdf.w - pdf.l_margin - pdf.r_margin - 10) / 2
    top = pdf.get_y()
    signed = bool(booking.signed_at)
    for i, (role, signature, name, line) in enumerate([
        ("Photographer", PHOTOGRAPHER if booking.sent_at else "",
         f"{PHOTOGRAPHER}, d/b/a Reactive Shots Studios",
         f"Signed electronically on {long_date(booking.sent_at.date())}" if booking.sent_at else "Not yet sent"),
        ("Client", booking.signed_name if signed else "",
         booking.signed_name if signed else client_name,
         f"Signed electronically on {long_date(booking.signed_at.date())}" if signed else "Awaiting signature"),
    ]):
        x = pdf.l_margin + i * (col_w + 10)
        pdf.set_xy(x, top)
        pdf.set_font("helvetica", "B", 8.5)
        pdf.set_text_color(*MUTED)
        pdf.cell(col_w, 5, role.upper())
        pdf.set_xy(x, top + 7)
        pdf.set_font("times", "I", 17)
        pdf.set_text_color(*INK)
        pdf.cell(col_w, 9, _safe(signature))
        pdf.set_draw_color(*RULE)
        pdf.line(x, top + 17, x + col_w, top + 17)
        pdf.set_xy(x, top + 19)
        pdf.set_font("helvetica", "", 8.5)
        pdf.cell(col_w, 4.5, _safe(name or ""))
        pdf.set_xy(x, top + 23.5)
        pdf.set_text_color(*MUTED)
        pdf.cell(col_w, 4.5, _safe(line))
    pdf.set_text_color(*INK)
    pdf.set_y(top + 34)

    # audit trail
    if pdf.get_y() > pdf.h - 75:
        pdf.add_page()
    pdf.set_draw_color(*RULE)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
    pdf.ln(4)
    pdf.set_font("helvetica", "B", 10)
    pdf.cell(0, 5, "Electronic signature audit trail", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
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
