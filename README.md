# angi-frontend

ANGI (Ăn Gì) is a Vietnamese food discovery and itinerary-planning application. This repository contains the Next.js frontend for guests, travelers, restaurant owners, moderators and administrators, together with a server-side API boundary for the separate [ANGI backend](https://github.com/predtn/angi-backend).

The product UI is Vietnamese. Team documentation and code identifiers are English.

## Start here

- New team member: follow [Local setup](#local-setup), then open `/demo` to explore the screens.
- Implementing a feature: read [Project architecture](.agents/project_architecture.md) and [Coding rules](.agents/coding_rule.md).
- Integrating an API: read [API and authentication](#api-and-authentication) and the latest backend API Design before adding a service.
- Reviewing a change: use [Checks](#checks), [Design coverage](docs/design-coverage.md) and [Human Git workflow](.agents/commit_guide.md).

## Current implementation status

| Area                                                                                     | Status                                                              |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Login, token refresh and logout                                                          | Connected to the existing backend through Next.js Route Handlers    |
| Encrypted session and role guards                                                        | Implemented; real role workspaces require a backend login           |
| Dish/restaurant discovery, guides, itineraries and expenses                              | Interactive frontend screens using isolated demo data               |
| Owner, moderation, administration, permissions, audit and sync screens                   | Interactive frontend screens using isolated demo data               |
| Live business data                                                                       | Adapter not implemented; live pages show unavailable/retry feedback |
| Registration, verification/recovery, OAuth, invitations, cloud uploads, live maps and AI | UI/scaffold exists where designed; real integrations remain pending |

A successful demo action changes local fixture state. It does not persist business data, send an email or authenticate the selected demo role. Backend API Design describes planned contracts; an entry in that workbook does not prove that an endpoint has been implemented.

## Technology

| Concern                  | Stack                                                                          |
| ------------------------ | ------------------------------------------------------------------------------ |
| Runtime and dependencies | Node.js 24, npm, committed npm lockfile                                        |
| Application              | Next.js 16.4 App Router, React 19.3, strict TypeScript                         |
| UI                       | Tailwind CSS 4, CSS tokens, reusable native/React controls, local fonts/assets |
| Authentication           | `iron-session`, encrypted HttpOnly cookie, rotating backend tokens             |
| Quality                  | ESLint, Prettier, Vitest and Playwright                                        |

Use the versions declared in `package.json`/`package-lock.json`. Framework guides matching the installed Next.js version are available in `node_modules/next/dist/docs/` after installation.

## Local setup

### 1. Install the frontend

Install Node.js 24 and npm. Clone the repo if needed, use the team's assigned working branch, and run commands from the `angi-frontend` directory:

```sh
git clone https://github.com/Tulas2411/angi-frontend.git
cd angi-frontend
npm ci
```

### 2. Create local configuration

Copy `.env.example` to `.env.local` on first setup. Preserve an existing `.env.local`.

PowerShell:

```powershell
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
```

On macOS/Linux, use `cp .env.example .env.local` only when the local file does not already exist.

Generate a private session key, then paste the output into `SESSION_PASSWORD` in `.env.local`:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

| Variable                               | Example/default                             | Purpose                                                                          |
| -------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------- |
| `API_BASE_URL`                         | `http://localhost:5154/api/v1`              | Private server-side REST API base URL                                            |
| `NEXT_PUBLIC_API_BASE_URL`             | `/api`                                      | Same-origin Next.js handlers called by the browser                               |
| `APP_URL`                              | `http://localhost:3000`                     | Exact browser origin allowed for mutations                                       |
| `SESSION_PASSWORD`                     | Your own random key, at least 32 characters | Encrypts the frontend session cookie; required for auth                          |
| `NEXT_PUBLIC_DATA_MODE`                | `live`                                      | Business data mode; `demo` opts workspace shells into fixtures                   |
| `NEXT_PUBLIC_ENABLE_DEMO`              | `true`                                      | Set `false` to disable the `/demo` route family                                  |
| `NEXT_PUBLIC_ENABLE_COMPONENT_GALLERY` | `false`                                     | Gallery/scenarios are available in development; production needs explicit `true` |

Keep real values in `.env.local`, which is ignored by Git. Variables prefixed with `NEXT_PUBLIC_` are public and selected at build time. Restart dev or rebuild after changing them. Keep the browser API base `/api`; calling the backend directly would bypass this app's session and proxy flow. Changing the app port or hostname also requires matching `APP_URL`.

### 3. Run a frontend preview

```sh
npm run dev
```

Open [the demo selector](http://localhost:3000/demo). It works without Docker or a running backend and provides separate Guest, Traveler, Owner, Moderator and Admin workspaces.

For design/component work, use [the component gallery](http://localhost:3000/dev/components) and [reproducible state scenarios](http://localhost:3000/dev/scenarios). Fixture changes reset on page reload or workspace remount.

The default business mode is `live`, so the regular public/role business pages show unavailable feedback until a live adapter is implemented. `/demo` explicitly uses fixtures. Setting `NEXT_PUBLIC_DATA_MODE=demo` does not remove authentication from protected real routes.

### 4. Run real authentication when needed

Real `/login`, refresh and logout require the backend. Install Docker and .NET 10 SDK, prepare `angi-backend` using its [local database and secret configuration instructions](https://github.com/predtn/angi-backend#local-database), then start it from that repository:

```sh
dotnet run --project ANGI.WebApi --launch-profile http
```

The current HTTP profile serves `http://localhost:5154`. In Development, backend startup applies its EF migrations. Use the PostgreSQL port/password from the backend `.env`; its default port is 5432, while individual machines may use another free port such as 5433.

Open [Scalar API documentation](http://localhost:5154/scalar). Keep `API_BASE_URL` aligned with the actual API host and `/api/v1` prefix. Ask the backend maintainer for an isolated development account; frontend demo users cannot log in through the real auth API. Private helper launchers, a portable SDK and seeded passwords from someone else's machine are not part of this repo or required for this setup.

## Routes and access

| Route                                                                                  | Access/purpose                                            |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `/`, `/dishes/*`, `/restaurants/*`, `/guides/*`                                        | Public discovery/community screens                        |
| `/login`                                                                               | Real login; existing sessions redirect to their role home |
| `/register`, `/verify-email`, `/forgot-password`, `/reset-password`, `/setup-password` | Public auth flow UI; live integrations pending            |
| `/discovery/*`                                                                         | `TRAVELER`                                                |
| `/restaurant/*`                                                                        | `RESTAURANT_OWNER`                                        |
| `/moderation/*`                                                                        | `MOD` and `ADMIN`                                         |
| `/administration/*`                                                                    | `ADMIN`                                                   |
| `/demo/guest`, `/demo/traveler`, `/demo/owner`, `/demo/moderator`, `/demo/admin`       | Isolated fixture-backed previews and nested screens       |
| `/dev/components`, `/dev/scenarios`                                                    | Development galleries; explicitly gated in production     |

Server guards authenticate the protected layout and enforce the role on root/nested pages. Missing sessions redirect to `/login`; wrong roles redirect to their own home. UI permission checks explain access, while the backend authorizes live requests. A demo role creates no session cookie.

## Repository map

```text
.agents/                Architecture, coding rules and human Git conventions
AGENTS.md               Rules and entry point for coding assistants
src/app/                Routes, layouts, server guards and Next.js API handlers
src/features/auth/      Verified auth DTOs, session/refresh logic and auth forms
src/features/platform/  Business view models, provider, shared rules and page router
src/features/*/         Discovery, blogs, roadmaps, profile, owner, moderation, admin
src/api/services/       Demo/live business adapter boundary
src/shared/api/         Browser client, ApiError and response/HTTP helpers
src/shared/ui/          Base controls and variants
src/components/         Composed UI, layouts and domain components
src/styles/theme/       Shared visual tokens
src/mocks/              Deterministic demo data and scenarios
public/assets/          Local Figma exports, fonts and licenses
tests/                  Unit tests and browser tests
scripts/                Smoke, visual/state capture and asset verification tools
docs/                   Setup detail, design mappings and verification evidence
```

The business models in `features/platform/contracts.ts` are frontend view models, not verified server DTOs. The current `DataService` loads/saves a whole view model for demo state; this is not a proposed backend endpoint. Implement verified DTO mapping behind the adapter boundary when connecting a feature to live data.

## API and authentication

```text
Browser -> same-origin /api handlers -> ANGI backend /api/v1
```

Backend responses use `ApiResponse<T>`. The shared client returns its `data` field, including successful `null`; failures become `ApiError` with `status`, `errorCode`, field `errors`, error `data` and `retryAfter`. Branch on `errorCode`, never on localized messages.

For a client-side auth interaction:

```tsx
import { api } from "@/shared/api/client";
import { ApiError, getErrorMessage } from "@/shared/api/error";

try {
  const user = await api.login({ email, password });
  // user is AuthUserDto from response.data; tokens are not returned to the browser.
  handleSignedIn(user);
} catch (error) {
  if (error instanceof ApiError && error.errorCode === "VALIDATION_FAILED") {
    setFieldErrors(error.errors ?? {});
  }
  setFormError(getErrorMessage(error));
}
```

`email`, `password` and UI callbacks above are supplied by the form. Existing implementations are in `src/features/auth/login-form.tsx` and `src/shared/api/client.ts`.

- Auth handlers implement login, session, refresh and logout. `/api/auth/session` reads a cached user snapshot and refreshes expired tokens; it does not call a backend `/me` endpoint.
- Tokens live in encrypted `angi_session` cookies with HttpOnly and SameSite protections; Secure is enabled in production. They are not stored in browser storage or passed to client components.
- Authenticated calls use the current access token, rotate on expiry/`UNAUTHORIZED` and retry at most once. Concurrent refreshes share a rotation, and a registry retains the latest pair for delayed cookies. Other permission/business failures do not trigger refresh.
- Mutations validate Origin using `APP_URL`. Personalized responses are not cached. Login/logout use full navigation to clear cached protected routes.
- The backend proxy has an exact method/path allowlist. Its current `me`/password entries are planned account operations, not working backend endpoints. Adding a client helper alone does not enable an operation; add verified DTOs, the allowed method/path and its Route Handler export together.

The canonical API workbook is maintained in `angi-backend/.docs/ANGI_API_Design_Ver*.xlsx` (currently v1.8 in the sibling checkout). Read the newest version and verify backend availability before connecting business APIs. Do not silently substitute demo data when a live call fails.

Session coordination and revocation currently run in one Next.js process. Before using multiple instances/serverless, add a shared session store with atomic refresh coordination and durable revocation. Process-local maps do not survive restarts. Production configuration also needs HTTPS, private environment keys, considered cookie size/client IP handling, and an explicit decision about demo/gallery availability.

## Checks

CI runs on PRs and pushes to `dev`/`main` with the `frontend-checks` job:

```sh
npm run lint
npm test
npm run build
npm run typecheck
```

Build before standalone typecheck on a fresh checkout so Next.js route types exist. These checks do not require a running backend.

Additional checks:

| Command                                                    | Purpose/prerequisites                                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `npm run format:check`                                     | Existing source/tests/scripts/docs formatting check                                               |
| `npm exec prettier -- --check README.md AGENTS.md .agents` | README and rule-document formatting                                                               |
| `npm run test:browser`                                     | Chromium behavior/access/keyboard checks; Playwright starts dev or reuses port 3000               |
| `npm run test:visual`                                      | Route screenshots and page/asset/overflow checks; dev server must be running                      |
| `npm run test:states`                                      | Interaction/scenario captures; dev server must be running                                         |
| `node scripts/verify-assets.mjs`                           | Local design assets and font/license verification                                                 |
| `npm run test:smoke`                                       | Existing real-auth integration checks; local backend/frontend and prepared test accounts required |

For browser checks, install Chromium. PowerShell example using a local cache:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH='.cache/browsers'
npx playwright install chromium
npm run test:browser
```

On macOS/Linux, set/export `PLAYWRIGHT_BROWSERS_PATH=.cache/browsers` before the same install/test commands. Screenshot scripts additionally accept `PLAYWRIGHT_BASE_URL`; the current Playwright config itself uses localhost:3000.

The optional smoke script expects active, verified local accounts `traveler@angi.local`, `owner@angi.local`, `mod@angi.local` and `admin@angi.local`, with their matching roles and a common test password. Provide `ANGI_TEST_PASSWORD` in your shell; otherwise it tries a private sibling `.tools/local-settings.json` file that is not shipped in this repo. Arrange isolated test data with the backend maintainer. Do not run this script against shared/production accounts or store test passwords in source.

Generated reports/screenshots/cache files stay under ignored `artifacts/`, `playwright-report/`, `test-results/` and `.cache/`. [Verification results](docs/verification.md) record historical scope and limitations; rerun relevant checks for your change rather than treating that report as current CI evidence.

## Working on a feature

1. Confirm the assigned scope, Figma references and latest API contract.
2. Reuse the owning feature, shared tokens, UI kit and workspace navigation.
3. Add verified service/DTO mappings for live data, keeping fixtures isolated.
4. Handle loading, empty, error, unavailable, denied, pending and success states.
5. Check relevant logic, role access, keyboard behavior and desktop/mobile layouts.
6. Update docs/design mappings when adding routes, state variants, variables or supported integrations.

Human maintainers manage branches, commits and reviews according to [the Git guide](.agents/commit_guide.md). Automated assistants must leave edits unstaged/uncommitted and must not create/modify commits, rewrite history, push, or create/merge PRs.

## Troubleshooting

| Symptom                                         | Check                                                                                           |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `/login` reports a session key error            | Set `SESSION_PASSWORD` to your private random key (at least 32 characters) and restart          |
| Login cannot connect                            | Check the backend is running and `API_BASE_URL` includes `/api/v1`                              |
| Mutation returns `FORBIDDEN`                    | Match the browser origin/port to `APP_URL`; do not disable Origin validation                    |
| Business pages show unavailable data            | Current live adapter is intentionally unavailable; use explicit `/demo` previews                |
| A demo user cannot access a real role route     | Demo selection is not authentication; log in with a real local backend account                  |
| Typecheck reports missing generated route types | Run build before standalone typecheck on a fresh checkout                                       |
| Gallery/demo is missing                         | Check environment flags, development/production mode and whether public env values were rebuilt |
| Browser tests cannot find Chromium              | Install it with the same `PLAYWRIGHT_BROWSERS_PATH` used by the test process                    |

## Further documentation

- [Frontend project architecture](.agents/project_architecture.md)
- [Frontend coding rules](.agents/coding_rule.md)
- [Human Git and review guide](.agents/commit_guide.md)
- [Setup and previews](docs/setup.md)
- [Scaffold implementation notes](docs/architecture.md)
- [Figma design coverage](docs/design-coverage.md)
- [Verification evidence and remaining limits](docs/verification.md)
