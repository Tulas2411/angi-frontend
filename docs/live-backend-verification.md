# Sprint 1 — real local backend verification

[Bản tiếng Việt](live-backend-verification.vi.md).

The later [focused ANGI-36/48/55 verification report (Vietnamese)](owner-tasks-live-verification.vi.md) checks both the working source at `7bb3e1d` and local `dev` at `4bda386`, which now includes ANGI-55. Use that report for the latest evidence on these three tasks; this report retains its original source/coverage.

Verified on 2026-10-15. This records the current `dev` implementations (FE base `7bb3e1d`, BE base `ff15dca`) plus local environment/test tooling. No production feature code was changed by this task. Changes remain unstaged and uncommitted on FE `test/real-backend-integration` and BE `chore/local-backend-integration`.

## Environment and reproduction

Docker project `angi-local` runs .NET SDK 10.0.402/Kestrel at `http://127.0.0.1:5154`, PostgreSQL 16.15/pgvector at host port 5434, persistent database `angi_local`, and a separate disposable-test database `angi_test`. The host Node.js runtime is 22.12.0; the FE's documented/CI runtime remains Node.js 24. No host .NET SDK was required.

The sibling backend's `docker/local/README.md` contains startup, credentials, provider configuration, testing and cleanup commands. `docker/local/Start.ps1` was executed against the existing stack and confirmed OpenAPI readiness while preserving data. API and database are left running. Browser test servers shut down after their run.

From the backend root:

```powershell
./docker/local/Initialize.ps1
# Fill the ignored .env, then:
./docker/local/Start.ps1
node --env-file=.env docker/local/test-http.mjs
docker compose -f docker-compose.local.yml run --rm tests
```

From the frontend root:

```powershell
./scripts/prepare-live-tests.ps1
npm run test:live
./scripts/cleanup-live-tests.ps1
```

Preparation creates a fresh owner and isolated FE session in `.env.integration`; existing FE `.env`/`.env.local` are preserved. Browser checks run on port 3001 using an isolated source/output snapshot. Activated accounts and the verified discovery/menu restaurant are explicitly seeded local fixtures. Account setup bypasses email verification and is not evidence of email delivery. No API stubs or request interception are used by the live browser suite. Real Cloudinary test assets were deleted after verification; local test metadata is retained.

## Results

| Check                                             | Result and scope                                                                                                                                                                                            |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sprint 1 endpoint inventory                       | All **43 distinct method/path pairs** extracted from BE tickets in Jira Plan Sprint 1 exist in the running BE OpenAPI. Presence does not establish complete behavioral coverage.                            |
| BE Release build and unit tests                   | **993 passed**, zero failed, via `dotnet test ANGI.slnx -c Release`.                                                                                                                                        |
| BE integration suite with PostgreSQL enabled      | **107 passed**, zero failed; **2 provider live tests skipped** in the normal suite. PostgreSQL scenarios use `angi_test`; their factory substitutes external service boundaries.                            |
| Explicit real Cloudinary provider test            | **1 passed**: public image and private PDF upload, signed URL generation and deletion of both test assets. Run separately with `RUN_CLOUDINARY_LIVE_TESTS=1`.                                               |
| Running Kestrel HTTP checks                       | **15 groups passed**, zero failed. Real DI, JWT, use cases and PostgreSQL; summary at BE `TestResults/local/http-checks.json`.                                                                              |
| FE browser suite against real BE                  | **3 passed**, including **33 auth/session assertions**, real cover-image upload, registration, profile edits, overnight business hours, persistence after reload, modal confirmation and owner-role denial. |
| Mobile UI                                         | Checked at 390 px after owner data finished loading; no page-wide horizontal overflow. Reviewed `artifacts/live-owner-mobile.png`.                                                                          |
| FE unit tests                                     | **55 passed** across 7 files.                                                                                                                                                                               |
| FE lint / strict TypeScript                       | Passed.                                                                                                                                                                                                     |
| Changed FE TS/JS/docs formatting / Git whitespace | Passed. PowerShell scripts parsed and startup/preparation/cleanup commands executed successfully.                                                                                                           |

The initial sandboxed Vitest invocation failed with `spawn EPERM`; the subsequent permitted run passed. Production FE build was not rerun because changes are confined to test/setup tooling and documentation; the browser suite compiled and exercised the actual Next.js application in development mode.

## Coverage and remaining dependencies

| Sprint 1 API group                                | Live evidence / limit                                                                                                                                                                                                                                                       |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AUTH-04/06/07                                     | Password login, all four roles, refresh rotation, revocation and logout. FE checks include Origin protection, HttpOnly session, no token pair in browser JSON, concurrent refresh and stale-cookie recovery.                                                                |
| AUTH-01/02/03/08/09                               | Real invalid-input, duplicate-account, invalid-token, unknown-email and throttling behavior. Successful email registration/verification/reset flows are covered by the BE factory with a substituted email boundary; actual Brevo delivery/mailbox consumption was not run. |
| AUTH-05                                           | Real invalid Google-token rejection. Successful Google OAuth was not run because it requires an interactive Google-issued ID token. FE findings below remain open.                                                                                                          |
| ME-01/02/03                                       | Real profile read/update/clear, password change and restoration, current `sid` retained and other refresh sessions revoked. FE smoke verifies ME-01 after refresh.                                                                                                          |
| OWN-01/02/03 + MEDIA-01                           | Real browser registration, multipart cover upload through Next.js and BE to Cloudinary, profile update and persistence.                                                                                                                                                     |
| OWN-04                                            | Real browser replacement with an overnight interval, reload persistence, empty-week replacement and modal confirmation; real API rejects invalid hours.                                                                                                                     |
| OWN-05                                            | Real API closes/reopens the fixture restaurant and preserves verification status; enum validation checked. This does not establish that the current FE `dev` status screen is integrated.                                                                                   |
| OWN-06/07/08                                      | Real history GET and missing-verification error. First submission/persisted documents are covered by the BE PostgreSQL suite with substituted storage. Successful live verification submission/resubmission was not exercised through the running server.                   |
| OWN-09..18                                        | Real approved-menu GET, availability change/restoration, draft creation/list/detail, item add/edit/delete, submit and cancel. Verification of the fixture restaurant is seeded; moderator approval is outside this flow.                                                    |
| REST-01..04, DISH-01..03, CAT-02, HOME-01, IMP-01 | Real public browse/detail/menu/reviews, tags, home, authenticated roll and accepted impressions, using persisted fixtures. Recommendation service is absent, so ranking/roll use the designed fallback. This does not cover every filter/cursor combination.                |
| PREF-02/03                                        | Validation failure and actual `503 SERVICE_UNAVAILABLE` from missing recommendation configuration. Successful survey submission/skip awaits the separate recommendation service.                                                                                            |

## Additional FE findings from contract review

These findings were identified by source/contract inspection and remain outside this environment/test change; they are not successful live OAuth/email tests:

1. **AUTH-03 route is unreachable through the current FE route layout.** `src/shared/api/client.ts` calls `/api/auth/verify-email/resend`, but only `src/app/api/auth/[action]/route.ts` exists. A single `[action]` segment cannot match both path segments, so its `case "verify-email/resend"` cannot handle that URL.
2. **Google role and browser response handling diverge.** The auth handler reads optional `role` but forwards only `idToken`; it returns only `result.user`, losing `isNewUser` which the client expects. The Google button/login callback also hardcodes Traveler navigation. API Design requires a role for a new Google account and returns `isNewUser`. Token pairs must remain server-only when fixing the browser response.
3. **Some auth annotations still describe older responses.** FE resend/forgot-password clients describe `{sent: boolean}` and reset-password describes `{userId, status}`, while AUTH-03/08/09 specify successful `data: null`. The generic parser currently preserves null, but these annotations need reconciliation with the feature fixes.

The browser also logged Google's `width="100%"` button warning; it did not affect the password/owner tests. Actual email delivery, successful Google OAuth and successful recommendation calls remain unverified. Existing preview screens are not converted to live adapters by this task.

## Final API Design reconciliation

Reopened the backend workbooks from disk after implementation/checks and checked again for newer API Design files. Selected `ANGI_API_Design_Ver1.8.xlsx` (778867 bytes, last modified 2026-10-15 15:48:43 local), SHA-256 `4899E6D319904575D4A47289CECF8FA93229A867A53110701DEDA5E15786186C`.

Reviewed Jira Plan v1.2 `Backlog` Sprint 1 rows 17–87; relevant `Backend API` endpoint records at rows 2–30, 45 and 58–75; selected endpoint records in `Chi tiết Request-Response`, including AUTH-05/06/07/08/09 rows 19–31 and owner rows 260–283; `DTO` envelope/auth/profile rows 2–36, discovery/restaurant rows 63–126 and media rows 308–313; `JSON mẫu` auth/profile rows 18–212 and OWN-05 rows 2004–2015; relevant `Mã lỗi` records and `Enum` roles/statuses at rows 2–9. Cross-checked the plan's 43 endpoint methods/paths with the running OpenAPI.

The new checks preserve documented methods, create/read/update statuses, null responses, numeric IDs, snake_case statuses and Vietnam `HH:mm` hours. The tested integrations match their checked contracts; the FE auth deviations listed above remain explicit findings. This is partial behavioral verification of Sprint 1, not a declaration that every Sprint 1 UI/provider workflow is complete.
