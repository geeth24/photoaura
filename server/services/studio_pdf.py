"""The studio's paper look, shared by the agreement and the invoice: US Letter
with 1" margins, Lato, the centred RS logo on every page, grey rules and a
small page footer."""

import os
import re

from fpdf import FPDF

from services.booking_service import LOGO_PATH

FONTS = os.path.join(os.path.dirname(LOGO_PATH), "fonts")
INK = (0, 0, 0)
MUTED = (105, 105, 110)
BRAND = (0, 166, 251)
RULE = (200, 200, 200)
_BOLD = re.compile(r"\*\*(.+?)\*\*")

MARGIN = 25.4  # 1 inch, like the Word original
BODY_TOP = 46.0  # below the header logo
BODY, LINE = 11, 5.3


class StudioDoc(FPDF):
    def __init__(self, footer_label: str):
        super().__init__(format="letter", unit="mm")
        for style, name in (("", "Regular"), ("B", "Bold"), ("I", "Italic"), ("BI", "BoldItalic")):
            self.add_font("Lato", style, os.path.join(FONTS, f"Lato-{name}.ttf"))
        self.footer_label = footer_label
        self.set_margins(MARGIN, BODY_TOP, MARGIN)
        self.set_auto_page_break(True, margin=MARGIN)
        self.alias_nb_pages()

    def header(self):
        size = 24.9  # the logo is 0.98" square in the Word header
        try:
            self.image(LOGO_PATH, x=(self.w - size) / 2, y=12.7, w=size, h=size)
        except Exception:
            pass
        self.set_y(BODY_TOP)

    def footer(self):
        self.set_y(-14)
        self.set_font("Lato", "", 8)
        self.set_text_color(*MUTED)
        self.cell(0, 4, f"{self.footer_label}  ·  Page {self.page_no()} of {{nb}}", align="C")
        self.set_text_color(*INK)


def inline(pdf: FPDF, text: str, size: float = BODY, line_h: float = LINE, bold_all: bool = False):
    """Write text with **bold** runs, wrapping at the current left margin."""
    pos = 0
    base = "B" if bold_all else ""
    for m in _BOLD.finditer(text):
        if m.start() > pos:
            pdf.set_font("Lato", base, size)
            pdf.write(line_h, text[pos:m.start()])
        pdf.set_font("Lato", "B", size)
        pdf.write(line_h, m.group(1))
        pos = m.end()
    if pos < len(text):
        pdf.set_font("Lato", base, size)
        pdf.write(line_h, text[pos:])
    pdf.set_font("Lato", "", size)


def rule(pdf: FPDF, before: float = 4, after: float = 5):
    pdf.ln(before)
    y = pdf.get_y()
    pdf.set_draw_color(*RULE)
    pdf.set_line_width(0.35)
    pdf.line(pdf.l_margin, y, pdf.w - pdf.r_margin, y)
    pdf.ln(after)
