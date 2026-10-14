# ANGI — Frontend Project Architecture

This document describes the implemented frontend and its boundaries. Implementation rules: [coding_rule.md](coding_rule.md). Human Git workflow and assistant restrictions: [commit_guide.md](commit_guide.md). Team onboarding: [../README.md](../README.md).

## 0. Sources of truth

Use each source for the decision it owns. These rules summarize the FE implementation; they do not establish server contracts.

| Decision                                                | Source                                                                                                                                                              |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current routes, components, data flow and configuration | `../src/`, `../package.json`, `../.env.example` and `../.github/workflows/ci.yml`                                                                                   |
| Layout, visual tokens, assets and interaction states    | ANGI Figma references in [design coverage](../docs/design-coverage.md), [asset manifest](../docs/assets.json) and [design inventory](../docs/design-inventory.json) |
| Endpoint methods, DTOs, status codes, errors and enums  | Latest `ANGI_API_Design_Ver*.xlsx` from the separate backend repository, checked against its implementation/OpenAPI                                                 |
| Data semantics needed for API mapping                   | Latest backend data dictionary; FE never accesses the database directly                                                                                             |
| Framework behavior                                      | Installed Next.js guides in `../node_modules/next/dist/docs/` after `npm ci`                                                                                        |
| Work scope                                              | Assigned team ticket and its design references                                                                                                                      |

Backend workbooks are not bundled with FE. If a sibling `angi-backend` checkout exists, look under `../angi-backend/.docs/` from the frontend root and select the newest relevant workbook. No such checkout is required for FE-only work. Do not assume a workbook version or implement an endpoint from Figma/fixtures alone.

- For an API integration, verify the relevant request/response, DTO, error and enum entries and that the backend implements the operation. Preserve wire field names, nullability, ID types and units; map them to FE view models explicitly.
- When a contract or product decision is missing or contradictory, ask the responsible team member before implementing that behavior. Continue work whose requirements are clear.
- Follow the installed Next.js documentation for framework behavior. Keep these files aligned with code, and distinguish previews from working integrations.

## 1. Product and scope

ANGI (Ăn Gì) helps travelers discover Vietnamese regional dishes and restaurants and plan food itineraries. This repository contains the browser application and its Next.js API boundary. The REST backend and recommendation service are separate projects.

The FE covers Guest, Traveler, Restaurant Owner, Moderator and Administrator experiences. Authentication and F-43 owner registration/media upload are wired through Next.js Route Handlers. Most other business screens are fixture-backed previews; the whole-business adapter is still unavailable. Check the [README status table](../README.md#current-implementation-status) before describing a screen as integrated.

Documentation and identifiers are in English. Product copy and accessible labels are Vietnamese unless the team agrees to change the product language.

## 2. Installed stack

| Concern                 | Implementation                                                    |
| ----------------------- | ----------------------------------------------------------------- |
| Runtime/package manager | Node.js 24, npm and `package-lock.json`                           |
| Framework/UI            | Next.js 16.4 App Router, React 19.3, strict TypeScript            |
| Styling                 | Tailwind CSS 4, shared CSS and CSS custom properties              |
| Session                 | `iron-session`, encrypted HttpOnly cookie, Node.js Route Handlers |
| Server boundary         | `server-only`, native `fetch`, explicit proxy allowlist           |
| Unit tests              | Vitest; Node environment                                          |
| Browser checks          | Playwright; Chromium                                              |
| Code quality            | ESLint with Next.js rules, Prettier, TypeScript                   |

Reuse these tools. A new library or a replacement architecture requires a concrete need and team agreement. No ORM, database client or recommendation-service secret belongs in FE.

## 3. Repository structure

```text
.agents/                        Canonical architecture, coding and human Git rules
AGENTS.md                       Entry point for automated coding assistants
src/
  app/                          App Router pages, layouts, loading/error boundaries
    (public)/                   Login and other public auth flow pages
    (explore)/                  Public dishes, restaurants and guides
    (protected)/                Authenticated role workspaces
    api/auth/[action]/          Login, session, refresh and logout handlers
    api/backend/[...path]/      Allowlisted authenticated backend proxy
    demo/                       Isolated Guest/role previews
    dev/                        Component gallery and reproducible scenarios
  features/
    auth/                       Real auth DTOs, role policy, guards, session, forms
    platform/                   View models, provider, page router, shared UI rules
    discovery/                  Dish/restaurant discovery page composition
    blogs/                      Guides and community content
    roadmaps/                   Itineraries, planning and expenses
    profile/                    Account, preferences and notifications
    owner/                      Restaurant/menu/review workspace
    moderation/                 Moderator screens
    admin/                      Admin, permissions, audit and synchronization screens
  api/services/                 Business data adapters
  shared/api/                   Browser client, ApiError, response/HTTP helpers
  shared/types/                 Shared API envelope
  shared/ui/                    Base Button, Input, Card, Alert and Badge
  components/ui/               Fields, dialogs, tabs, tables and other primitives
  components/layout/           Workspace shells and navigation
  components/domain/           Reusable domain cards, map UI and status displays
  styles/theme/                Shared visual tokens
  mocks/                       Deterministic demo fixtures and scenarios
public/assets/                  Local design exports, fonts and licenses
tests/                          Unit and browser tests
scripts/                        Smoke, screenshot and asset verification tools
docs/                           Setup, design coverage and verification evidence
```

Keep the existing feature names. Backend module names express business ownership, not a requirement to rename `owner`, `blogs`, `profile` or `admin` folders.

## 4. Component and data boundaries

Routes select the page and enforce server access. Feature components compose the screen and interactions. Shared components render reusable controls. Services adapt data; they do not render UI.

```text
Live auth/API: Browser client -> Next.js Route Handler -> ANGI REST API
Business UI:  Feature page -> PlatformProvider -> DataService
Demo:         DataService -> isolated in-memory fixtures
```

- Server pages/layouts stay Server Components unless interactivity requires a client boundary. Interactive feature components use `"use client"`.
- Client modules must not import auth server helpers, backend tokens, private environment variables or Node-only modules.
- UI primitives must not depend on feature pages, providers or backend services. Domain components may depend on domain types and primitives.
- `features/auth/types.ts` contains verified auth DTOs. `features/platform/contracts.ts` contains frontend business view models and the `DataService` interface; these are not backend DTOs.
- Keep backend wire models separate from presentation models. Do not send a whole `AppData` object to an invented server endpoint.

## 5. Routes and roles

| Route family                                                                           | Access                                                | Purpose                                              |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| `/`, `/dishes/*`, `/restaurants/*`, `/guides/*`                                        | Public                                                | Discovery/community shells                           |
| `/login`                                                                               | Public, redirects an existing session home            | Real backend login                                   |
| `/register`, `/verify-email`, `/forgot-password`, `/reset-password`, `/setup-password` | Public                                                | Auth flow UI; integrations remain pending            |
| `/discovery/*`                                                                         | `TRAVELER`                                            | Traveler workspace                                   |
| `/restaurant/*`                                                                        | `RESTAURANT_OWNER`                                    | Owner workspace                                      |
| `/moderation/*`                                                                        | `MOD`, `ADMIN`                                        | Moderation workspace                                 |
| `/administration/*`                                                                    | `ADMIN`                                               | Administration workspace                             |
| `/demo/{guest,traveler,owner,moderator,admin}/*`                                       | Explicit preview                                      | Fixture-backed role screens; creates no auth session |
| `/dev/components`, `/dev/scenarios`                                                    | Development, or explicitly enabled production gallery | Component/state checks                               |

The `(protected)` layout requires a real session. Both root and nested role pages call `requireUser` with their allowed roles. Keep `RoleCode`, `HOME_BY_ROLE` and `ROLE_CODES` centralized in `features/auth`.

Missing sessions redirect to `/login`; a role mismatch redirects to that role's home. Hidden navigation and demo role selection do not authorize real requests. The backend remains authoritative for permissions, ownership and account state; the guard reads a session snapshot, not a fresh `/me` query.

## 6. API envelope and proxy

Backend paths start at `API_BASE_URL`, normally `http://localhost:5154/api/v1`. Browser calls use the same-origin `NEXT_PUBLIC_API_BASE_URL`, normally `/api`.

Every application API response uses:

```ts
interface ApiResponse<T> {
  success: boolean;
  message: string | null;
  errorCode: string | null;
  data: T | null;
  errors?: Record<string, string[]>;
}
```

`readApiResponse<T>` unwraps `data`, including successful `null`. `ApiError` retains HTTP status, `errorCode`, field errors, error data and `Retry-After`. Branch on codes, never on localized messages.

Working auth handlers:

| Next.js handler          | Backend operation                     | Browser data                                  |
| ------------------------ | ------------------------------------- | --------------------------------------------- |
| `POST /api/auth/login`   | `POST /api/v1/auth/login`             | `AuthUserDto`; token pair remains server-side |
| `GET /api/auth/session`  | Reads session; refreshes when expired | Cached user DTO, not a backend `/me` call     |
| `POST /api/auth/refresh` | `POST /api/v1/auth/refresh`           | Updated user DTO                              |
| `POST /api/auth/logout`  | `POST /api/v1/auth/logout`            | `null`                                        |

`api/backend/[...path]` allows `GET me`, `PATCH me`, `PUT me/password`, `GET/POST owner/restaurant` and `POST media`. Owner registration and multipart restaurant-image uploads are verified against API Design v1.8 and the backend implementation. The owner operations require a `RESTAURANT_OWNER` session; media requires authentication. The existing account allowlist entries still require backend availability verification.

The proxy checks the exact method/path, uses `withAuth`, forwards the configured backend request and preserves structured errors. It never accepts an arbitrary upstream URL. Review both the allowlist and the exported HTTP methods when adding an operation. Owner registration and media upload return 201; other configured methods return 200. Native `FormData` forwarding lets fetch generate the multipart boundary and remains replayable for the single authorized refresh retry.

## 7. Session and rotating refresh tokens

- `angi_session` is encrypted and HttpOnly, with `SameSite=Lax`, path `/`, and `Secure` in production. Cookie lifetime follows backend refresh expiry.
- The browser receives user information, never the access/refresh token pair. Tokens are not stored in localStorage or sessionStorage.
- `getSession`, `readAuth`, `saveAuth`, `destroySession`, `requireUser` and `withAuth` are server helpers. Cookie writes and rotation run in Route Handlers, not during Server Component rendering.
- `runAuthenticated` refreshes before an expired access token is sent, or on `UNAUTHORIZED`, and retries at most once. It does not refresh `FORBIDDEN` or unrelated business errors.
- Concurrent requests using one refresh token share a rotation. The session registry retains the latest pair so an older cookie cannot reintroduce an already rotated token within the process.
- Terminal session/account errors clear the cookie. Logout records local revocation. Full navigation after login/logout clears cached protected routes.
- `APP_URL` supplies the allowed Origin for mutations. Authenticated requests bypass fetch caching; do not introduce shared cache entries for personalized data.

Coordination and revocation currently live in one Next.js process. Multi-instance/serverless deployments need a shared session store, atomic refresh coordination and durable revocation. Process restart loses registry state; the current cookie alone does not guarantee durable logout revocation. Consider HTTPS, cookie size, secret rotation and trusted client IP handling before production deployment.

## 8. Business adapters and demonstration data

`PlatformProvider` owns readiness, retry, busy feedback, serialized mutations and toast state. `DataService.load()`/`save(next)` currently serve a frontend view model.

- `createDemoService` clones deterministic fixtures into a provider-owned repository. Changes persist during client navigation within that workspace and reset on reload/remount.
- `liveService` deliberately raises `UnavailableContractError`; the whole-business adapter is not implemented. Most live pages show unavailable/retry feedback. F-43 uses its own verified operation service, so owner root/profile/register can load the owner's restaurant or register one without depending on `AppData` readiness.
- `NEXT_PUBLIC_DATA_MODE=live` is the default. Explicit `/demo` workspaces force demo mode. Setting the global mode to `demo` does not bypass role guards on authenticated routes.
- Demo users and IDs are fixtures, not authenticated principals or server IDs. Demo uploads use local data URLs, invitations do not send email, and static map artwork does not provide live routing.
- Preserve coherent references between dishes, restaurants, menus and trips, separate pending menu edits, immutable published snapshots, distinct restaurant statuses, permission override semantics and retry-to-pending behavior.

The whole-`AppData` save operation is a demo interface, not a backend endpoint. Implement live data with verified per-operation DTO mapping when backend endpoints become available. A designed but unimplemented API must remain visibly unavailable rather than silently falling back to fixtures.

F-43 keeps wire DTOs, validation, media and location controls in `features/owner`. Demo registration uses an isolated mock service and publishes an explicit view-model mapping through `PlatformProvider.mutate`. Live registration first checks OWN-02: only `RESTAURANT_NOT_FOUND` enables a new form; transport failures offer retry and an existing restaurant prevents a duplicate. A successful OWN-01 response is unverified; verification submission remains a separate integration.

The live location picker supports manual coordinates and browser geolocation without external configuration. An optional public Mapbox token enables Static Images and explicit V6 forward geocoding with `permanent=true` because restaurant coordinates are stored; the provider account must support permanent geocoding. Demo maps remain local fixtures. Province suggestions use the fixed public V1 catalog through `/api/locations/provinces` to match the current required-district address contract; catalog errors allow manual full-name input. Neither map search nor province suggestions silently overwrites address fields.

## 9. UI system

Reuse tokens from `src/styles/theme/tokens.css`, base controls from `src/shared/ui` and composed primitives from `src/components/ui`. Layout and responsive behavior live in shared CSS and workspace shells.

Use local assets/fonts with recorded provenance and licenses. Preserve image geometry. Public files must not contain credentials, private documents or private media. Support keyboard access, visible focus, labeled controls, accessible feedback, modal focus handling, reduced motion and contained mobile overflow.

## 10. Configuration and quality checks

Environment variables are listed in `.env.example` and the README. Private values stay in `.env.local`; `NEXT_PUBLIC_*` values are embedded in browser builds. Demo/gallery availability must be set intentionally for each environment. Database credentials and external-service secrets must never be placed in browser code or public assets.

Current CI (`frontend-checks`) runs `npm ci`, lint, unit tests, production build and typecheck on PRs/pushes to `dev`/`main`. Browser, formatting, visual and asset checks are additional local checks, not current CI jobs. On a fresh checkout, build before standalone typecheck to generate route types.

Run checks relevant to the change and report what actually ran. Historical verification evidence is in `docs/verification.md`; it is not a guarantee that a later checkout passes. Follow the assistant restrictions in `AGENTS.md` and `commit_guide.md`.
