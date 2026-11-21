# Restructure plan

Status: planned, not applied. This branch (`chore/code-quality`) only adds tooling, tests and CI, so no files move here. Three areas are in flight on other branches and are left in place: `server/routers/reels/` (with `services/reel_*.py`), `client/src/components/smart-gallery-panel.tsx`, and `client/src/app/(dashboard)/albums/[album]/album-view.tsx`. The move lists below mark them as blocked.

Generated from the tree at `origin/main` (b11d864). Re-run the counts before applying; the import counts drift as the branches land.

## Current layout

Server (Python 3.9, imported as top-level packages from the `server/` root, which the Dockerfile copies to `/app`):

```
server/
  main.py, config.py, dependencies.py, entrypoint.sh, alembic.ini
  alembic/            migrations (26 versions)
  assets/             moment labels, logo
  contracts/          contract template fonts and logos
  db/                 base, models, migrate, seed
  models/user.py      one model file, used by the user router only
  routers/            one folder per area; 17 modules plus __init__ files
  services/           17 modules: PDFs, uploads, smart gallery, reels, email, AWS
  utils/              face recognition, image and JSON helpers
  scripts/            e2e and backfill scripts; moments_test.py needs a database
```

Client (Next.js 16, `@/` alias to `src/`):

```
client/src/
  app/                routes (Next requires them here)
  components/         39 feature components plus ui/ (shadcn, 55 files)
  lib/                api, types, bookings, download, moments, session, uploads and helpers
  hooks/, context/    use-mobile, auth-context
  emails/             React Email templates
```

## Proposed layout

Server: feature folders for routes, services and their helpers. Shared infrastructure and the static resources get their own roots. Tests sit next to the code they cover.

```
server/
  main.py, config.py, dependencies.py, entrypoint.sh, alembic.ini
  alembic/, db/, scripts/          unchanged
  resources/assets/, resources/contracts/   moved from the server root; config.RESOURCES_DIR
  shared/                          aws, CDN warm-up, email, Gemini, image and JSON helpers, utils
  features/
    albums/        routes, smart_routes, smart_gallery, proofs
    revisions/     routes
    uploads/       files_routes, video_routes, video_transcode, jobs, sessions
    faces/         routes, recognition
    reels/         routes, renderer, service, jobs       (after the reels branch)
    bookings/      routes, service, invoice_pdf, contract_pdf, studio_pdf
    auth/          routes, refresh_tokens
    users/         routes, models
    client_files/  routes
    categories/    routes
    places/        routes
    admin/         ops_routes, preview_routes
    app_config/    routes
    realtime/      routes
```

Client: keep `app/` and `components/ui/` where Next and shadcn expect them, and group everything else by feature. `shared/` holds what more than one feature imports.

```
client/src/
  app/, components/ui/, emails/     unchanged
  features/
    admin/          preview-banner, view-as-client-button
    albums/         album-access-dialog, album-faces, album-revisions, invite-client-dialog, proof-banner, rename-album-dialog, revision-banner, revision-seen
    app-updates/    app-update-settings
    auth/           auth-context, auth-refresh, session
    bookings/       booking cards, detail, form, payments, status, contract, invoice, location stops, bookings.ts
    client-portal/  client-booking, client-home, client-nav, store-badges
    downloads/      download-menu, manage-downloads-dialog, save-to-photos, download.ts
    gallery/        photo grid, viewer, info panel, compare, moments-view, smart-gallery-panel, moments.ts
    uploads/        upload dialogs and dropzone, upload-batches.ts
  shared/
    components/     app-sidebar, date-picker, icons, shell, time-picker
    hooks/          use-document-title, use-mobile
    lib/            api, cdn-image-loader, image-cache, stores, types, utils
```

## Move list

Server: 45 moves plus 2 resource moves. 5 of the module moves are blocked by the reels branch. Client: 60 moves; 1 is blocked by the gallery branch. Test moves are listed separately so they can follow their code.

### Server, can run now

```sh
git mv server/assets server/resources/assets
git mv server/contracts server/resources/contracts
git mv server/models/user.py server/features/users/models.py
git mv server/routers/admin/ops_router.py server/features/admin/ops_routes.py
git mv server/routers/admin/preview_router.py server/features/admin/preview_routes.py
git mv server/routers/album/album_routes.py server/features/albums/routes.py
git mv server/routers/album/smart_router.py server/features/albums/smart_routes.py
git mv server/routers/app_config/__init__.py server/features/app_config/__init__.py
git mv server/routers/app_config/app_config_router.py server/features/app_config/routes.py
git mv server/routers/auth/auth_router.py server/features/auth/routes.py
git mv server/routers/bookings/__init__.py server/features/bookings/__init__.py
git mv server/routers/bookings/bookings_router.py server/features/bookings/routes.py
git mv server/routers/category/category.py server/features/categories/routes.py
git mv server/routers/client_files/__init__.py server/features/client_files/__init__.py
git mv server/routers/client_files/client_files_router.py server/features/client_files/routes.py
git mv server/routers/face/face_router.py server/features/faces/routes.py
git mv server/routers/files/files_router.py server/features/uploads/files_routes.py
git mv server/routers/places/__init__.py server/features/places/__init__.py
git mv server/routers/places/places_router.py server/features/places/routes.py
git mv server/routers/revisions/__init__.py server/features/revisions/__init__.py
git mv server/routers/revisions/revisions_router.py server/features/revisions/routes.py
git mv server/routers/user/user.py server/features/users/routes.py
git mv server/routers/video/video_router.py server/features/uploads/video_routes.py
git mv server/routers/websocket/websocket_router.py server/features/realtime/routes.py
git mv server/services/aws_service.py server/shared/aws_service.py
git mv server/services/booking_service.py server/features/bookings/service.py
git mv server/services/cdn_warm.py server/shared/cdn_warm.py
git mv server/services/contract_pdf.py server/features/bookings/contract_pdf.py
git mv server/services/email_service.py server/shared/email_service.py
git mv server/services/gemini_service.py server/shared/gemini_service.py
git mv server/services/invoice_pdf.py server/features/bookings/invoice_pdf.py
git mv server/services/proof_service.py server/features/albums/proofs.py
git mv server/services/refresh_tokens.py server/features/auth/refresh_tokens.py
git mv server/services/smart_gallery.py server/features/albums/smart_gallery.py
git mv server/services/studio_pdf.py server/features/bookings/studio_pdf.py
git mv server/services/upload_jobs.py server/features/uploads/jobs.py
git mv server/services/upload_sessions.py server/features/uploads/sessions.py
git mv server/services/video_transcode.py server/features/uploads/video_transcode.py
git mv server/utils/face_recog.py server/features/faces/recognition.py
git mv server/utils/gzip_json.py server/shared/gzip_json.py
git mv server/utils/image_utils.py server/shared/image_utils.py
git mv server/utils/utils.py server/shared/utils.py
```

### Server, blocked by the reels branch

```sh
git mv server/routers/reels/__init__.py server/features/reels/__init__.py
git mv server/routers/reels/reels_router.py server/features/reels/routes.py
git mv server/services/reel_jobs.py server/features/reels/jobs.py
git mv server/services/reel_renderer.py server/features/reels/renderer.py
git mv server/services/reel_service.py server/features/reels/service.py
```

### Server tests, next to the code

```sh
git mv server/tests/conftest.py server/conftest.py
git mv server/tests/test_utils.py server/shared/test_utils.py
git mv server/tests/test_smart_gallery.py server/features/albums/test_smart_gallery.py
git mv server/tests/test_face_gates.py server/features/faces/test_recognition.py
git mv server/tests/test_reel_planning.py server/features/reels/test_renderer.py
```

### Client, can run now

```sh
git mv client/src/components/album-access-dialog.tsx client/src/features/albums/album-access-dialog.tsx
git mv client/src/components/album-faces.tsx client/src/features/albums/album-faces.tsx
git mv client/src/components/album-revisions.tsx client/src/features/albums/album-revisions.tsx
git mv client/src/components/app-sidebar.tsx client/src/shared/components/app-sidebar.tsx
git mv client/src/components/app-update-settings.tsx client/src/features/app-updates/app-update-settings.tsx
git mv client/src/components/booking-card.tsx client/src/features/bookings/booking-card.tsx
git mv client/src/components/booking-detail.tsx client/src/features/bookings/booking-detail.tsx
git mv client/src/components/booking-form.tsx client/src/features/bookings/booking-form.tsx
git mv client/src/components/booking-payments.tsx client/src/features/bookings/booking-payments.tsx
git mv client/src/components/booking-status.tsx client/src/features/bookings/booking-status.tsx
git mv client/src/components/client-booking.tsx client/src/features/client-portal/client-booking.tsx
git mv client/src/components/client-home.tsx client/src/features/client-portal/client-home.tsx
git mv client/src/components/client-nav.tsx client/src/features/client-portal/client-nav.tsx
git mv client/src/components/contract-view.tsx client/src/features/bookings/contract-view.tsx
git mv client/src/components/date-picker.tsx client/src/shared/components/date-picker.tsx
git mv client/src/components/download-menu.tsx client/src/features/downloads/download-menu.tsx
git mv client/src/components/icons.tsx client/src/shared/components/icons.tsx
git mv client/src/components/invite-client-dialog.tsx client/src/features/albums/invite-client-dialog.tsx
git mv client/src/components/invoice-button.tsx client/src/features/bookings/invoice-button.tsx
git mv client/src/components/location-stops.tsx client/src/features/bookings/location-stops.tsx
git mv client/src/components/manage-downloads-dialog.tsx client/src/features/downloads/manage-downloads-dialog.tsx
git mv client/src/components/moments-view.tsx client/src/features/albums/moments-view.tsx
git mv client/src/components/photo-compare.tsx client/src/features/albums/photo-compare.tsx
git mv client/src/components/photo-grid.tsx client/src/features/gallery/photo-grid.tsx
git mv client/src/components/photo-info-panel.tsx client/src/features/gallery/photo-info-panel.tsx
git mv client/src/components/photo-viewer.tsx client/src/features/gallery/photo-viewer.tsx
git mv client/src/components/preview-banner.tsx client/src/features/admin/preview-banner.tsx
git mv client/src/components/proof-banner.tsx client/src/features/albums/proof-banner.tsx
git mv client/src/components/rename-album-dialog.tsx client/src/features/albums/rename-album-dialog.tsx
git mv client/src/components/revision-banner.tsx client/src/features/albums/revision-banner.tsx
git mv client/src/components/save-to-photos.tsx client/src/features/downloads/save-to-photos.tsx
git mv client/src/components/shell.tsx client/src/shared/components/shell.tsx
git mv client/src/components/store-badges.tsx client/src/features/client-portal/store-badges.tsx
git mv client/src/components/time-picker.tsx client/src/shared/components/time-picker.tsx
git mv client/src/components/upload-album-dialog.tsx client/src/features/uploads/upload-album-dialog.tsx
git mv client/src/components/upload-dropzone.tsx client/src/features/uploads/upload-dropzone.tsx
git mv client/src/components/upload-revision-dialog.tsx client/src/features/uploads/upload-revision-dialog.tsx
git mv client/src/components/view-as-client-button.tsx client/src/features/admin/view-as-client-button.tsx
git mv client/src/context/auth-context.tsx client/src/features/auth/auth-context.tsx
git mv client/src/hooks/use-mobile.ts client/src/shared/hooks/use-mobile.ts
git mv client/src/lib/api.ts client/src/shared/lib/api.ts
git mv client/src/lib/auth-refresh.ts client/src/features/auth/auth-refresh.ts
git mv client/src/lib/bookings.test.ts client/src/features/bookings/bookings.test.ts
git mv client/src/lib/bookings.ts client/src/features/bookings/bookings.ts
git mv client/src/lib/cdn-image-loader.ts client/src/shared/lib/cdn-image-loader.ts
git mv client/src/lib/download.ts client/src/features/downloads/download.ts
git mv client/src/lib/image-cache.ts client/src/shared/lib/image-cache.ts
git mv client/src/lib/moments.test.ts client/src/features/gallery/moments.test.ts
git mv client/src/lib/moments.ts client/src/features/gallery/moments.ts
git mv client/src/lib/revision-seen.ts client/src/features/albums/revision-seen.ts
git mv client/src/lib/session.test.ts client/src/features/auth/session.test.ts
git mv client/src/lib/session.ts client/src/features/auth/session.ts
git mv client/src/lib/stores.ts client/src/shared/lib/stores.ts
git mv client/src/lib/types.ts client/src/shared/lib/types.ts
git mv client/src/lib/upload-batches.test.ts client/src/features/uploads/upload-batches.test.ts
git mv client/src/lib/upload-batches.ts client/src/features/uploads/upload-batches.ts
git mv client/src/lib/use-document-title.ts client/src/shared/hooks/use-document-title.ts
git mv client/src/lib/utils.test.ts client/src/shared/lib/utils.test.ts
git mv client/src/lib/utils.ts client/src/shared/lib/utils.ts
```

### Client, blocked by the gallery branch

```sh
git mv client/src/components/smart-gallery-panel.tsx client/src/features/gallery/smart-gallery-panel.tsx
```

## Import and config updates

- **Server module paths:** 96 `from`/`import` lines across 37 modules point at moved modules. Rewrite them with the new dotted paths.
- **Server package-level imports:** 10 lines of the form `from services import smart_gallery, upload_jobs` bind module names. Keep the names used in the body by aliasing, e.g. `from features.uploads import jobs as upload_jobs`, so no call sites change. This is the riskiest part to do by hand.
- **Path-dependent code (must change):**
  - `services/smart_gallery.py`: `ASSETS = Path(__file__).parent.parent / "assets"`
  - `services/proof_service.py`: `LOGO_PATH` joins `..`/`assets`
  - `services/booking_service.py`: `CONTRACTS_DIR` joins `..`/`contracts`
  Point all three at `config.RESOURCES_DIR` (`Path(__file__).parent / "resources"` in `config.py`). After that they work from any folder.
- **Server config:** `ruff.toml` (per-file ignores for `routers/reels/`), `server/pytest.ini` (testpaths), `.dockerignore` (add `**/test_*.py` and `**/conftest.py` once tests live next to code), `.github/scripts/quality-report.ts` (`COVERED_MODULES`), and `.github/workflows/build-and-deploy.yml` (`server/contracts/**` in `paths`).
- **Client imports:** 94 `@/components/…` and `@/lib/…` specifiers point at 40 moved modules. The `@/` alias stays, so the rewrite is one path per specifier.
- **Client config:** `client/knip.json` (`ignoreIssues` keys name `src/components/*` and `src/lib/*` files), `client/vitest.config.mts` (coverage `include` list), and the `components.json` aliases stay as they are.
- **Dead-code suppressions:** the `knip.json` entries for `src/lib/api.ts`, `src/lib/bookings.ts` and others follow their files.

Cross-feature dependencies to keep an eye on: `features/faces/recognition.py` imports `features/albums/smart_gallery.py`, and `smart_gallery` imports `shared/utils.py`. `shared/` must not import from `features/`.

## Risks

- **Conflicts with in-flight work.** Moving `server/routers/reels/` or `services/reel_*.py` before the reels branch lands will conflict on every line of those files. Move them last, or rebase that branch onto the new paths.
- **Binding names.** Renaming modules (`upload_jobs` to `features/uploads/jobs.py`) is safe only with the aliased import above. Without it, `upload_jobs.foo` raises `NameError`, and tests will not always catch it because they import fewer modules than the routers do.
- **Relative assets.** The three path-dependent modules above fail at import time only when the logo or contract file is read, so a clean import does not prove the move worked. Test a booking contract PDF and a proof-locked album after moving.
- **History.** `git mv` keeps history for files whose content changes little. Edit imports in a separate commit from the move so `git log --follow` and `git blame -M` stay readable.
- **Deploy.** The Docker build copies `server/`, so the new folders ship as they are. `build-and-deploy.yml` must change its `paths` filter in the same PR, or contract-only changes stop triggering a rebuild.
- **Client routes.** Next resolves `app/` routes by folder, and none of them move. A rewrite that touches `app/**` is the only place a route can break, and the `album-view.tsx` branch is in that folder.
- **Circular imports.** Moving modules into packages can create cycles that Python only reveals at import time. Run `python -c "import main"` from `server/` after each batch.
- **Test discovery.** Once tests sit beside the code, `pytest.ini` needs `testpaths = features shared` and `python_files = test_*.py`, so `scripts/moments_test.py` is still excluded.

## Apply order

1. Land the reels, album-view and gallery branches, or agree that they will rebase.
2. Run the "can run now" moves in one commit, with no content changes.
3. Rewrite imports and the three path-dependent modules in a second commit. Run `ruff check server face-service`, `pytest`, `python -c "import main"` from `server/`, `bun run typecheck`, `bun run test` and `bun run build`.
4. Update the config paths (knip, vitest, ruff, dockerignore, the report script, the deploy workflow) in a third commit.
5. Move the blocked files and their tests last, then re-run the report and compare the counts with `docs/quality/report.md`.
