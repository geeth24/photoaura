# PhotoAura

A studio-grade photo gallery for working photographers — upload an album, faces are detected automatically, clients get a one-click magic-link to view and download only their photos.

## What it does

### For the photographer
- **Drag-and-drop uploads** for photos *and* video clips into the same album, with live progress (uploading → saving → detecting faces → optimizing).
- **Faces, automatically.** Every album shows the distinct people in it; pick the best front-facing shot of each person as their thumbnail.
- **Justified masonry + lightbox** — clean rows at true aspect ratios, instant blur placeholder, smooth left/right slide between photos, video plays inline.
- **Invite a client in two clicks** — name + email on the album → they get a branded email with a one-click sign-in link. Done.
- **Admin dashboard** for albums, the Photos library, Faces across all shoots, the public site categories, and users.

### For the client
- **Magic-link sign-in** — no password to remember; click the link in your email, you're in.
- **Only your gallery, read-only.** Browse the full shoot: photos, clips, and the People row to find yourself across the album.
- **One-click downloads** from the lightbox — the raw original photo, or the video file.
- **Multiple email addresses on one account** — link work/personal/etc. from your profile; either email signs you into the same account.

### For the public site
The brand site at `reactiveshots.com` shows the photographer's portfolio pulled from the same gallery — featured shoots, justified rows, fast everywhere.

## Built with

FastAPI · Next.js 16 · React 19 · SQLAlchemy + Alembic · AWS S3 · CloudFront image transforms · AWS Rekognition · Resend + React Email · motion/react

## Apps in the repo

- `server/` — the FastAPI API (albums, faces, uploads, auth, clients)
- `client/` — the Next.js admin + client portal
- `client/src/emails/` — React Email templates
- `ios/` — iOS app
- `marketing/` — marketing site

That's the gist. PhotoAura is the studio engine; **Reactive Shots** is what clients see.
