"""Promote a Play release from one track to another (e.g. alpha -> production).

    python3 play-promote.py <package> <from-track> <to-track> [version-code]

Uses the same service account the upload step uses. Stdlib + openssl only, so
the runner needs nothing installed. Without a version code, the newest release
on the source track is promoted. PLAY_RELEASE_NOTES (en-US) replaces the
release's notes; internal uploads carry none.
"""
import base64
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

SCOPE = "https://www.googleapis.com/auth/androidpublisher"


def b64url(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def access_token(sa: dict) -> str:
    now = int(time.time())
    header = b64url(json.dumps({"alg": "RS256", "typ": "JWT"}).encode())
    claims = b64url(json.dumps({"iss": sa["client_email"], "scope": SCOPE, "aud": sa["token_uri"], "iat": now, "exp": now + 600}).encode())
    signing = f"{header}.{claims}".encode()
    with tempfile.NamedTemporaryFile("w", suffix=".pem") as key, tempfile.NamedTemporaryFile() as data:
        key.write(sa["private_key"]); key.flush()
        data.write(signing); data.flush()
        sig = subprocess.check_output(["openssl", "dgst", "-sha256", "-sign", key.name, data.name])
    body = f"grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion={header}.{claims}.{b64url(sig)}".encode()
    with urllib.request.urlopen(urllib.request.Request(sa["token_uri"], data=body, headers={"Content-Type": "application/x-www-form-urlencoded"})) as r:
        return json.load(r)["access_token"]


def call(token: str, method: str, url: str, body=None) -> dict:
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raise SystemExit(f"{method} {url} -> {e.code}: {e.read().decode()[:600]}") from e


def main() -> None:
    package, src, dst = sys.argv[1:4]
    wanted = sys.argv[4] if len(sys.argv) > 4 else None
    sa = json.loads(os.environ["PLAY_SERVICE_ACCOUNT_JSON"])
    token = access_token(sa)
    base = f"https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{package}"

    edit = call(token, "POST", f"{base}/edits")["id"]
    track = call(token, "GET", f"{base}/edits/{edit}/tracks/{src}")
    releases = track.get("releases", [])
    release = next((r for r in releases if wanted in r.get("versionCodes", [])), None) if wanted else (releases[0] if releases else None)
    if not release:
        raise SystemExit(f"no release on {src}" + (f" with version code {wanted}" if wanted else ""))
    codes = release["versionCodes"]
    current = call(token, "GET", f"{base}/edits/{edit}/tracks/{dst}").get("releases", [])
    print(f"{dst} had: " + (", ".join(f"{r.get('versionCodes')} ({r.get('name', '?')}, {r.get('status')})" for r in current) or "nothing"), flush=True)
    print(f"promoting {codes} ({release.get('name', '?')}) {src} -> {dst}", flush=True)

    notes = os.environ.get("PLAY_RELEASE_NOTES", "").strip()
    if len(notes) > 500:
        raise SystemExit(f"release notes are {len(notes)} characters; Play allows 500")
    release_notes = [{"language": "en-US", "text": notes}] if notes else release.get("releaseNotes", [])
    call(token, "PUT", f"{base}/edits/{edit}/tracks/{dst}", {
        "track": dst,
        "releases": [{"versionCodes": codes, "status": "completed", "releaseNotes": release_notes}],
    })
    call(token, "POST", f"{base}/edits/{edit}:commit")
    print(f"{dst} now carries {codes}", flush=True)


if __name__ == "__main__":
    main()
