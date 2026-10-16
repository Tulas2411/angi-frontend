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

The FE covers Guest, Traveler, Restaurant Owner, Moderator and Administrator experiences. Authentication, F-43 registration/media, F-44 profile GET/PATCH, F-45 weekly-hours PUT, F-46 operating-status PUT, F-47 verification submission/private documents and F-48 verification history are wired through Next.js Route Handlers. Most other business screens are fixture-backed previews; the whole-business adapter is still unavailable. Check the [README status table](../README.md#current-implementation-status) before describing a screen as integrated.

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

Backend paths start at `API_BASE_URL`, normally `http://127.0.0.1:5154/api/v1` for the local Docker stack. Use the explicit IPv4 address because this stack binds IPv4 only and Node.js may resolve `localhost` to `::1`. Browser calls use the same-origin `NEXT_PUBLIC_API_BASE_URL`, normally `/api`.

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

`api/backend/[...path]` allows `GET me`, `PATCH me`, `PUT me/password`, `GET/POST/PATCH owner/restaurant`, `PUT owner/restaurant/business-hours`, `PUT owner/restaurant/operating-status`, `GET/POST owner/restaurant/verifications` and `POST media`. Owner registration/profile/hours/status/verification and multipart uploads are verified against API Design v1.8 and the backend implementation. The owner operations require a `RESTAURANT_OWNER` session; media requires authentication. The existing account allowlist entries still require backend availability verification.

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
- `liveService` deliberately raises `UnavailableContractError`; the whole-business adapter is not implemented. Most live pages show unavailable/retry feedback. F-43/F-44/F-45/F-46/F-47/F-48 use verified operation services: owner root/register handles registration, `/restaurant/profile` handles GET/PATCH, its hours/status tabs handle GET/PUT and `/restaurant/verification` handles OWN-06/OWN-07 without depending on `AppData` readiness.
- `NEXT_PUBLIC_DATA_MODE=live` is the default. Explicit `/demo` workspaces force demo mode. Setting the global mode to `demo` does not bypass role guards on authenticated routes.
- Demo users and IDs are fixtures, not authenticated principals or server IDs. Demo uploads use local data URLs and invitations do not send email. The shared explorer can request Mapbox Directions explicitly for a selected pair of coordinates, including in demo workspaces; this does not integrate itinerary route persistence or the pending recommendation/discovery adapters. This Mapbox delivery is code-only and remains untested at the owner's request.
- Preserve coherent references between dishes, restaurants, menus and trips, separate pending menu edits, immutable published snapshots, distinct restaurant statuses, permission override semantics and retry-to-pending behavior.

The whole-`AppData` save operation is a demo interface, not a backend endpoint. Implement live data with verified per-operation DTO mapping when backend endpoints become available. A designed but unimplemented API must remain visibly unavailable rather than silently falling back to fixtures.

F-43 keeps wire DTOs, validation, media and location controls in `features/owner`. Demo registration uses an isolated mock service and publishes an explicit view-model mapping through `PlatformProvider.mutate`. Live registration first checks OWN-02: only `RESTAURANT_NOT_FOUND` enables a new form; transport failures offer retry and an existing restaurant prevents a duplicate. A successful OWN-01 response is unverified; verification submission remains a separate integration.

F-44 owns the profile editor, patch builder and service in `features/owner`. Unchanged keys are omitted; optional values clear with `null` and gallery removal with `[]`. GET supplies image URLs without media IDs, so scalar edits leave images untouched. Full gallery replacement sends only newly uploaded IDs; the FE never derives IDs from URLs. Demo updates publish through the provider with fixture IDs and independently managed statuses preserved. `owner/pages.tsx` composes separate profile/hours/status editors; the previous status toggle is removed. Modal confirmations cover draft discard and image removal/replacement, including navigation to the hours/status editors in live and demo modes.

F-45 owns `restaurant-business-hours-page`, the typed business-hours service and pure validation in `features/owner`. OWN-02 loads `businessHours`; OWN-04 replaces the full week and returns saved `hours` plus `isOpenNow`. Intervals use numeric days 0–6 and Vietnam `HH:mm`; multiple and overnight intervals are allowed, while actual overlaps across midnight/week boundaries are rejected. Empty arrays clear the schedule. Demo saves publish the full interval list in the owner's `Restaurant.businessHours`; legacy `AppData.hours` is only a fixture seed when that optional list is absent, never a lossy one-interval save format. Explicit empty schedules and all profile/status relationships survive client navigation. Mock `isOpenNow` follows the BE UTC+7 schedule calculation; live UI consumes the returned flag. Confirmations use the shared modal. Final contract verification reopens the latest workbook after code/checks as required by the coding rules.

F-46 owns `restaurant-operating-status-page`, its typed service and rules in `features/owner`. OWN-02 loads the current restaurant; OWN-05 accepts the operating enum and optional note, returning only the saved enum. Every save is reviewed in a shared confirmation modal; cancel and dirty tab exits also use modals. The editor consumes the returned state, preserves drafts/field errors on failure and handles `RESTAURANT_SUSPENDED` as a restaurant conflict rather than an account/session error. Verification, moderation, hours and profile remain separate. Demo saves change only `Restaurant.operating`, retaining exact `temporarily_closed`/`permanently_closed` values; the legacy fixture value `closed` maps to `temporarily_closed` only at the fixture-to-wire boundary. Shared owner status summaries distinguish the closure states. A permanent closure can reopen if moderation allows, as implemented by BE. The FE does not write audit records itself; the backend records status transitions and the optional reason.

Owner browser checks use `scripts/owner-test-server.mjs`: it snapshots source, assets and non-secret configuration into a fresh ignored `.cache` workspace, shares installed dependencies, and starts its own frontend at port 3001. No private env file is copied; suites supply test-only auth and an API stub at 5164. Run owner suites sequentially because they share ports. `--build` compiles that snapshot without affecting a running preview. `--production` builds then serves the snapshot for the F-47 browser suite; the default for other suites remains dev. TypeScript excludes `.cache` so generated test workspaces do not become application sources.

The live location picker supports manual coordinates and browser geolocation without external configuration. An optional public Mapbox token enables the lazily imported Mapbox GL JS renderer. All pickers and explorers share MapLocationDialog, InteractiveLocationMap and shared/maps/mapbox. Wheel zoom/drag panning changes only the camera. Independent projected marker/summary cards retain selected coordinates when dismissed. WebGL/style failures preserve manual entry.

Mapbox GL JS 3.33's bundled declarations reference the global GeoJSON namespace. Keep `@types/geojson` as an explicit dev dependency, recorded in the npm lockfile, so clean CI installs resolve feature geometry/properties. This adds compile-time declarations without changing the map runtime or requiring a provider request.

The default map search filters supplied ANGI records and loaded Streets `poi_label` vector features within the viewport; it performs no search-provider request and is limited by zoom, coverage and loaded tiles. Explicit expanded POI mode uses Search Box forward/category; explicit address mode retains V6 forward geocoding with `permanent=true`. Category buttons use local features unless expanded POI mode is selected. Search Box geography and storage rights are provider constraints, not inferred from a working map token. Only explicit Owner selection fills blank name/street/phone/website draft fields; existing values and V2 province/ward data remain unchanged. No provider payload is spread into owner wire requests or stored in browser storage.

Owner response coordinates are nullable as documented and implemented in backend RestaurantCardDto. A profile without a valid coordinate pair keeps a null UI selection; unrelated PATCH fields omit coordinates. The map rejects invalid initial coordinates, and new registration still requires an explicit valid pair.

Owner registration/profile location pickers, including their demo paths, set `poiSearchOnly`: search always submits Search Box forward and neither the mode selectors nor category chips are rendered. Other pickers/explorers retain the full search controls. Requests remain explicit on submit/Enter; selection and owner request builders are unchanged.

MapDirectionsPanel submits Directions V5 only when requested, with driving/cycling/walking, alternatives, GeoJSON and Vietnamese steps. Endpoint/profile edits invalidate old routes and requests; choosing an alternative reuses the response. InteractiveLocationMap keeps one map, reinstalls ANGI/search/route sources after style.load, and switches streets/satellite styles without changing selected coordinates. No automatic typeahead, search-on-pan or route recalculation is used. MapboxPreview is now an on-demand explorer launcher rather than a Static Images download. Discovery, detail, matching Roll Dish fixtures and itinerary views share RestaurantMapButton; ANGI names and coordinates render directly. Source business data and live/demo integration status remain unchanged. Opening a map and loading/panning/changing styles can still incur Mapbox usage. The owner requested no tests or token probes for this change; see docs/mapbox-features.vi.md and docs/verification.md.

scripts/sync-mapbox-env.ps1 remains a manual helper that copies only a public pk. token from the sibling backend env into frontend local configuration; it was not run in this task. Province suggestions use the public V2 catalog through `/api/locations/provinces`; wards load by province through `/api/locations/provinces/{code}/wards`. Catalog errors allow manual full-name input. The owner request on 2026-10-16 removes district input and makes the legacy backend district optional; see docs/address-entry-v2.vi.md for the existing workbook discrepancy. Catalog loading does not rewrite stored address fields or coordinates; an explicit province change clears the dependent ward.

F-47 owns `restaurant-verification-page`, its typed service, private document control and pure validation in `features/owner`. OWN-02 determines initial-submit eligibility and supplies `latestVerification`. MEDIA-01 receives `purpose=verification_doc`; OWN-06 receives only legal fields and `{ docType, mediaId }` documents. Signed document URLs are opened on demand, never automatically previewed or persisted in browser storage. Failed uploads retry only the remaining queue; failed submissions preserve uploaded IDs and field errors. Shared modals cover send, removal, discard and dirty reload. Only `unverified` permits an initial submission; pending/verified/rejected and concurrent conflicts block it. The result moves verification to pending without changing profile, hours, moderation or operating state. Demo metadata is held in provider memory and follows `ownerRestaurantId`. Full history is integrated by F-48; resubmission (OWN-08) remains F-49.

F-48 adds `verification-history` and shared read-only `verification-details`. The status tab calls OWN-07 on entry or explicit refresh, consumes the restaurant flag independently of request status, preserves server history order and displays review metadata, private links and previous-request details in the shared Dialog. Successful history reads update the shared workspace verification state/latest record. Effects ignore stale responses after exit; errors stay distinct from an empty history. `?tab=status` selects the status view on entry. The mock keeps all selected-owner attempts and signed URLs are never prefetched. The F-48 production browser config includes affected F-47 regressions and no external providers.

The separate opt-in `playwright.verification-live.config.ts` exercises real local auth, private upload/submission, pending history persistence and document delivery using fresh seeded owners. Its Mapbox token is empty and external browser requests are blocked; only one synthetic private Cloudinary document per run is explicitly downloaded and cleaned up. Current BE/OpenAPI has no Moderator verification-decision endpoint, so real review transitions and multi-attempt feedback remain unverified. See [live evidence](../docs/verification-live.vi.md).

## 9. UI system

ProvinceField is the shared administrative-area autocomplete for restaurant registration/profile (live and demo), itinerary destinations, header/restaurant location search and the component gallery. It uses the same-origin public `/api/locations/provinces` route backed by Provinces Open API V2 (34 provinces/cities). WardField adds dependent ward suggestions to owner address forms using the selected province code; changing province clears the previous ward. District is retained only as optional legacy wire data. The browser service deduplicates requests, caches successful results for five minutes and publishes retries to all mounted fields; the provider fetch is revalidated daily. Vietnamese accent-insensitive matching preserves official names on selection. Existing values/manual entry remain editable when the catalog fails. Map dialogs use plain search inputs without province suggestions; their configured map search runs only on explicit submit/Enter. Province catalog loading never overwrites stored address fields or coordinates. Header searches pass the selected name to the restaurant list; demo filtering accepts both official and existing short province names.

Reuse tokens from `src/styles/theme/tokens.css`, base controls from `src/shared/ui` and composed primitives from `src/components/ui`. Layout and responsive behavior live in shared CSS and workspace shells.

Use local assets/fonts with recorded provenance and licenses. Preserve image geometry. Public files must not contain credentials, private documents or private media. Support keyboard access, visible focus, labeled controls, accessible feedback, modal focus handling, reduced motion and contained mobile overflow.

## 10. Configuration and quality checks

Environment variables are listed in `.env.example` and the README. Private values stay in `.env.local`; `NEXT_PUBLIC_*` values are embedded in browser builds. Demo/gallery availability must be set intentionally for each environment. Database credentials and external-service secrets must never be placed in browser code or public assets.

Current CI (`frontend-checks`) runs `npm ci`, lint, unit tests, production build and typecheck on PRs/pushes to `dev`/`main`. Browser, formatting, visual and asset checks are additional local checks, not current CI jobs. On a fresh checkout, build before standalone typecheck to generate route types.

Run checks relevant to the change and report what actually ran. Historical verification evidence is in `docs/verification.md`; it is not a guarantee that a later checkout passes. Follow the assistant restrictions in `AGENTS.md` and `commit_guide.md`.
