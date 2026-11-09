# ANGI Frontend

Web app for **ANGI (Ăn Gì)**, a capstone project that recommends Vietnamese regional dishes to travelers and builds day-by-day food roadmaps.

The product UI is Vietnamese; code, identifiers and team documentation are English. The app is one of three services:

| Repository                                             | Role                                               |
| ------------------------------------------------------ | -------------------------------------------------- |
| **angi-frontend** (this repo)                          | Next.js web app and its server-side API boundary   |
| [angi-backend](https://github.com/predtn/angi-backend) | ASP.NET Core REST API                              |
| [angi-reco](https://github.com/predtn/angi-reco)       | Recommendation service, called only by the backend |

## Features

- **Travelers**: explore dishes and restaurants, review and report them, plan roadmaps day by day with AI generation and a food assistant, read and write food guides, get notifications.
- **Restaurant owners**: register a restaurant, manage its profile, photos, hours, status and menu, and submit it for verification and menu approval.
- **Moderators and administrators**: moderation and administration workspaces.

Routes, access rules and how far each area is connected: [routes and status](docs/routes.md).

## Tech stack

| Concern   | Technology                                                                     |
| --------- | ------------------------------------------------------------------------------ |
| Runtime   | Node.js 22+ (24 recommended), npm                                              |
| Framework | Next.js 16 App Router, React 19, strict TypeScript                             |
| UI        | Shared CSS over design tokens, local fonts and assets                          |
| Auth      | `iron-session` encrypted HttpOnly cookie holding the backend's rotating tokens |
| Maps      | `mapbox-gl`                                                                    |
| Quality   | ESLint, Prettier, Vitest, Playwright                                           |

## Getting started

### Prerequisites

- Node.js 22+ and npm
- A running [angi-backend](https://github.com/predtn/angi-backend) for sign-in and real data (default `http://localhost:5154`)

### 1. Install

```sh
git clone https://github.com/Tulas2411/angi-frontend.git
cd angi-frontend
npm ci
```

### 2. Configure

Copy `.env.example` to `.env.local` (keep an existing one), then set `SESSION_PASSWORD` to a random key:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

| Variable                          | Default                        | Purpose                                                                        |
| --------------------------------- | ------------------------------ | ------------------------------------------------------------------------------ |
| `API_BASE_URL`                    | `http://127.0.0.1:5154/api/v1` | Backend URL, server only. Use `127.0.0.1`, not `localhost`                     |
| `NEXT_PUBLIC_API_BASE_URL`        | `/api`                         | Same-origin handlers called by the browser                                     |
| `APP_URL`                         | `http://localhost:3000`        | Exact browser origin allowed for mutations                                     |
| `SESSION_PASSWORD`                | —                              | Encrypts the session cookie; required, ≥ 32 characters                         |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | Empty                          | Optional public `pk.*` token; without it maps fall back to manual entry        |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID`    | Empty                          | Optional; must match the backend's `Google:ClientId`. Empty → no Google button |

`NEXT_PUBLIC_*` values are public and fixed at build time: restart or rebuild after changing them. More detail: [setup](docs/setup.md).

### 3. Run

```sh
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with an account from your local backend.

## Testing

| Command                                   | Checks                                                                             |
| ----------------------------------------- | ---------------------------------------------------------------------------------- |
| `npm run lint`                            | ESLint                                                                             |
| `npm run typecheck`                       | TypeScript (run `npm run build` first on a fresh checkout to generate route types) |
| `npm test`                                | Vitest unit tests                                                                  |
| `npm run build`                           | Production build                                                                   |
| `npm run format:check`                    | Prettier                                                                           |
| `npm run test:browser`                    | Playwright suites against a production build and a local API stub                  |
| `npm run test:owner`, `npm run test:map`  | Owner workspace and map/address suites                                             |
| `npm run test:smoke`, `npm run test:live` | Opt-in runs against a real local backend                                           |

CI runs lint, unit tests, build and typecheck. Browser suites run on port 3001 with an API stub on 5164, so run them one at a time; install Chromium once with `npx playwright install chromium`. Suites use a placeholder Mapbox token and intercept every Mapbox request; do not probe real tokens or run provider-consuming tests without an explicit request. Details: [setup](docs/setup.md#checks) and the [Vietnamese run and test guide](docs/local-run-and-test-guide.vi.md).

## Architecture

The browser talks only to same-origin Route Handlers; the backend is never called from browser code.

- `/api/auth/[action]`: register, email verification, password recovery, login (also Google), refresh, logout, session.
- `/api/backend/[...path]`: authenticated proxy with an exact `METHOD path` allowlist. Mutations validate `Origin`; anything not listed is `404 ROUTE_NOT_FOUND`.
- `/api/locations/provinces[/{code}/wards]`: public province and ward catalogue.

Backend tokens live in the encrypted HttpOnly session cookie and never reach the browser. An expired access token is refreshed once (single flight) and the request retried once. Callers branch on `errorCode`, never on localized text. Hidden navigation never authorizes anything: the backend decides.

Full description: [project architecture](.agents/project_architecture.md).

## Project structure

```text
src/app/          Routes, layouts and API Route Handlers
src/features/     Feature modules (auth, account, discovery, explore, roadmaps, owner, blogs, moderation, admin, ...)
src/components/   Site shell, UI primitives, map and location components
src/shared/       API client and errors, locations, maps, formatting
src/styles/       Design tokens
public/assets/    Local fonts, photos and logo
tests/            Vitest unit tests; browser/ Playwright specs and API stubs; live/ opt-in suites
scripts/          Isolated test server, smoke test, asset verification, Mapbox env sync
docs/             Setup, routes, feature notes, deploy
.agents/          Architecture, coding rules and Git workflow
```

## Deployment

Production runs on Vercel and calls the backend from the Next.js server. It also needs `BACKEND_PROXY_KEY` and keeps `/demo` off. See [deploy](docs/deploy.vi.md).

## Documentation

| Topic                                  | Where                                                              |
| -------------------------------------- | ------------------------------------------------------------------ |
| Architecture                           | [.agents/project_architecture.md](.agents/project_architecture.md) |
| Coding rules                           | [.agents/coding_rule.md](.agents/coding_rule.md)                   |
| Setup, checks, troubleshooting         | [docs/setup.md](docs/setup.md)                                     |
| Routes and implementation status       | [docs/routes.md](docs/routes.md)                                   |
| Screens, data sources, proxy allowlist | [docs/scope-inventory.md](docs/scope-inventory.md)                 |
| Feature behavior (Vietnamese)          | `docs/*.vi.md`, one note per feature                               |
| Deploy (Vercel)                        | [docs/deploy.vi.md](docs/deploy.vi.md)                             |
| Endpoints and error codes              | `angi-backend/docs/ANGI_API_Design_Ver*.xlsx`                      |

## Contributing

1. Confirm the scope and the latest API contract, and that the backend implements it.
2. Reuse the owning feature, shared tokens, UI kit and site shell.
3. Add typed services and DTO mappings; never fall back to sample data when a call fails.
4. Handle loading, empty, error, denied, pending and success states.
5. Check role access, keyboard behavior and 320–1440px layouts.
6. Update the docs in the same change when you add or change a route, variable or integration.

Branches, commits and reviews follow [the Git guide](.agents/commit_guide.md). Automated assistants leave edits uncommitted and never push or create or merge pull requests.
