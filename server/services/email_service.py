"""Transactional email via Resend.

Templates live in the Next client as React Email — we POST to the client's
/api/email/render to get pre-rendered HTML, then send via Resend from here so
the Resend key stays in the backend.
"""

import os
from typing import Optional

import requests
import resend

resend.api_key = os.environ.get("RESEND_API_KEY", "")

FROM = os.environ.get("EMAIL_FROM", "Reactive Shots <noreply@mail.reactiveshots.com>")
CLIENT_URL = os.environ.get("NEXT_PUBLIC_CLIENT_URL", "https://aura.reactiveshots.com")
RENDER_URL = f"{CLIENT_URL.rstrip('/')}/api/email/render"
RENDER_SECRET = os.environ.get("EMAIL_RENDER_SECRET", "")


def _render(template: str, props: dict) -> Optional[dict]:
    """Ask the Next render API for {subject, html}. Returns None on failure."""
    if not RENDER_SECRET:
        print("EMAIL_RENDER_SECRET not set — skipping render")
        return None
    try:
        r = requests.post(
            RENDER_URL,
            json={"template": template, "props": props},
            headers={"x-email-secret": RENDER_SECRET},
            timeout=10,
        )
        if r.status_code != 200:
            print(f"render {template} -> {r.status_code} {r.text[:200]}")
            return None
        return r.json()
    except Exception as e:
        print("render error:", e)
        return None


def _send(to_email: str, subject: str, html: str) -> bool:
    if not resend.api_key:
        print("RESEND_API_KEY not set — skipping email to", to_email)
        return False
    try:
        resend.Emails.send(
            {"from": FROM, "to": [to_email], "subject": subject, "html": html}
        )
        return True
    except Exception as e:
        print("resend error:", e)
        return False


def send_login_link(to_email: str, full_name: str, link: str) -> bool:
    payload = _render("login-link", {"fullName": full_name, "link": link})
    if not payload:
        return False
    return _send(to_email, payload["subject"], payload["html"])


def send_invite(to_email: str, full_name: str, link: str, album_name: str) -> bool:
    payload = _render(
        "client-invite",
        {"fullName": full_name, "link": link, "albumName": album_name},
    )
    if not payload:
        return False
    return _send(to_email, payload["subject"], payload["html"])


def send_verify_email(to_email: str, full_name: str, link: str) -> bool:
    payload = _render("verify-email", {"fullName": full_name, "link": link})
    if not payload:
        return False
    return _send(to_email, payload["subject"], payload["html"])
