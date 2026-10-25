# angi-frontend

ANGI (Ăn Gì) is a Vietnamese food discovery and itinerary-planning application. This repository contains the Next.js frontend and its server-side API boundary for the separate [ANGI backend](https://github.com/predtn/angi-backend).

The product UI is Vietnamese. Team documentation and code identifiers are English.

**Two kinds of screens coexist.** _Backend-integrated screens_ (authentication, `/account`, the Restaurant Owner workspace and the Traveler roadmap list `/roadmaps`, detail `/roadmaps/{id}` and planner `/roadmaps/new`) use the shared site shell and real API services only; a failed call shows retry feedback, never sample data. _Earlier workspace screens_ (public dishes/restaurants/guides, `/demo/*` role previews, Traveler pages, blogs, notifications, owner reviews, moderation and administration) stay as their authors built them: they run on demo fixtures wherever no backend adapter exists yet, keep their own shell and styles (`legacy-ui`), and are removed or integrated only by their owners.

## Start here

- New team member: follow [Local setup](#local-setup), then sign in with an account from your local backend.
- Implementing a feature: read [Project architecture](.agents/project_architecture.md) and [Coding rules](.agents/coding_rule.md).
- Integrating an API: read [API and authentication](#api-and-authentication) and the latest backend API Design (`angi-backend/.docs/ANGI_API_Design_Ver*.xlsx`).
- Reviewing a change: use [Checks](#checks) and the [Human Git workflow](.agents/commit_guide.md).
- What exists and what was removed: see the [screen and endpoint inventory](docs/scope-inventory.md).

## Current implementation status

| Area                                                                                             | Backend operations            | Status                                                                                                 |
| ------------------------------------------------------------------------------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| Public homepage (`/`)                                                                            | none                          | Editorial: local dish collection, URL search/filters, dish dialogs, unsaved taste and roadmap examples |
| Register, verify email, resend, recover password                                                 | AUTH-01, 02, 03, 08, 09       | Connected                                                                                              |
| Login, Google login (when configured), refresh, logout                                           | AUTH-04..07                   | Connected; encrypted HttpOnly session                                                                  |
| Account profile and password (`/account`)                                                        | ME-01, ME-02, ME-03           | Connected for every role                                                                               |
| Owner overview                                                                                   | OWN-02                        | Connected                                                                                              |
| Owner registration, profile, images                                                              | OWN-01, 02, 03, MEDIA-01      | Connected                                                                                              |
| Owner business hours and operating status                                                        | OWN-04, OWN-05                | Connected                                                                                              |
| Owner verification, history, resubmission                                                        | OWN-06, 07, 08, MEDIA-01      | Connected                                                                                              |
| Owner menu, drafts and approval submission                                                       | OWN-09..18, CAT-02, MEDIA-01  | Connected                                                                                              |
| Province / ward suggestions                                                                      | Provinces Open API V2 (proxy) | Connected                                                                                              |
| Traveler discovery, blogs, reports, reviews, roadmaps, notifications, moderation, administration | Mixed (see inventory)         | Earlier screens kept with their own shell; demo fixtures where no adapter exists                       |
| Moderator and Administrator workspaces                                                           | —                             | Earlier screens kept (`/moderation`, `/administration`) on demo fixtures                               |

Known partial integrations: the account page does not upload avatars; the Google button appears only when `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set; the homepage taste/roadmap examples never call the backend and say they are not saved.

## Technology

| Concern                  | Stack                                                              |
| ------------------------ | ------------------------------------------------------------------ |
| Runtime and dependencies | Node.js 22+ (24 recommended), npm, committed npm lockfile          |
| Application              | Next.js 16.4 App Router, React 19.3, strict TypeScript             |
| UI                       | Shared CSS over design tokens, local fonts and assets              |
| Authentication           | `iron-session`, encrypted HttpOnly cookie, rotating backend tokens |
| Maps                     | `mapbox-gl`, owner location picker only                            |
| Quality                  | ESLint, Prettier, Vitest and Playwright                            |

Use the versions declared in `package.json`/`package-lock.json`. Framework guides for the installed Next.js are in `node_modules/next/dist/docs/` after installation.

## Local setup

### 1. Install

```sh
git clone https://github.com/Tulas2411/angi-frontend.git
cd angi-frontend
npm ci
```

### 2. Configure

Copy `.env.example` to `.env.local` on first setup and keep an existing `.env.local` untouched.

```powershell
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
```

Generate a private session key and paste it into `SESSION_PASSWORD`:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

| Variable                          | Example/default                  | Purpose                                                                            |
| --------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------- |
| `API_BASE_URL`                    | `http://127.0.0.1:5154/api/v1`   | Private server-side REST API base URL                                              |
| `NEXT_PUBLIC_API_BASE_URL`        | `/api`                           | Same-origin Next.js handlers called by the browser                                 |
| `APP_URL`                         | `http://localhost:3000`          | Exact browser origin allowed for mutations                                         |
| `SESSION_PASSWORD`                | Your own random key (≥ 32 chars) | Encrypts the session cookie; required                                              |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | Empty                            | Optional public `pk.*` token for the owner map picker                              |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID`    | Empty                            | Optional; must match `Google:ClientId` in the backend. No value → no Google button |

Real values belong in `.env.local` (ignored by Git). `NEXT_PUBLIC_*` values are public and fixed at build time; restart or rebuild after changing them. Use `127.0.0.1` for the local backend URL: the Docker stack binds IPv4 only, while Node.js can resolve `localhost` to IPv6 and return `503 SERVICE_UNAVAILABLE` on login. Manual coordinates and browser geolocation work without a map token. `./scripts/sync-mapbox-env.ps1` copies the backend's public Mapbox token when you want maps locally.

### 3. Start the backend

Real data and login need the backend. Prepare `angi-backend` following its own README (PostgreSQL, secrets, migrations), then run it (default `http://localhost:5154`, Scalar docs at `/scalar`). Keep `API_BASE_URL` aligned with the actual host and `/api/v1` prefix. Ask the backend maintainer for an isolated development account; create test accounts only in your own local database.

### 4. Run the frontend

```sh
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The homepage works without a backend. Register or sign in to use the rest.

## Routes and access

| Route                                                                                                        | Access             | Purpose                                                                                         |
| ------------------------------------------------------------------------------------------------------------ | ------------------ | ----------------------------------------------------------------------------------------------- |
| `/`                                                                                                          | Public             | Homepage; owners are redirected to `/restaurant`                                                |
| `/login`, `/register`, `/verify-email`, `/verify-success`, `/forgot-password`, `/reset-password`             | Public             | Account entry and recovery                                                                      |
| `/account`                                                                                                   | Any signed-in role | Profile and password                                                                            |
| `/restaurant`, `/restaurant/register`, `/restaurant/profile`, `/restaurant/verification`, `/restaurant/menu` | `RESTAURANT_OWNER` | Owner workspace                                                                                 |
| `/roadmaps`                                                                                                  | `TRAVELER`         | My roadmaps, paged (RM-02)                                                                      |
| `/roadmaps/{roadmapId}`                                                                                      | `TRAVELER`         | Roadmap detail: overview, itinerary with legs, budget (RM-03, RM-14); add a dish (RM-06, RM-07) |
| `/roadmaps/new`                                                                                              | `TRAVELER`         | Plan a new roadmap (RM-01) and edit its overview (RM-04)                                        |
| `/dishes`, `/restaurants`, `/guides`                                                                         | Public             | Earlier public discovery screens                                                                |
| `/demo/*`                                                                                                    | Public preview     | Earlier role previews on demo fixtures; no session is created                                   |
| `/restaurant/reviews`, `/restaurant/notifications`, `/moderation/*`, `/administration/*`                     | By role            | Earlier workspace screens (legacy shell)                                                        |
| Anything else                                                                                                | —                  | 404                                                                                             |

Landing page after sign-in: Traveler `/`, Owner `/restaurant`, Moderator `/moderation`, Administrator `/administration`. Missing sessions redirect to `/login`; a role mismatch redirects to the role's landing page. Hidden navigation never authorizes a request; the backend decides.

Owner screens: `/restaurant/profile?tab=hours|status|photos` selects an editor tab and `/restaurant/verification?tab=status` opens the history. Detailed behavior notes (Vietnamese) are in `docs/`: [business hours](docs/business-hours.vi.md), [verification](docs/restaurant-verification.vi.md), [status/history](docs/verification-status.vi.md), [resubmission](docs/verification-resubmission.vi.md), [menu](docs/restaurant-menu.vi.md), [menu approval](docs/menu-approval.vi.md), [address v2](docs/address-entry-v2.vi.md) and [map address prefill](docs/map-address-prefill.vi.md).

## Repository map

```text
.agents/             Architecture, coding and Git rules (read before changing code)
docs/                Setup, inventory, design coverage and verification evidence
public/assets/       Local fonts, photos and logo (manifest: docs/assets.json)
scripts/             Isolated test server, smoke test, asset verification, Mapbox env sync
tests/               Vitest unit tests, browser/ Playwright specs and API stubs, live/ opt-in suites
src/app/             Routes, layouts, auth and API Route Handlers
src/components/      Site header/footer, UI primitives, map and location components
src/features/        auth, account, discovery (homepage), owner
src/shared/          API client/errors, base UI, locations, maps, formatting
src/styles/theme/    Design tokens
```

## API and authentication

The browser only talks to same-origin Route Handlers:

- `/api/auth/[action]` — register, verify email (and resend), forgot/reset password, login, Google login, refresh, logout, session.
- `/api/backend/[...path]` — authenticated proxy with an exact `METHOD path` allowlist (account, media, tags and owner operations). Mutations validate `Origin`; owner paths require the owner role. Everything else is `404 ROUTE_NOT_FOUND`.
- `/api/locations/provinces[/{code}/wards]` — public province/ward catalogue.

The login response stores the backend token pair in an encrypted HttpOnly cookie; tokens never reach browser code. Expired access tokens are refreshed once (single flight) and the request retried once. Callers branch on `errorCode`, never on localized text. Add an endpoint only after confirming it exists in the backend; keep the documented success status, nullability and units.

## Checks

| Command                | What it checks                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| `npm run lint`         | ESLint                                                                                      |
| `npm run typecheck`    | TypeScript (run `npm run build` first on a fresh checkout to generate route types)          |
| `npm test`             | Vitest unit tests                                                                           |
| `npm run build`        | Production build                                                                            |
| `npm run format:check` | Prettier                                                                                    |
| `npm run test:browser` | Public pages, auth, routing/redirects, account (production build + local auth stub)         |
| `npm run test:owner`   | Owner workspace suites against a local API stub; Mapbox disabled                            |
| `npm run test:map`     | Registration, profile, map picker, province/ward; Mapbox traffic is intercepted             |
| `npm run test:smoke`   | Real local backend with seeded accounts (`ANGI_TEST_PASSWORD`, `SESSION_PASSWORD` required) |
| `npm run test:live`    | Opt-in suites against the real local backend with your own accounts                         |

Browser suites start their own isolated server on port 3001 (a snapshot under `.cache/`, so a running dev server is untouched) and an API stub on port 5164, so run them one at a time. Install Chromium once with `npx playwright install chromium`; if you keep browsers elsewhere set the same `PLAYWRIGHT_BROWSERS_PATH` for installation and tests. Set `ANGI_TEST_DEV=1` to serve the snapshot with `next dev` instead of building it. CI runs lint, unit tests, build and typecheck; browser suites are run separately.

Automated Mapbox rule: do not probe tokens, open live maps or run provider-consuming tests without an explicit request. The suites use a placeholder token and intercept every Mapbox request.

## Working on a feature

1. Confirm the assigned scope and the latest API contract, and that the backend implements it.
2. Reuse the owning feature, shared tokens, UI kit and site shell.
3. Add typed services and DTO mappings; never fall back to sample data when a call fails.
4. Handle loading, empty, error, denied, pending and success states.
5. Check logic, role access, keyboard behavior (focus, Escape, return focus) and 320–1440px layouts.
6. Update docs and the inventory when you add a route, variable or integration.

Human maintainers manage branches, commits and reviews according to [the Git guide](.agents/commit_guide.md). Automated assistants leave edits unstaged/uncommitted and never create or modify commits, rewrite history, push, or create/merge PRs.

## Troubleshooting

| Symptom                                         | Check                                                                                                                        |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `/login` reports a session key error            | Set `SESSION_PASSWORD` (≥ 32 characters) and restart                                                                         |
| Login cannot connect                            | Backend running? `API_BASE_URL` includes `/api/v1` and uses `127.0.0.1`                                                      |
| Mutation returns `FORBIDDEN`                    | Browser origin/port must match `APP_URL`; do not disable Origin validation                                                   |
| A page I remember is a 404                      | Check the route table and `docs/scope-inventory.md`; earlier screens live under `/demo`, `/dishes`, `/restaurant/*` (legacy) |
| No Google button on `/login`                    | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is empty; set it and rebuild                                                                  |
| Typecheck reports missing generated route types | Run `npm run build` before a standalone typecheck on a fresh checkout                                                        |
| Browser tests cannot find Chromium              | Install it with the same `PLAYWRIGHT_BROWSERS_PATH` used by the test process                                                 |
| Browser suite cannot bind port 3001 / 5164      | Another suite or preview is running; stop it and rerun                                                                       |

## Further documentation

- [Frontend project architecture](.agents/project_architecture.md)
- [Frontend coding rules](.agents/coding_rule.md)
- [Human Git and review guide](.agents/commit_guide.md)
- [Screen and endpoint inventory](docs/scope-inventory.md)
- [Setup details](docs/setup.md) and [Vietnamese run and test guide](docs/local-run-and-test-guide.vi.md)
- [Public homepage](docs/public-homepage.md)
- [Design coverage](docs/design-coverage.md)
- [Verification evidence and remaining limits](docs/verification.md)
