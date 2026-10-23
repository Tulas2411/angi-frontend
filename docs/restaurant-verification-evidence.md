# ANGI-61 / F-47 verification submission evidence

Implementation date: 2026-10-16. User instructions retain shared confirmation modals, final API Design reconciliation and no Mapbox usage. Changes remain unstaged and uncommitted under `AGENTS.md` / `.agents/commit_guide.md`.

## Delivered behavior

`/restaurant/verification` now uses a typed operation service independently of the unavailable whole-business adapter. OWN-02 loads eligibility and the latest verification; MEDIA-01 uploads private `verification_doc` files; OWN-06 sends only legal information and numeric document IDs. Successful submission displays the returned verification and pending restaurant state. Required fields, documented limits, MIME/size checks, required business license, indexed field errors, retry, concurrent-state conflicts, modal cancellation/removal/discard and owner-only proxy access are implemented.

The mock implements the same request/response shapes without external uploads or private file persistence. It updates only the selected owner's verification and preserves provider state during client navigation. The new-owner scenario is `/dev/scenarios?state=owner-verification-new`; the ordinary demo owner is already verified. [Vietnamese manual guide](restaurant-verification.vi.md).

## Contract evidence

Source: sibling backend `.docs/ANGI_API_Design_Ver1.8.xlsx` (the newer backend copy, rather than the older root `docs` copy). Backend implementation was inspected read-only in `SubmitVerificationUseCase`, `RestaurantVerificationRules`, submit/document validators, DTOs, `OwnerRestaurantController`, media upload use case and media validator. The use-case document describes initial submission as a separate operation from status/history and resubmission.

| Workbook sheet / rows                      | Reconciled behavior                                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `Backend API` 17, 59, 63                   | MEDIA-01 POST, OWN-02 GET, OWN-06 POST; owner role and 201 response                                                       |
| `Chi tiết Request-Response` 51–53, 284–291 | Required legalName/license, optional taxCode/note, nonempty documents, business license, owned verification-purpose media |
| `DTO` 127–142, 308–313                     | VerificationDocument, Verification and MediaFile; numeric IDs, nullable review fields, five states, signed URLs           |
| `JSON mẫu` 2016–2053                       | Explicit request fields, media IDs and pending response; fixture copied into `tests/fixtures/restaurant-verification.ts`  |
| `Mã lỗi` 8–10, 18, 22, 41                  | Validation/auth/media errors and the three 409 verification conflicts                                                     |

OWN-06 is restricted by backend restaurant state: `unverified` permits the initial submission; `verified` gives `RESTAURANT_ALREADY_VERIFIED`, `rejected` gives `VERIFICATION_RESUBMIT_REQUIRED`, and other states give `VERIFICATION_ALREADY_PENDING`. Documents use exactly `business_license`, `food_safety_cert`, `id_card`, `storefront_photo`, `other`. JPG/PNG/WEBP are limited to 5 MiB, PDF to 10 MiB. There is no maximum document-count rule in the inspected contract/validator; the old fixture-only limit of five was removed.

## Execution

| Check               | Result                                                                                                                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit tests          | `npm test`: 11 files / 101 tests passed, including 13 F-47 cases                                                                                                                                                       |
| TypeScript          | `npm run typecheck`: passed                                                                                                                                                                                            |
| ESLint              | `npm run lint`: passed                                                                                                                                                                                                 |
| Production build    | Passed in final isolated `.cache/owner-test-CEqB3H`; Next.js 16.4 Turbopack, TypeScript, route generation and production runtime                                                                                       |
| F-47 browser checks | **20 passed**: 10 distinct cases repeated twice with `--repeat-each=2`, including validation focus, multipart purpose/IDs, exact POST/201, pending/read-only/conflicts, retries, roles/Origin, modals, demo and mobile |

The production snapshot copies no private env files and uses an empty Mapbox token, fake session password, local unavailable backend URL and disabled telemetry. The Google-client-ID warning is expected in this isolated configuration; no Google auth is tested. Local runtime is Node 22.12.0; CI declares Node 24, so local checks do not establish the CI runtime result.

Browser checks build and serve their own production FE source snapshot on 3001, with an HTTP API stub on 5164. Dev compilation intermittently timed out, so the F-47 config uses the production runtime; other suites retain their existing defaults. `NODE_OPTIONS` is cleared for test processes to exclude editor preloads; the first dev startup timed out and an initial browser attempt used exact labels without the required-field asterisk. Those harness issues were corrected. A repeated run also exposed a focus race after backend validation; the editor now restores focus after the modal is closed and the fields are enabled, verified by repeated browser runs. External browser requests are intercepted and aborted, and Mapbox token is empty. No real backend writes, Cloudinary uploads, token probes or Mapbox requests were performed.

Visual review: inspected the generated 390px form and 1440px pending-status screenshots (`artifacts/verification-mobile.png`, `artifacts/verification-desktop.png`). Form controls and cards fit the viewport. Changed-file Prettier, script syntax and diff-whitespace checks passed.

## Remaining boundaries

Follow-up on 2026-10-17: real F-47 submission/private upload and F-48 history were exercised against local Kestrel/PostgreSQL and Cloudinary. The live suite passed four cases, including private PDF delivery; see [live verification report](verification-live.vi.md). Historical stub counts below remain unchanged. F-48 is implemented in the dependent ANGI-65 branch; the remaining-boundary statements below describe the original F-47 delivery.

- OWN-07 full history / F-48 and OWN-08 resubmission / F-49 remain separate integrations; the UI does not claim those actions work.
- Live provider credentials, private storage, signed URL expiry and database persistence have not been exercised by this local stub suite. Follow the manual guide for those checks.
- Discard/removal excludes a document from the draft; it does not delete uploaded server media, because no such operation belongs to this task.

## Final workbook reconciliation

After the final code changes, production build and repeated browser checks, the workbook was reopened at 2026-10-16 23:47:42 +07:00. Both backend `.docs` and root `docs` were checked for newer workbooks: the backend copy remains the latest (modified 2026-10-15 15:48:43, 778,867 bytes). SHA-256: `4899E6D319904575D4A47289CECF8FA93229A867A53110701DEDA5E15786186C`, unchanged from the initial read. Re-read `Backend API` rows 17 and 59–63, `Chi tiết Request-Response` 51–53 and 284–291, `DTO` 127–142 and 308–313, `JSON mẫu` 2016–2053, and `Mã lỗi` 8–41 (relevant entries 8–10, 18, 22, 41). Final method, request/response fields, status codes, ownership/purpose rules, validation and enum/error mapping match F-47. No workbook edits or additional F-47 contract discrepancies were found. Empty-upload mock failures now match backend `VALIDATION_FAILED`; browser validation still prevents sending empty files.
