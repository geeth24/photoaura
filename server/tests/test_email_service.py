from services import email_service


class _Rendered:
    status_code = 200

    def __init__(self, body):
        self._body = body

    def json(self):
        return self._body


def _capture(monkeypatch, rendered):
    sent = []
    monkeypatch.setattr(email_service.resend, "api_key", "re_test")
    monkeypatch.setattr(email_service, "RENDER_SECRET", "test-secret")
    monkeypatch.setattr(email_service.requests, "post", lambda *a, **k: _Rendered(rendered))
    monkeypatch.setattr(email_service.resend.Emails, "send", lambda payload: sent.append(payload))
    return sent


def test_sends_text_part_and_reply_to(monkeypatch):
    sent = _capture(monkeypatch, {"subject": "Hi", "html": "<p>Hi</p>", "text": "Hi"})
    monkeypatch.setattr(email_service, "REPLY_TO", "studio@example.com")
    monkeypatch.setattr(email_service, "BCC", ["records@example.com"])

    pdf = [{"filename": "RS-1042-agreement.pdf", "content": b"%PDF"}]
    assert email_service.send_template("client@example.com", "booking-signed", {}, pdf)

    payload = sent[0]
    assert payload["subject"] == "Hi"
    assert payload["html"] == "<p>Hi</p>"
    assert payload["text"] == "Hi"
    assert payload["reply_to"] == "studio@example.com"
    assert payload["bcc"] == ["records@example.com"]
    assert payload["attachments"][0]["filename"] == "RS-1042-agreement.pdf"


def test_older_render_without_text_still_sends(monkeypatch):
    sent = _capture(monkeypatch, {"subject": "Hi", "html": "<p>Hi</p>"})
    monkeypatch.setattr(email_service, "REPLY_TO", "")

    assert email_service.send_login_link("client@example.com", "Jordan Ellis", "https://example.com/l")

    assert "text" not in sent[0]
    assert "reply_to" not in sent[0]
