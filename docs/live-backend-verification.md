# Live backend verification

[Bản tiếng Việt](live-backend-verification.vi.md).

`npm run test:live` runs the Playwright specs in `tests/live` against a real frontend build and the **real local backend and database**. There are no API stubs and no request interception. The specs use your own accounts and restore what they change.

History: earlier live suites (verification submission with real private uploads, menu approval, resubmission) depended on seed helpers and Docker scripts that no longer exist in the backend repository (`docker/local/Initialize.ps1`, `Start.ps1`, `docker-compose.local.yml`, `Seed`). They were removed with the demo cleanup. Their recorded results remain in the historical evidence files (`verification*.md`, `*-evidence.md`).

## What the suite covers

| Spec                         | Real operations                                                                                                                                                                                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/live/account.spec.ts` | AUTH-04 for every role, landing pages, wrong-role redirects, unknown routes → 404, ME-01/02 (profile edit persists across reload, then restored), ME-03 (wrong password rejected, change, login with the new one, restore)                               |
| `tests/live/owner.spec.ts`   | OWN-01 registration with a new owner (skipped with a reason if the backend still requires `district`), OWN-02/03 profile edit and restore, OWN-04 weekly hours, OWN-05 status round-trip, OWN-09..11/18 menu availability toggle and draft create/cancel |

Not exercised live: MEDIA-01 uploads (cover/gallery, verification documents, dish photos), OWN-06/07/08 verification and OWN-12..17 menu draft editing and approval. Those need file storage and a Moderator decision, so they are covered by the stub suites (`npm run test:owner`) only.

## Prerequisites

1. The backend API is reachable (default `http://127.0.0.1:5154/api/v1`; the config refuses non-loopback hosts) and its database is a **disposable local** one.
2. Five local accounts exist: a Traveler, a Restaurant Owner **with a verified restaurant and at least one dish**, a Restaurant Owner **without a restaurant**, a Moderator and an Administrator. Create them in your own local database; the password must satisfy the account rules (8–64 characters, a letter and a digit).
3. Put the variables in the ignored `.env.integration` (never commit it, never print it):

```text
SESSION_PASSWORD=<random string of at least 32 characters>
ANGI_TEST_PASSWORD=<the shared password of the five accounts>
ANGI_TEST_TRAVELER_EMAIL=...
ANGI_TEST_OWNER_EMAIL=...          # owner with a verified restaurant
ANGI_TEST_OWNER_NEW_EMAIL=...      # owner without a restaurant
ANGI_TEST_MOD_EMAIL=...
ANGI_TEST_ADMIN_EMAIL=...
API_BASE_URL=http://127.0.0.1:5154/api/v1   # optional
```

## Run

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH='.cache/browsers'
npm run test:live            # builds an isolated snapshot, then runs the specs
$env:ANGI_TEST_DEV='1'; npm run test:live   # serve the snapshot with next dev instead
```

The config builds a snapshot under `.cache/owner-test-*` (a running preview is untouched), disables Mapbox and Google, records no traces, and uses port 3001. Run it alone: it shares that port with the other browser suites.

## Known backend mismatch

The frontend follows the 16/10 contract: `district` is optional on OWN-01 and the registration form has no district field. A backend build whose `RegisterRestaurantRequestDtoValidator` still marks `district` as required (as in the checkout at commit `ff15dca`) answers `400 VALIDATION_FAILED` with `errors.district`. The form now shows that message; the OWN-01 live test is skipped instead of failing. Deploy the matching backend change, then rerun.
