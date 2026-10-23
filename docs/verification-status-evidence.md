# ANGI-65 / F-48 verification status evidence

> **Tài liệu lịch sử (trước đợt dọn 10/2026).** Các cấu hình Playwright, script seed và màn `/demo` được nhắc dưới đây đã bị gộp hoặc xóa. Nội dung giữ lại làm bằng chứng; cách chạy hiện tại nằm trong [README](../README.md#checks).


Implementation date: 2026-10-17. Branch: `feat/ANGI-65-view-verification-status`, created before source edits. The owner explicitly requested task branches; code remains unstaged and uncommitted.

## Branch dependency

At task start, remote `dev` was `79914bb7f9d04942a019104397510e71b0a2cb22`, and the owner-committed F-47 branch was `39755302923664bbb66e7467c70edb2e259d23af`. F-47 was not merged into dev. F-48 is based on that F-47 commit to reuse its verification contracts, page, upload flow and test infrastructure. No commits, merges, rebases, cherry-picks or pushes were performed. Review the F-48 working changes relative to its F-47 base; merge F-47 through the human workflow before reviewing F-48 against dev.

## Delivered behavior

The existing verification status tab now calls OWN-07 and shows the current restaurant verification state, latest request, complete newest-first history, review metadata and read-only detail modals. The response's restaurant flag stays distinct from each request's status. OWN-02 still loads the shared verification workspace for F-47; OWN-07 refreshes its current verification flag/latest record. A direct `?tab=status` entry works for unverified owners too.

Private document URLs are linked on demand, not previewed/prefetched or stored in browser storage. Manual history refresh obtains fresh status/URLs, without polling. Empty history, missing restaurant and service failure remain distinct. Late responses after a tab exit are ignored. The shared F-47 draft survives tab changes and its submit/confirmation workflow remains covered by regression checks. OWN-08 / F-49 remains pending.

Mocks return the same response shape, order by submittedAt then ID descending like BE, clone results, isolate the selected owner, preserve prior requests and publish successful initial submissions in history. Scenarios cover pending, approved and needs-more-info feedback. Fixtures replace private signed URLs with empty strings rather than fetch a provider.

## Contract sources

Latest workbook at initial read: `angi-backend/.docs/ANGI_API_Design_Ver1.8.xlsx`, modified 2026-10-15 15:48:43, 778,867 bytes. Initial SHA-256: `4899E6D319904575D4A47289CECF8FA93229A867A53110701DEDA5E15786186C`. The older root `docs` copy was not used as the contract source.

| Sheet / rows                      | Verified requirement                                                                                             |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Backend API 64                    | OWN-07 GET `/api/v1/owner/restaurant/verifications`, RESTAURANT_OWNER, 200 with `verificationStatus` and `items` |
| Chi tiết Request-Response 292–293 | Restaurant state and complete Verification array, newest first; no body or pagination                            |
| DTO 119, 127–142, 321             | Verification/document enums, numeric IDs, previousId, signed URLs, nullable review fields                        |
| JSON mẫu 2054–2084                | Exact response envelope and example request history                                                              |
| Mã lỗi                            | Authentication/role/not-found handling; final inspected ranges recorded below                                    |

Backend inspected read-only: `GetVerificationStatusUseCase`, `GetVerificationStatusResponseDto`, `VerificationDto`, `RestaurantVerificationMapper`, repository `GetOwnerRestaurantWithVerificationsAsync`, and the owner controller. BE filters by current owner and sorts SubmittedAt descending, then ID descending. Missing auth/restaurant gives UNAUTHORIZED/RESTAURANT_NOT_FOUND; FE proxy also denies non-owner roles before forwarding. No backend or workbook edits were made.

## Checks

- Unit: 113 passed in 12 files, including 12 OWN-07 cases.
- TypeScript and full ESLint: passed.
- Production build and runtime: passed in isolated `.cache/owner-test-tAQaK0` through the browser config; Next.js 16.4 Turbopack, TypeScript and route generation completed.
- Browser: **22 passed** in one combined run (12 F-48 + 10 affected F-47 regression cases). Includes all five request states, owner state refresh, empty/404/503, exact GET/no body/query, previous-attempt modals, reviewer/feedback, URL refresh without prefetch, stale-response cleanup, owner/anonymous/role guards, keyboard, demo and mobile. `test-results/.last-run.json` reports passed.
- Visual review: inspected `artifacts/verification-status-desktop.png` (1440px) and `artifacts/verification-status-mobile.png` (390px, long review feedback in the detail modal). Existing tokens/components are retained; content wraps and modal content scrolls within the viewport. Screenshots remain ignored artifacts.
- Changed-code/new-guide Prettier and `git diff --check`: passed. Historical F-47 counts were preserved in its original evidence file.
- Final contract reread completed after implementation, unit/static/build/browser checks and visual review on 2026-10-17 at approximately 01:29 +07:00. Checked both backend `.docs` and root `docs` for newer workbooks; the backend v1.8 copy remains latest. Reopened `Backend API` row 64, `Chi tiết Request-Response` rows 292–293, `DTO` rows 119, 127–142 and 321, `JSON mẫu` rows 2054–2084, and `Mã lỗi` rows 18–31 (especially 18/22/30). SHA-256 is unchanged: `4899E6D319904575D4A47289CECF8FA93229A867A53110701DEDA5E15786186C`. Method/path, 200 response, role, full-history shape/order, numeric IDs, four restaurant states, five request states, nullable review fields and private signed URLs match the final implementation. No new F-48 contract discrepancy was found; GET has no request-field validation or pagination to invent.

Browser scope uses isolated local credentials, production FE 3001 and API stub 5164. No private env files are copied. Mapbox token is empty; external browser requests are aborted. Real backend writes/reads, signed-document delivery and Cloudinary credentials are not validated by the stub suite. Local Node is 22.12.0; CI targets Node 24.

[Vietnamese manual guide](verification-status.vi.md).

## 2026-10-17 — real backend follow-up

The owner correctly identified the missing live verification. Added `playwright.verification-live.config.ts` and `tests/live/restaurant-verification.spec.ts`; no application/API implementation change was required. A fresh local owner was used against Kestrel/PostgreSQL `angi_local` and real private Cloudinary storage. Final browser run: **4 passed (8.8s)**. Verified initial empty/404 states, real multipart upload/201, confirmed OWN-06/201, OWN-07/200 pending history, reload/detail/manual refresh, 400 validation, 409 duplicate protection, private PDF download/200, direct BE and proxy 401/403, and cross-owner isolation. The workflow recorded zero page errors, native dialogs and Mapbox requests.

The first attempt found an outdated running BE still requiring district; only the local API container was recreated to compile current source, preserving PostgreSQL. A later test assertion incorrectly limited Cloudinary downloads to the CDN host; corrected the test to also accept the SDK's private-download API host, then fetched the document successfully. Both synthetic uploaded assets were cleaned up for their exact test owners; DB metadata remains. Existing private env files were preserved. Final tests reused the identical just-built `.cache/owner-test-DBSQXw` app with an ignored config override; the reusable tracked config builds a fresh snapshot by default.

Live OpenAPI confirmed only the Owner verification collection and resubmit paths. No Moderator verification-decision endpoint exists in this checkout, so real approval/rejection/needs-more-info transitions, reviewer feedback and multi-attempt history remain unverified against BE. Their earlier stub coverage does not establish live behavior. URL expiration and all document formats were not exercised. See the [Vietnamese results and limits](verification-live.vi.md) and safe ignored `artifacts/verification-live-evidence.json`.

Final follow-up checks: focused ESLint, full TypeScript and changed/new-file formatting passed; diff whitespace check passed. After these code checks and live execution, the workbook was reopened again at approximately 02:00 +07:00 on 2026-10-17: `Backend API` rows 17, 58–59, 63–64; `Chi tiết Request-Response` 51–53 and 284–293; `DTO` 119, 127–142, 308–313 and 321; `JSON mẫu` 2016–2084; relevant validation/auth/role/not-found/verification errors within `Mã lỗi` 8–41. Both workbook locations were checked for a newer version. The backend v1.8 SHA-256 remains unchanged. The live flow matches OWN-06/OWN-07/MEDIA-01; the already documented district requirement in the workbook still differs from the owner's explicit two-level-address requirement and current BE. No contract or workbook changes were made.
