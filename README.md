# PhotoAura

A studio-grade photo gallery for working photographers — upload an album, faces are detected automatically, clients get a one-click magic-link to view (and download) only their photos.

Runs as a small services stack: a FastAPI backend on k3s next to its database, a Next.js admin/client portal on Vercel, photos in S3 served through a CloudFront image-transform CDN, and Rekognition for faces.

## What you can do

### Galleries
- **Mixed-media albums** — photos *and* video clips in the same album, played in the same lightbox.
- **Justified masonry** — rows fill the width at each image's true aspect ratio (computed from stored width/height, no measuring).
- **Lightbox** — direction-aware spring slide, an instant baked-in `blurDataURL`, then the warmed full-res fades in. Arrow keys + on-screen prev/next. Download button (raw original for photos, the file for videos).
- **People carousel** — every album shows the distinct people detected inside it; click a face to filter the grid to just their photos, click again to clear.
- **Best key-photo** — Rekognition + a custom score (size + frontalness + sharpness + eyes-open) picks the cleanest head-on crop as each person's thumbnail; the best crop wins across uploads.

### Uploads
- **Drag-and-drop onto the album page** or the dialog. Image *and* video files (`image/*`, `video/*`).
- **Live, locked progress** — Uploading → Saving → Detecting faces → Optimizing images → Done. Modal can't be closed mid-run; numbers are real.
- **EXIF orientation baked into originals** so the bare `/fit-in/` CDN URL serves portraits upright (no client-side trickery needed).
- **CDN warming on upload** — every size the apps actually request (`640/750/1920/2048` + `fit-in/720x0`, `fit-in/1920x0`) is pre-generated, so first view is a CloudFront cache hit, not a cold Lambda render. Backend warmer and client loader emit byte-identical compact JSON so the keys match.

### Client portal
- **Magic-link sign-in** — admin and client alike; password is still a fallback.
- **Roles** — admin sees everything; clients see only their assigned album(s), read-only, plus a profile page. Hard-gated by middleware and in the UI.
- **Invite-client flow** — admin opens an album → "Invite client" → name + email → backend creates the client, grants the album, and emails a one-click link from `noreply@inquiry.reactiveshots.com`.
- **Multi-email linking** — a user can link several email addresses to one account, each independently verified. Magic-link login resolves any verified address back to the same account. Add/remove from the profile page.

### Faces
- AWS Rekognition collection, frontal-pose filter (`yaw/pitch ≤ 45`, no broken bounding-box-fraction check), match threshold `80`. Face crops served via a small thumbor URL so the loader can resize them. Detection happens off the event loop with live progress.

### Public site
The brand site at `reactiveshots.com` (separate repo) consumes the same API — same albums, same images, same `aura-cdn`. Gallery loading is the Flickr-style justified rows with the React Email–styled inbox emails on the studio side.

## Architecture

```
+----------------------+     +-------------------+     +---------------------+
|  Next admin/client   |     | reactive-shots-v3 |     |  iOS (separate)     |
|  (Vercel)            |     |  (Vercel)         |     |                     |
+----------+-----------+     +---------+---------+     +----------+----------+
           |                           |                          |
           v                           v                          v
                  https://aura-api.reactiveshots.com (FastAPI, k3s)
                                 |
            +--------------------+--------------------+
            |                    |                    |
            v                    v                    v
       Postgres            S3 (photoaura/)         Rekognition
       (in-cluster)         + CloudFront + SIH      collection
                            (aura-cdn — image       "photoaura"
                             transforms,
                             AutoWebP, warmed)

Email: Resend (sent from FastAPI; HTML rendered by the Next client's
       /api/email/render endpoint from React Email templates)
```

- **Backend** lives on k3s at home (no upload bandwidth or egress charges; S3 is in AWS so puts are fast/free). The DB sits next to it.
- **Frontend** on Vercel for CDN, easy preview deploys, and React Email rendering.
- **Photos and videos** live in S3 directly; images go through SIH for resize/WebP/EXIF auto-orient at the edge.
- **Emails** are templated as React (`@react-email/components`), rendered to HTML by a small Next route, then sent from the backend via Resend so the Resend key stays in k8s. A shared `EMAIL_RENDER_SECRET` protects the render endpoint.

## Built with

- **Backend:** FastAPI · SQLAlchemy 2.0 ORM · Alembic · `resend` (Python) · `boto3`
- **Frontend:** Next.js 16 (App Router, custom `next/image` loader) · React 19 · motion/react · base-ui shadcn · React Email
- **Storage / media:** AWS S3 · CloudFront · **SIH v8** ("Dynamic Image Transformation for CloudFront") · `jpegtran` (lossless EXIF rotation on ingest)
- **Faces:** AWS Rekognition
- **Email:** Resend (verified domain) + React Email templates
- **Deploy:** centralized `Rad-Soft/argocd` repo, k3s on Proxmox, Vercel for the clients

## Repo layout

```
photoaura/
├── server/                FastAPI app
│   ├── routers/           HTTP routes (auth, files, album, category, faces, video, user, websocket)
│   ├── services/          email, AWS, gemini, cdn warming
│   ├── utils/             face detection scoring, file metadata, blur generation
│   ├── db/                ORM models, session, migrate runner
│   └── alembic/           migrations (current head: 0007 multi-email)
├── client/                Next.js admin + client portal
│   ├── src/app/           routes ((dashboard) for the app, login, auth/verify)
│   ├── src/components/    masonry, lightboxes, faces carousel, dialogs, sidebar
│   ├── src/emails/        React Email templates (login-link, client-invite, verify-email)
│   ├── src/lib/           api, custom CDN loader, download helper
│   └── src/app/api/email/ render endpoint (Next → React Email → HTML)
├── ios/                   iOS app (separate)
├── marketing/             marketing site
└── Dockerfile             backend image (entrypoint runs alembic upgrade then uvicorn)
```

## Running it

### Backend (local against the prod DB via port-forward)
```bash
kubectl port-forward -n photoaura svc/photoaura-postgres 5432:5432   # one terminal
cd server
pip install -r ../requirements.txt
uvicorn main:app --reload --port 8000
```
Required env: `POSTGRES_*`, `SECRET_KEY`, `AWS_*`, `AWS_BUCKET=photoaura`, `AWS_CLOUDFRONT_URL=aura-cdn.reactiveshots.com`, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_RENDER_SECRET`, `NEXT_PUBLIC_CLIENT_URL`.

### Client (dev server)
```bash
cd client
bun install
bun run dev   # http://localhost:3000
```
`NEXT_PUBLIC_API_URL` defaults to the production API; point it at `http://localhost:8000/api` in `.env.local` to develop against a local backend.

### Previewing email templates
```bash
cd client
bunx react-email dev --dir src/emails
```

### Deploy
Push to `main` → backend image builds via the centralized argocd repo (entrypoint runs `python -m db.migrate` before uvicorn starts), Vercel rebuilds the client.

## Auth flow at a glance

1. User enters email at `/login` → `POST /api/auth/request-link` → backend looks up any verified `user_emails` row → issues a single-use token (30 min) → Resend sends the React Email magic-link.
2. They click the link → `/auth/verify?token=…` → `POST /api/auth/verify-link` → JWT (7-day) + `user` object back → client routes by role (admin → `/dashboard`, client → `/albums`).
3. Admin endpoints are gated by `require_admin`; the middleware (`proxy.ts`) also redirects clients away from admin paths.

---

PhotoAura is the studio engine; **Reactive Shots** is what clients see.
