# Code quality report

Generated Nov 21, 2026 at commit `b11d864`. Areas: client, python, ios. Gate: PASS.

## Summary

| tool | scope | findings | detail | gate |
|---|---|---|---|---|
| oxlint | client | 0 | 0 findings | PASS |
| eslint + sonarjs | client | 20 | 0 errors, 20 warnings | PASS |
| knip | client | 0 | 0 findings | PASS |
| vitest | client | 0 | 32 passed, 0 failed; 48.0% lines of pure helpers (floor 45%) | PASS |
| ruff | python | 0 | pyflakes, bugbear, mccabe (E9, F, B, C90) | PASS |
| vulture | python | 0 | 0 findings at 80% confidence | PASS |
| pytest | python | 0 | 78 passed, 0 failed; 51.6% of 4 modules (floor 50%) | PASS |
| swiftlint | ios | 41 | 0 errors, 41 warnings | PASS |
| jscpd | client, python | 34 | 1.17% duplicated lines (360 of 30646), 34 clones, gate at most 3% | PASS |

## Tests and coverage

| suite | passed | failed | coverage | floor |
|---|---|---|---|---|
| vitest | 32 | 0 | 48.0% | 45% |
| pytest | 78 | 0 | 51.6% | 50% |

Pytest covers `services.smart_gallery`, `services.reel_renderer`, `utils.face_recog`, `utils.utils`. Vitest covers the pure helpers in `client/src/lib`.

## Duplication

1.17% of 30646 lines are duplicated in 34 clones (gate at most 3%).

## Complexity hot spots (report only)

Ruff C901 above 10 and sonarjs cognitive complexity above 15, highest first.

| file | line | function | complexity | tool |
|---|---|---|---|---|
| `client/src/components/booking-form.tsx` | 82 | function | 81 | sonarjs |
| `client/src/app/(dashboard)/albums/[album]/album-view.tsx` | 76 | function | 80 | sonarjs |
| `client/src/components/booking-detail.tsx` | 154 | function | 38 | sonarjs |
| `client/src/lib/api.ts` | 272 | function | 28 | sonarjs |
| `client/src/app/(dashboard)/albums/[album]/processing/page.tsx` | 44 | function | 26 | sonarjs |
| `server/utils/face_recog.py` | 694 | _recluster_faces | 23 | ruff C901 |
| `server/routers/bookings/bookings_router.py` | 311 | _apply | 22 | ruff C901 |
| `client/src/components/contract-view.tsx` | 11 | function | 21 | sonarjs |
| `client/src/app/(dashboard)/faces/page.tsx` | 31 | function | 20 | sonarjs |
| `client/src/app/(dashboard)/albums/[album]/album-view.tsx` | 378 | function | 19 | sonarjs |
| `client/src/components/booking-card.tsx` | 26 | function | 18 | sonarjs |
| `client/src/components/upload-album-dialog.tsx` | 74 | function | 18 | sonarjs |
| `client/src/proxy.ts` | 29 | function | 18 | sonarjs |
| `client/src/components/booking-detail.tsx` | 552 | function | 17 | sonarjs |
| `client/src/app/(dashboard)/albums/[album]/processing/page.tsx` | 154 | function | 16 | sonarjs |

## Top offenders

| tool | files with the most findings |
|---|---|
| eslint + sonarjs | client/src/app/(dashboard)/albums/[album]/album-view.tsx (2), client/src/app/(dashboard)/albums/[album]/processing/page.tsx (2), client/src/app/(dashboard)/website/[id]/page.tsx (2), client/src/components/booking-detail.tsx (2), client/src/components/booking-form.tsx (2) |
| swiftlint | ios/PhotoAura/EditorialStyleTheme/ContentView.swift (20), ios/PhotoAura/PhotoAura/Core/KeychainStore.swift (3), ios/PhotoAura/PhotoAura/Core/ServerDate.swift (2), ios/PhotoAura/EditorialStyle/Sources/EditorialStyle/Components/EditorialNavigationStyle.swift (2), ios/PhotoAura/PhotoAura/Core/BookingFormat.swift (1) |
| jscpd | client/src/components/album-access-dialog.tsx (5), server/routers/album/album_routes.py (5), client/src/app/(dashboard)/dashboard/page.tsx (4), client/src/components/booking-payments.tsx (4), client/src/app/(dashboard)/bookings/page.tsx (3) |

## eslint + sonarjs

| location | rule | message |
|---|---|---|
| `client/src/app/(dashboard)/albums/[album]/album-view.tsx:76` | sonarjs/cognitive-complexity | Refactor this function to reduce its Cognitive Complexity from 80 to the 15 allowed. |
| `client/src/app/(dashboard)/albums/[album]/album-view.tsx:378` | sonarjs/cognitive-complexity | Refactor this function to reduce its Cognitive Complexity from 19 to the 15 allowed. |
| `client/src/app/(dashboard)/albums/[album]/processing/page.tsx:44` | sonarjs/cognitive-complexity | Refactor this function to reduce its Cognitive Complexity from 26 to the 15 allowed. |
| `client/src/app/(dashboard)/albums/[album]/processing/page.tsx:154` | sonarjs/cognitive-complexity | Refactor this function to reduce its Cognitive Complexity from 16 to the 15 allowed. |
| `client/src/app/(dashboard)/faces/page.tsx:31` | sonarjs/cognitive-complexity | Refactor this function to reduce its Cognitive Complexity from 20 to the 15 allowed. |
| `client/src/app/(dashboard)/website/[id]/page.tsx:91` | sonarjs/no-unenclosed-multiline-block | This statement will not be executed conditionally; only the first statement will be. The rest will execute unconditionally. |
| `client/src/app/(dashboard)/website/[id]/page.tsx:283` | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `client/src/components/booking-card.tsx:26` | sonarjs/cognitive-complexity | Refactor this function to reduce its Cognitive Complexity from 18 to the 15 allowed. |
| `client/src/components/booking-detail.tsx:154` | sonarjs/cognitive-complexity | Refactor this function to reduce its Cognitive Complexity from 38 to the 15 allowed. |
| `client/src/components/booking-detail.tsx:552` | sonarjs/cognitive-complexity | Refactor this function to reduce its Cognitive Complexity from 17 to the 15 allowed. |
| `client/src/components/booking-form.tsx:82` | sonarjs/cognitive-complexity | Refactor this function to reduce its Cognitive Complexity from 81 to the 15 allowed. |
| `client/src/components/booking-form.tsx:238` | sonarjs/super-linear-regex | Simplify this regular expression to reduce its runtime, as it has super-linear performance due to backtracking. |
| `client/src/components/client-home.tsx:118` | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `client/src/components/contract-view.tsx:11` | sonarjs/cognitive-complexity | Refactor this function to reduce its Cognitive Complexity from 21 to the 15 allowed. |
| `client/src/components/contract-view.tsx:23` | sonarjs/super-linear-regex | Simplify this regular expression to reduce its runtime, as it has super-linear performance due to backtracking. |
| `client/src/components/upload-album-dialog.tsx:74` | sonarjs/cognitive-complexity | Refactor this function to reduce its Cognitive Complexity from 18 to the 15 allowed. |
| `client/src/components/upload-revision-dialog.tsx:28` | sonarjs/cognitive-complexity | Refactor this function to reduce its Cognitive Complexity from 16 to the 15 allowed. |
| `client/src/context/auth-context.tsx:102` | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `client/src/lib/api.ts:272` | sonarjs/cognitive-complexity | Refactor this function to reduce its Cognitive Complexity from 28 to the 15 allowed. |
| `client/src/proxy.ts:29` | sonarjs/cognitive-complexity | Refactor this function to reduce its Cognitive Complexity from 18 to the 15 allowed. |

## swiftlint

| location | rule | message |
|---|---|---|
| `ios/PhotoAura/PhotoAura/Core/ServerDate.swift:22` | trailing_comma | Collection literals should not have trailing commas |
| `ios/PhotoAura/PhotoAura/Core/ServerDate.swift:31` | trailing_comma | Collection literals should not have trailing commas |
| `ios/PhotoAura/PhotoAura/Core/BookingFormat.swift:195` | trailing_comma | Collection literals should not have trailing commas |
| `ios/PhotoAura/PhotoAura/Core/KeychainStore.swift:19` | trailing_comma | Collection literals should not have trailing commas |
| `ios/PhotoAura/PhotoAura/Core/KeychainStore.swift:35` | trailing_comma | Collection literals should not have trailing commas |
| `ios/PhotoAura/PhotoAura/Core/KeychainStore.swift:48` | trailing_comma | Collection literals should not have trailing commas |
| `ios/PhotoAura/PhotoAura/Core/APIClient.swift:264` | large_tuple | Tuples should have at most 2 members |
| `ios/PhotoAura/PhotoAura/Features/Invoices/InvoicesView.swift:86` | trailing_comma | Collection literals should not have trailing commas |
| `ios/PhotoAura/PhotoAura/Features/Bookings/BookingsView.swift:211` | large_tuple | Tuples should have at most 2 members |
| `ios/PhotoAura/PhotoAura/Features/PhotoViewer/ZoomableImageView.swift:50` | trailing_comma | Collection literals should not have trailing commas |
| `ios/PhotoAura/PhotoAura/Features/BookingDetail/BookingDetailView.swift:168` | trailing_comma | Collection literals should not have trailing commas |
| `ios/PhotoAura/PhotoAura/Features/AdminBookingDetail/AdminBookingDetailView.swift:192` | trailing_comma | Collection literals should not have trailing commas |
| `ios/PhotoAura/PhotoAura/Features/Galleries/GalleriesView.swift:92` | trailing_comma | Collection literals should not have trailing commas |
| `ios/PhotoAura/PhotoAura/Features/Downloads/DownloadsView.swift:149` | trailing_comma | Collection literals should not have trailing commas |
| `ios/PhotoAura/PhotoAura/Features/Onboarding/OnboardingView.swift:28` | trailing_comma | Collection literals should not have trailing commas |
| `ios/PhotoAura/EditorialStyleTheme/ContentView.swift:175` | colon | Colons should be next to the identifier when specifying a type and next to the key in dictionary literals |
| `ios/PhotoAura/EditorialStyleTheme/ContentView.swift:175` | colon | Colons should be next to the identifier when specifying a type and next to the key in dictionary literals |
| `ios/PhotoAura/EditorialStyleTheme/ContentView.swift:175` | colon | Colons should be next to the identifier when specifying a type and next to the key in dictionary literals |
| `ios/PhotoAura/EditorialStyleTheme/ContentView.swift:175` | colon | Colons should be next to the identifier when specifying a type and next to the key in dictionary literals |
| `ios/PhotoAura/EditorialStyleTheme/ContentView.swift:175` | colon | Colons should be next to the identifier when specifying a type and next to the key in dictionary literals |
| `ios/PhotoAura/EditorialStyleTheme/ContentView.swift:175` | colon | Colons should be next to the identifier when specifying a type and next to the key in dictionary literals |
| `ios/PhotoAura/EditorialStyleTheme/ContentView.swift:179` | colon | Colons should be next to the identifier when specifying a type and next to the key in dictionary literals |
| `ios/PhotoAura/EditorialStyleTheme/ContentView.swift:179` | colon | Colons should be next to the identifier when specifying a type and next to the key in dictionary literals |
| `ios/PhotoAura/EditorialStyleTheme/ContentView.swift:179` | colon | Colons should be next to the identifier when specifying a type and next to the key in dictionary literals |
| `ios/PhotoAura/EditorialStyleTheme/ContentView.swift:179` | colon | Colons should be next to the identifier when specifying a type and next to the key in dictionary literals |
| `ios/PhotoAura/EditorialStyleTheme/ContentView.swift:179` | colon | Colons should be next to the identifier when specifying a type and next to the key in dictionary literals |
| `ios/PhotoAura/EditorialStyleTheme/ContentView.swift:179` | colon | Colons should be next to the identifier when specifying a type and next to the key in dictionary literals |
| `ios/PhotoAura/EditorialStyleTheme/ContentView.swift:175` | comma | There should be no space before and one after any comma |
| `ios/PhotoAura/EditorialStyleTheme/ContentView.swift:175` | comma | There should be no space before and one after any comma |
| `ios/PhotoAura/EditorialStyleTheme/ContentView.swift:175` | comma | There should be no space before and one after any comma |
| `ios/PhotoAura/EditorialStyleTheme/ContentView.swift:175` | comma | There should be no space before and one after any comma |
| `ios/PhotoAura/EditorialStyleTheme/ContentView.swift:179` | comma | There should be no space before and one after any comma |
| `ios/PhotoAura/EditorialStyleTheme/ContentView.swift:179` | comma | There should be no space before and one after any comma |
| `ios/PhotoAura/EditorialStyleTheme/ContentView.swift:179` | comma | There should be no space before and one after any comma |
| `ios/PhotoAura/EditorialStyleTheme/ContentView.swift:179` | comma | There should be no space before and one after any comma |
| `ios/PhotoAura/EditorialStyle/Sources/EditorialStyle/Components/EditorialFigureGrid.swift:98` | trailing_comma | Collection literals should not have trailing commas |
| `ios/PhotoAura/EditorialStyle/Sources/EditorialStyle/Components/EditorialNavigationStyle.swift:32` | trailing_comma | Collection literals should not have trailing commas |
| `ios/PhotoAura/EditorialStyle/Sources/EditorialStyle/Components/EditorialNavigationStyle.swift:37` | trailing_comma | Collection literals should not have trailing commas |
| `ios/PhotoAura/EditorialStyle/Sources/EditorialStyle/Components/RadSoftMark.swift:36` | trailing_comma | Collection literals should not have trailing commas |
| `ios/PhotoAura/EditorialStyle/Sources/EditorialStyle/Components/EditorialTimeline.swift:64` | trailing_comma | Collection literals should not have trailing commas |
| … | 1 more | |

## jscpd

| location | rule | message |
|---|---|---|
| `client/src/app/(dashboard)/albums/page.tsx:44` | 12 lines | also at client/src/app/(dashboard)/photos/page.tsx:48 |
| `client/src/app/(dashboard)/bookings/page.tsx:58` | 11 lines | also at client/src/components/booking-detail.tsx:230 |
| `client/src/app/(dashboard)/bookings/page.tsx:216` | 10 lines | also at client/src/app/(dashboard)/invoices/page.tsx:43 |
| `client/src/app/(dashboard)/bookings/page.tsx:232` | 8 lines | also at client/src/app/(dashboard)/invoices/page.tsx:63 |
| `client/src/app/(dashboard)/dashboard/page.tsx:58` | 7 lines | also at client/src/app/(dashboard)/users/page.tsx:125 |
| `client/src/app/(dashboard)/dashboard/page.tsx:58` | 11 lines | also at client/src/app/(dashboard)/website/page.tsx:163 |
| `client/src/app/(dashboard)/dashboard/page.tsx:61` | 6 lines | also at client/src/components/booking-form.tsx:294 |
| `client/src/app/(dashboard)/dashboard/page.tsx:62` | 7 lines | also at client/src/app/(dashboard)/galleries/page.tsx:39 |
| `client/src/app/(dashboard)/faces/page.tsx:301` | 7 lines | also at client/src/app/(dashboard)/website/page.tsx:246 |
| `client/src/app/(dashboard)/galleries/page.tsx:36` | 8 lines | also at client/src/app/(dashboard)/website/[id]/page.tsx:143 |
| `client/src/app/(dashboard)/galleries/page.tsx:37` | 7 lines | also at client/src/app/(dashboard)/users/[id]/page.tsx:133 |
| `client/src/app/(dashboard)/ops/page.tsx:65` | 10 lines | also at client/src/app/(dashboard)/users/page.tsx:128 |
| `client/src/app/(dashboard)/users/[id]/page.tsx:135` | 6 lines | also at client/src/app/(dashboard)/website/[id]/page.tsx:146 |
| `client/src/app/(dashboard)/users/page.tsx:232` | 8 lines | also at client/src/components/album-faces.tsx:49 |
| `client/src/components/album-access-dialog.tsx:31` | 12 lines | also at client/src/components/manage-downloads-dialog.tsx:43 |
| `client/src/components/album-access-dialog.tsx:44` | 8 lines | also at client/src/components/invite-client-dialog.tsx:30 |
| `client/src/components/album-access-dialog.tsx:104` | 13 lines | also at client/src/components/invite-client-dialog.tsx:63 |
| `client/src/components/album-access-dialog.tsx:106` | 11 lines | also at client/src/components/manage-downloads-dialog.tsx:140 |
| `client/src/components/album-access-dialog.tsx:202` | 14 lines | also at client/src/components/manage-downloads-dialog.tsx:265 |
| `client/src/components/booking-detail.tsx:38` | 23 lines | also at client/src/components/booking-payments.tsx:11 |
| `client/src/components/booking-detail.tsx:284` | 8 lines | also at client/src/components/booking-detail.tsx:319 |
| `client/src/components/booking-payments.tsx:203` | 9 lines | also at client/src/components/booking-payments.tsx:441 |
| `client/src/components/booking-payments.tsx:252` | 10 lines | also at client/src/components/booking-payments.tsx:456 |
| `client/src/components/booking-payments.tsx:270` | 12 lines | also at client/src/components/booking-payments.tsx:328 |
| `client/src/components/booking-payments.tsx:404` | 17 lines | also at client/src/components/booking-payments.tsx:502 |
| `client/src/emails/booking-invite.tsx:43` | 12 lines | also at client/src/emails/booking-revised.tsx:33 |
| `server/routers/album/album_routes.py:232` | 11 lines | also at server/routers/album/album_routes.py:808 |
| `server/routers/album/album_routes.py:244` | 14 lines | also at server/routers/album/album_routes.py:819 |
| `server/routers/album/album_routes.py:389` | 17 lines | also at server/routers/album/album_routes.py:621 |
| `server/routers/album/album_routes.py:390` | 15 lines | also at server/routers/album/album_routes.py:426 |
| `server/routers/album/album_routes.py:397` | 11 lines | also at server/routers/album/album_routes.py:629 |
| `server/routers/bookings/bookings_router.py:1291` | 9 lines | also at server/routers/bookings/bookings_router.py:1338 |
| `server/routers/files/files_router.py:139` | 7 lines | also at server/routers/revisions/revisions_router.py:201 |
| `server/routers/files/files_router.py:609` | 9 lines | also at server/routers/files/files_router.py:664 |

