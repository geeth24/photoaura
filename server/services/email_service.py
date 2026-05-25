"""Transactional email via Resend (key from photoaura-secrets)."""

import os

import resend

from config import settings

resend.api_key = os.environ.get("RESEND_API_KEY", "")
# must be a domain verified on the Resend account the key belongs to.
# override with EMAIL_FROM to switch to a reactiveshots.com sender later.
FROM = os.environ.get("EMAIL_FROM", "Reactive Shots <noreply@contact.geeth.co>")
CLIENT_URL = getattr(settings, "NEXT_PUBLIC_CLIENT_URL", None) or os.environ.get(
    "NEXT_PUBLIC_CLIENT_URL", "https://aura.reactiveshots.com"
)


def _shell(title: str, body_html: str) -> str:
    return f"""
    <div style="background:#0a0e14;padding:40px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
      <div style="max-width:480px;margin:0 auto;background:#0f141c;border:1px solid #1c2430">
        <div style="padding:32px 32px 8px">
          <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#00a6fb;font-weight:600">Reactive Shots</div>
          <h1 style="font-size:24px;color:#f4f6f8;margin:16px 0 0;font-weight:600">{title}</h1>
        </div>
        <div style="padding:8px 32px 32px;color:#aab3bf;font-size:15px;line-height:1.7">
          {body_html}
        </div>
      </div>
      <div style="max-width:480px;margin:16px auto 0;color:#5b6675;font-size:11px;text-align:center">
        Reactive Shots · Dallas–Fort Worth
      </div>
    </div>
    """


def _button(href: str, label: str) -> str:
    return (
        f'<a href="{href}" style="display:inline-block;background:#00a6fb;color:#0a0e14;'
        f'text-decoration:none;font-weight:700;font-size:12px;letter-spacing:1.5px;'
        f'text-transform:uppercase;padding:14px 28px;margin:8px 0">{label}</a>'
    )


def _send(to_email: str, subject: str, html: str) -> bool:
    if not resend.api_key:
        print("RESEND_API_KEY not set — skipping email to", to_email)
        return False
    try:
        resend.Emails.send(
            {"from": FROM, "to": [to_email], "subject": subject, "html": html}
        )
        return True
    except Exception as e:  # never let email failure break the request
        print("resend error:", e)
        return False


def send_login_link(to_email: str, full_name: str, link: str) -> bool:
    name = (full_name or "there").split(" ")[0]
    body = (
        f"<p>Hi {name},</p>"
        "<p>Here's your secure link to sign in to your gallery. It expires in 30 minutes.</p>"
        f"<p>{_button(link, 'Sign in')}</p>"
        "<p style='font-size:12px;color:#5b6675'>If you didn't request this, you can ignore it.</p>"
    )
    return _send(to_email, "Your Reactive Shots login link", _shell("Sign in", body))


def send_invite(to_email: str, full_name: str, link: str, album_name: str) -> bool:
    name = (full_name or "there").split(" ")[0]
    body = (
        f"<p>Hi {name},</p>"
        f"<p>Your gallery <strong style='color:#f4f6f8'>{album_name}</strong> is ready to view. "
        "Click below to open it — no password needed.</p>"
        f"<p>{_button(link, 'View your gallery')}</p>"
        "<p style='font-size:12px;color:#5b6675'>This link signs you in. It's just for you.</p>"
    )
    return _send(
        to_email, f"Your gallery is ready — {album_name}", _shell("Your gallery is ready", body)
    )
