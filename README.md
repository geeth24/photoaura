# PhotoAura

A studio-grade photo gallery for working photographers. Upload a shoot, faces are grouped automatically, and clients get a one-tap sign-in link to view, pick favourites from and save their photos on the web, iPhone or Android.

[photoaura.app](https://photoaura.app) · [App Store](https://apps.apple.com/app/id6477320360) · [Google Play](https://play.google.com/store/apps/details?id=com.radsoftinc.photoaura) · [photoaura.app/app](https://photoaura.app/app) (sends each phone to its store)

## What it does

### For the photographer
- **Drag-and-drop uploads** for photos *and* video clips into the same album, with live progress (uploading → saving → detecting faces → optimizing). Clips are transcoded to fast-start 1080p.
- **Faces, automatically.** Every album shows the distinct people in it; pick the best front-facing shot of each person as their thumbnail.
- **Invite a client in two clicks.** Name and email on the album, and they get a branded email with a one-tap sign-in link.
- **See what clients picked.** Hearts from the client show up as their favourites, ready for retouching, prints or an album.
- **Deliver files** like zips of originals straight to a client's home screen.
- **Admin dashboard** for albums, the Photos library, Faces across all shoots, the public site categories, and users.

### For the client
- **Magic-link sign-in.** No password to remember: tap the link in your email and you're in. Password sign-in is there too.
- **A Photos-style gallery.** A square grid you can pinch to make denser or roomier, and a viewer where the photo grows out of the grid, pinches to zoom and pulls down to close. Same feel on web, iOS and Android.
- **Find yourself.** Tap a face to filter the gallery to one person.
- **Favourites.** Heart the shots you love; your photographer sees them.
- **Get every photo.** Save the whole gallery to your phone at full quality, download a zip of the originals, or share the gallery as a link.
- **More than one studio.** The apps have a studio picker, and can point at any PhotoAura server by URL.
- **Multiple email addresses on one account.** Either email signs you into the same account.
- **Delete your account** in the app, or by request at [photoaura.app/delete-account](https://photoaura.app/delete-account).

### For the public site
The brand site at `reactiveshots.com` shows the photographer's portfolio pulled from the same gallery: featured shoots, justified rows, fast everywhere.

## Apps in the repo

| Folder | What | Ships to |
|---|---|---|
| `server/` | FastAPI API: albums, uploads, faces, auth, clients | k3s via GitHub Actions + ArgoCD (`build-and-deploy.yml`) |
| `face-service/` | InsightFace detection + 512-d embeddings on the GPU box | k3s (`build-faces.yml`) |
| `client/` | Next.js admin + client portal, React Email templates in `src/emails/` | Vercel, aura.reactiveshots.com |
| `marketing/` | Marketing site, privacy policy, account deletion, `/app` store redirect | Vercel, photoaura.app |
| `ios/` | SwiftUI app plus the `EditorialStyle` design package | App Store via Xcode Cloud on push to `main` |
| `android/` | Jetpack Compose app plus the `editorialstyle` design module | Google Play via `android-release.yml` (internal track on every push to `main` that touches `android/`) |

The two mobile apps share one look: `ios/PhotoAura/EditorialStyle` and `android/editorialstyle` hold the same colours, type scale, spacing and components, so screens are built from them rather than restyled by hand.

## Built with

FastAPI · SQLAlchemy + Alembic · Postgres + pgvector · InsightFace · AWS S3 + CloudFront image transforms · Resend + React Email · Next.js 16 · React 19 · motion/react · PhotoSwipe · SwiftUI · Jetpack Compose · Ktor · Coil · Media3

## Deploying

- **Server and face service:** push to `main`; the workflow builds on the self-hosted runners and bumps the image in `Rad-Soft/argocd`.
- **Client and marketing:** `vercel deploy --prod` from the repo root. Both projects share `.vercel/project.json`, so point it at the right project first.
- **iOS:** push to `main`; Xcode Cloud builds it for TestFlight and review.
- **Android:** push to `main`; CI signs the bundle and uploads it to Play's internal track. Promote to production from the Play Console.

That's the gist. PhotoAura is the studio engine; **Reactive Shots** is what clients see.
