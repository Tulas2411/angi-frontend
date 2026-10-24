# Screen and endpoint inventory

This inventory records which screens use the backend-integrated shell, which earlier screens remain, and what each is built on. Source for backend status: `angi-backend/.docs/ANGI_API_Design_Ver1.8.xlsx` (sheet "Backend API") checked against the backend controllers.

Rule: a screen in the new shell stays only if its data and actions come from a backend operation that exists. Earlier workspace screens are not removed by this work; they keep their fixtures until their authors connect them.

## Kept routes

| Route                                     | Access             | Backend operations                         | Data source                                    | Notes                                                                                                                                                                    |
| ----------------------------------------- | ------------------ | ------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/`                                       | Public             | none                                       | Local editorial content (`features/discovery`) | Owner sessions are redirected to `/restaurant`; other signed-in roles see the same page with the account menu. Taste and roadmap examples are not saved and call no API. |
| `/login`                                  | Public             | AUTH-04, AUTH-05 (Google, when configured) | BFF `/api/auth/login`, `/api/auth/google`      | Reachable while signed in so users can switch accounts.                                                                                                                  |
| `/register`                               | Public             | AUTH-01                                    | BFF `/api/auth/register`                       | Traveler or Restaurant Owner.                                                                                                                                            |
| `/verify-email`, `/verify-success`        | Public             | AUTH-02, AUTH-03 (resend)                  | BFF                                            |                                                                                                                                                                          |
| `/forgot-password`, `/reset-password`     | Public             | AUTH-08, AUTH-09                           | BFF                                            | Reset without a token redirects to forgot-password.                                                                                                                      |
| `/account`                                | Any signed-in role | ME-01, ME-02, ME-03                        | Proxy `me`, `me/password`                      | Avatar upload is not wired.                                                                                                                                              |
| `/restaurant`                             | Owner              | OWN-02                                     | Proxy `owner/restaurant`                       | Overview and next steps.                                                                                                                                                 |
| `/restaurant/register`                    | Owner              | OWN-01, OWN-02, MEDIA-01                   | Proxy                                          |                                                                                                                                                                          |
| `/restaurant/profile`                     | Owner              | OWN-02, OWN-03, OWN-04, OWN-05, MEDIA-01   | Proxy                                          | Tabs: information, photos, hours, status.                                                                                                                                |
| `/restaurant/verification`                | Owner              | OWN-02, OWN-06, OWN-07, OWN-08, MEDIA-01   | Proxy                                          |                                                                                                                                                                          |
| `/restaurant/menu`                        | Owner              | OWN-09..OWN-18, CAT-02, MEDIA-01           | Proxy                                          |                                                                                                                                                                          |
| `/api/locations/provinces[/{code}/wards]` | Public             | none (Provinces Open API V2)               | Server fetch, cached                           | Used by owner address forms.                                                                                                                                             |

## Earlier screens kept (not part of the integrated shell)

These screens were built before the shared shell. They keep their authors' code (`PlatformProvider`, `src/mocks`, `WorkspaceShell`) and their own scoped stylesheet. Where a backend controller exists, the author may already call it through `src/api/services/*`; the rest runs on demo fixtures. Backend status was read from `angi-backend/ANGI.WebApi/Controllers` (branch `chore/local-backend-integration`, 2026-10-20).

| Screen family                                                  | Routes                                                                | Backend controllers present                                                  | State                                                        |
| -------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Public discovery (dishes, restaurants, guides)                 | `/dishes/*`, `/restaurants/*`, `/guides/*`                            | Home, Dishes, Restaurants (public reads and reviews list), Impressions, Tags | Earlier screens; partly connected through `src/api/services` |
| Traveler pages (profile, preferences, roadmaps, notifications) | `/demo/traveler/*`                                                    | Me, PreferenceSurvey, Roadmaps, MeNotifications                              | Earlier screens; partly connected                            |
| Blogs and reports                                              | `/demo/traveler/blogs`, `/guides/*`                                   | Blogs                                                                        | Earlier screens                                              |
| Owner reviews and remaining owner pages                        | `/restaurant/reviews`, `/restaurant/notifications` (legacy catch-all) | none for owner review replies                                                | Demo fixtures (`src/mocks/owner-reviews.ts`)                 |
| Moderation                                                     | `/moderation/*`                                                       | none                                                                         | Demo fixtures                                                |
| Administration                                                 | `/administration/*`                                                   | none                                                                         | Demo fixtures                                                |
| Role previews and tooling                                      | `/demo/*`, `/dev/components`, `/dev/scenarios`                        | n/a                                                                          | Fixtures; `/dev/*` only outside production unless enabled    |
| Password setup after invitation                                | `/setup-password`                                                     | none                                                                         | Earlier screen                                               |

All of these remain reachable exactly as before. Traveler, Moderator and Administrator now land on the homepage, `/moderation` and `/administration` respectively and can open `/account`.

## Proxy allowlist (`/api/backend/...`)

`GET me`, `PATCH me`, `PUT me/password`, `GET|POST|PATCH owner/restaurant`, `PUT owner/restaurant/business-hours`, `PUT owner/restaurant/operating-status`, `GET|POST owner/restaurant/verifications`, `POST owner/restaurant/verifications/{id}/resubmit`, the owner menu operations validated in `shared/api/owner-menu-proxy.ts`, `POST media`, `GET tags`. Everything else answers `404 ROUTE_NOT_FOUND`. Public read endpoints (dishes, restaurants, Home) were removed from the proxy together with their pages.

## Backend operations the integrated shell does not use

Operation IDs are those of the API Design workbook ("Backend API" sheet). Their screens are the earlier ones above, owned by their authors.

| Operation IDs                                                        | Backend                      | Frontend                                                  |
| -------------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------- |
| HOME-01, DISH-01..03, REST-01..04, IMP-01, PREF-02/03, CAT-02 (tags) | Implemented                  | Earlier discovery and Traveler screens (partly connected) |
| NOTI-01..03, RM-01..14, BLOG-01..11                                  | Controllers present          | Earlier Traveler screens                                  |
| REV-01, REP-01, REP-02 (writing reviews and reports)                 | Not found in the controllers | Earlier screens on demo fixtures                          |
| OWN-19, OWN-20 (owner review replies)                                | Not found in the controllers | Owner reviews screen on demo fixtures                     |
| MOD-\*, ADM-\*, OPS-\*                                               | Not found in the controllers | Moderation and administration screens on demo fixtures    |

## Partial integrations

- Account: display name, phone, bio and password only. No avatar upload.
- Google sign-in: rendered only when `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set.
- Homepage taste and roadmap examples: editorial, never saved, no backend call.
- Maps: owner location picker only; needs a public `pk.` Mapbox token, otherwise manual coordinates and geolocation are used.

## Tests that cover the kept scope

| Suite                        | Covers                                                                                                                                                                             |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vitest (`npm test`)          | Rules and DTO builders (account, owner), services, proxy allowlist, session/refresh logic, formatting, address and province logic.                                                 |
| `npm run test:browser`       | Homepage, auth pages, unknown routes → 404, role landings and wrong-role redirects, account menu keyboard behavior, logout, proxy allowlist, account profile and password dialogs. |
| `npm run test:owner`         | Business hours, operating status, verification, status/history, resubmission, menu and menu approval against a local API stub.                                                     |
| `npm run test:map`           | Registration, profile, map picker, province and ward suggestions with every Mapbox request intercepted.                                                                            |
| `npm run test:live` (opt-in) | Real local backend with your own accounts.                                                                                                                                         |
