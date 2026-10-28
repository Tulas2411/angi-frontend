# ANGI — Frontend Project Architecture

This document describes the implemented frontend and its boundaries. Implementation rules: [coding_rule.md](coding_rule.md). Human Git workflow and assistant restrictions: [commit_guide.md](commit_guide.md). Team onboarding: [../README.md](../README.md).

## 0. Sources of truth

Use each source for the decision it owns. These rules summarize the FE implementation; they do not establish server contracts.

| Decision                                                | Source                                                                                                                                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current routes, components, data flow and configuration | `../src/`, `../package.json`, `../.env.example` and `../.github/workflows/ci.yml`                                                                                               |
| Layout, visual tokens, assets and interaction states    | The public homepage (`/`) and `../src/styles/theme/tokens.css`; Figma references in [design coverage](../docs/design-coverage.md) and the [asset manifest](../docs/assets.json) |
| Endpoint methods, DTOs, status codes, errors and enums  | Latest `ANGI_API_Design_Ver*.xlsx` in the backend repository (`angi-backend/.docs/`), checked against the backend implementation/OpenAPI                                        |
| Data semantics needed for API mapping                   | Latest backend data dictionary; FE never accesses the database directly                                                                                                         |
| Framework behavior                                      | Installed Next.js guides in `../node_modules/next/dist/docs/` after `npm ci`                                                                                                    |
| Work scope                                              | Assigned team ticket and its design references                                                                                                                                  |

Backend workbooks are not bundled with FE. If a sibling `angi-backend` checkout exists, look under `../angi-backend/.docs/` and select the newest relevant workbook; copies under a `docs/` folder may be older. Do not implement an endpoint from Figma or a fixture alone.

- For an API integration, verify the relevant request/response, DTO, error and enum entries and that the backend implements the operation. Preserve wire field names, nullability, ID types and units; map them to FE view models explicitly.
- When a contract or product decision is missing or contradictory, ask the responsible team member before implementing that behavior.
- Follow the installed Next.js documentation for framework behavior. Keep these files aligned with code.

## 1. Product and scope

ANGI (Ăn Gì) helps travelers discover Vietnamese regional dishes and restaurants and plan food itineraries. This repository contains the browser application and its Next.js API boundary. The REST backend and recommendation service are separate projects.

**Two kinds of screens coexist.** _Backend-integrated screens_ (authentication, `/account`, the Restaurant Owner workspace and the Traveler roadmap list `/roadmaps`, detail `/roadmaps/{id}` and planner `/roadmaps/new`) use the shared site shell and real API services only; a failed call shows retry feedback, never sample data. _Earlier workspace screens_ (public dishes/restaurants/guides, `/demo/*` role previews, Traveler pages, blogs, notifications, owner reviews, moderation and administration) stay as their authors built them: they run on demo fixtures wherever no backend adapter exists yet, keep their own shell and styles (`legacy-ui`), and are removed or integrated only by their owners.

| Area                                                         | Backend operations                       | Route                                                                                            |
| ------------------------------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Public homepage                                              | RM-01 (quick planner); editorial previews | `/`                                                                                              |
| Register, verify email, login, Google login, logout, refresh | AUTH-01..09                              | `/register`, `/verify-email`, `/verify-success`, `/login`, `/forgot-password`, `/reset-password` |
| Account profile and password                                 | ME-01, ME-02, ME-03                      | `/account`                                                                                       |
| Owner overview, registration, profile, hours, status         | OWN-01..05, MEDIA-01                     | `/restaurant`, `/restaurant/register`, `/restaurant/profile`                                     |
| Owner verification and resubmission                          | OWN-06..08, MEDIA-01                     | `/restaurant/verification`                                                                       |
| Owner menu, drafts, approval submission                      | OWN-09..18, CAT-02, MEDIA-01             | `/restaurant/menu`                                                                               |
| Traveler roadmap detail (F-21)                               | RM-03, RM-14, RM-06, RM-07, RM-08, RM-09, RM-10, RM-11, RM-13               | `/roadmaps/{roadmapId}`                                                                          |
| Traveler roadmap list (F-20)                                 | RM-02                                    | `/roadmaps`                                                                                      |
| Traveler roadmap planner (F-19)                              | RM-01, RM-04                             | `/roadmaps/new`                                                                                  |
| Province and ward suggestions                                | Public Provinces Open API V2 (via proxy) | used by owner address forms                                                                      |

Earlier workspace screens that remain (demo fixtures unless noted): Traveler pages (profile, roadmaps, notifications) and the Owner/Moderator/Administrator previews under `/demo/*`; owner reviews, notifications and the remaining owner pages through `(protected)/(legacy)/restaurant/[...segments]`; `/moderation/*` and `/administration/*`. Their pages live in `features/{profile,roadmaps,moderation,admin,platform}`, use `PlatformProvider` and `src/mocks`, and render inside `WorkspaceShell` wrapped in `LegacyScope`. Authors integrate them endpoint by endpoint; see the [scope inventory](../docs/scope-inventory.md).

Documentation and identifiers are in English. Product copy and accessible labels are Vietnamese.

## 2. Installed stack

| Concern                 | Implementation                                                    |
| ----------------------- | ----------------------------------------------------------------- |
| Runtime/package manager | Node.js 22+ (24 recommended), npm and `package-lock.json`         |
| Framework/UI            | Next.js 16.4 App Router, React 19.3, strict TypeScript            |
| Styling                 | Shared CSS (`src/app/globals.css`) over CSS custom properties     |
| Session                 | `iron-session`, encrypted HttpOnly cookie, Node.js Route Handlers |
| Server boundary         | `server-only`, native `fetch`, explicit proxy allowlist           |
| Maps                    | `mapbox-gl`: owner location picker and read-only roadmap stop map |
| Unit tests              | Vitest; Node environment                                          |
| Browser checks          | Playwright; Chromium; local API stubs                             |
| Code quality            | ESLint with Next.js rules, Prettier, TypeScript                   |

Reuse these tools. A new library or a replacement architecture requires a concrete need and team agreement. No ORM, database client or recommendation-service secret belongs in FE.

## 3. Repository structure

```text
.agents/                        Canonical architecture, coding and human Git rules
docs/                           Setup detail, feature notes, verification evidence, inventory
public/assets/                  Local fonts, homepage photos, logo (see docs/assets.json)
scripts/                        owner-test-server (isolated test build), smoke test, asset check
tests/                          Vitest unit tests; browser/ (Playwright + API stubs); live/ (opt-in)
src/
  app/
    layout.tsx, page.tsx        Root layout and public homepage (owner session redirects)
    not-found.tsx               404 for every removed or unknown route
    (public)/                   login, register, verify-email, verify-success, forgot/reset password
    (protected)/                Layout calls requireUser(); account/ and restaurant/*
    api/auth/[action]           Login, Google, register, refresh, logout, recovery (BFF)
    api/backend/[...path]       Authenticated proxy with an exact method/path allowlist
    api/locations/*             Public province/ward catalogue proxy
  components/
    site/                       SiteHeader, SiteNav, AccountMenu, SiteFooter (shared by home and app)
    layout/                     PageHeading
    ui/                         Composed primitives: Field, PasswordField, Combobox, Dialog, ConfirmDialog, …
    domain/                     Map picker, province and ward fields
    providers/                  Google OAuth provider
  features/
    auth/                       Session, roles, forms, server helpers, DTOs
    account/                    Account page, rules, service
    discovery/                  Public homepage, quick roadmap entry and local editorial content
    owner/                      Owner pages, services, rules, DTOs
  shared/                       API client/errors/HTTP helpers, base UI, locations, maps, formatting
  styles/theme/tokens.css       Colors, type, spacing, radii, shadows, layout and motion tokens
```

- Server pages/layouts stay Server Components unless interactivity requires a client boundary. Interactive feature components use `"use client"`.
- Client modules must not import auth server helpers, backend tokens, private environment variables or Node-only modules.
- UI primitives must not depend on feature pages or backend services. Domain components may depend on domain types and primitives.
- Wire DTOs live in the owning feature (`features/*/…-types.ts`) and are mapped explicitly where a view needs another shape.

## 4. Visual system

The palette and fonts come from the public homepage and are unchanged: Canvas `#F4EFE7`, Card `#FFFFFF`, Control `#EEE9E7`, Ink `#222222`, Muted `#68615D`, Coral `#FF5E62`, Line `#E7E3E5`. Headings and the brand use Fraunces 900; body text and controls use Be Vietnam Pro 400/600 (DM Sans 400/600 is available as an alternate). Fonts are served from `public/assets/fonts`.

All pages share one page width (`--page-width`, 1224px), gutter (`--gutter`) and header (`--header-height`) defined in `tokens.css`. The homepage and protected pages use the same `SiteHeader`, `AccountMenu` and `SiteFooter`. Use tokens and the shared primitives; do not copy a control or dialog into a feature.

F-21 is a route-scoped full-width workbench matching Figma `24:1383`: left day navigation, center notebook and right viewport-height map. `.roadmap-detail-page` scopes the shell width/header/footer adjustments through `:has`; other routes keep the standard shell. The detail view uses Figma's DM Sans/Fraunces fonts, existing tokens/components and exact local disclosure/connector assets. Below 901px the day list scrolls horizontally and the map stacks above the content.

## 5. Routes and roles

| Route                                                                                                                                                                  | Access             | Behavior                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------- |
| `/`                                                                                                                                                                    | Public             | Homepage; owners are redirected to `/restaurant`; other signed-in roles see the homepage with the account menu |
| `/login`                                                                                                                                                               | Public             | Stays reachable with a session so users can switch accounts                                                    |
| `/register`, `/verify-email`, `/verify-success`, `/forgot-password`, `/reset-password`                                                                                 | Public             | `/reset-password` without a token redirects to `/forgot-password`                                              |
| `/account`                                                                                                                                                             | Any signed-in role | ME-01/02/03                                                                                                    |
| `/restaurant`, `/restaurant/*`                                                                                                                                         | `RESTAURANT_OWNER` | Other roles are redirected to their landing page (`/`)                                                         |
| `/demo/*`, `/dev/*` (development only), `/restaurant/reviews` and other legacy owner paths, `/moderation/*`, `/administration/*` | See each page      | Earlier workspace screens; guarded by `requireUser` where they are role pages                                  |
| Anything else                                                                                                                                                          | —                  | 404                                                                                                            |

Landing page after login (`HOME_BY_ROLE` in `features/auth/roles.ts`): Traveler `/`, Owner `/restaurant`, Moderator `/moderation`, Administrator `/administration`.

The `(protected)` area has two route groups with their own shell: `(app)` (account and the integrated owner pages, `AppShell`) and `(legacy)` (moderation, administration and the earlier owner pages, `LegacyAppShell`); both call `requireUser()`; role-specific pages call `requireUser([...roles])`. Missing sessions redirect to `/login`; a role mismatch redirects to that role's landing page. UI visibility does not authorize anything: the backend remains authoritative for permissions, ownership and account state, and the guard reads a session snapshot, not a fresh `/me` query.

## 6. API boundary and authentication

Browser code calls only same-origin routes through `src/shared/api/client.ts`:

- `/api/auth/[action]` — `register`, `verify-email`, `verify-email/resend`, `forgot-password`, `reset-password`, `login`, `google`, `refresh`, `logout`, `session`. Login stores the backend token pair in an encrypted HttpOnly cookie (`iron-session`); tokens never reach browser JavaScript.
- `/api/backend/[...path]` — authenticated proxy. A request must match an exact `METHOD path` entry (account `me`, `me/password`, `owner/restaurant…`, `media`, `tags`, verification resubmission, and the validated owner-menu operations). Mutations check `Origin`. Owner paths additionally require the `RESTAURANT_OWNER` role. Anything else answers `404 ROUTE_NOT_FOUND`.
- `/api/locations/provinces[/{code}/wards]` — public administrative catalogue (Provinces Open API V2, after the 2025 merger), cached.

Rules: `ApiResponse.data` is unwrapped by the client; failures raise `ApiError` and callers branch on `errorCode`, never on localized text. `withAuth` refreshes an expired access token once (single-flight), saves the rotated pair and retries once after `UNAUTHORIZED`. Logout revokes the refresh token and the local session. Process-local session registries do not support multi-instance deployments without a shared store.

An allowlist entry is not proof that an endpoint is implemented: confirm it in the backend before adding it, and keep the designed success status.

## 7. Feature notes

- **Roadmap food assistant** (`features/roadmaps/roadmap-agent-panel.tsx`): a non-modal sliding panel follows Figma `137:712`, keeps the existing map mounted and calls AGENT-01..04 through a Traveler-only proxy. **Backend implementation is pending**; the owner explicitly authorized FE-first delivery on 2026-10-26 using the supplied API Design workbook. No mock reply fallback exists in product source. Conversation IDs alone are stored per user/roadmap; state/history remain backend-owned. Processing uses bounded GET polling, retries retain the original message payload, proposal confirmation uses the exact displayed ID/version and successful commits reload RM-03. See [roadmap-agent.vi.md](../docs/roadmap-agent.vi.md).

- **Account** (`features/account`): ME-01 loads the profile; ME-02 sends only changed fields and uses explicit `null` to clear phone/bio; ME-03 omits `currentPassword` when the account has no password (Google-only) and maps `WRONG_CURRENT_PASSWORD` to the field. A saved display name triggers a session refresh so the header updates.
- **Owner** (`features/owner`): the overview is built from OWN-02. Registration (OWN-01) first checks OWN-02: only `RESTAURANT_NOT_FOUND` enables the form. Profile (OWN-03) omits unchanged keys, clears optional values with `null` and gallery removal with `[]`; images are uploaded through MEDIA-01 and only numeric media IDs are sent. Business hours (OWN-04) replace the whole week with `HH:mm` Vietnam time and allow overnight intervals. Operating status (OWN-05) always passes a confirmation dialog and treats `RESTAURANT_SUSPENDED` as a conflict. Verification (OWN-06/07/08) uploads private documents, shows full history, and resubmits with a complete body. The menu (OWN-09..18) edits an isolated draft, then submits it for moderator approval without replacing the active menu. Verification, operating and moderation statuses are separate and are never merged.
- **Homepage** (`features/discovery`): server-rendered; the three-field quick planner calls the existing `roadmapService.create` (RM-01) only after explicit Traveler submission. Guests keep a non-secret session draft through login and submit again after returning. The destination is retained through the existing local destination helper, since RM-01 has no province field. Search and taste filters live in the URL and select a local editorial collection. Photo layout is shuffled on the server and serialized for hydration. The taste and roadmap examples are client islands, are not saved, and call no backend. See [public homepage](../docs/public-homepage.md) and [quick planner](../docs/home-roadmap-starter.vi.md).
- **Maps**: `MapLocationDialog` is used only by the owner location picker. It searches only when the user submits, optionally reverse-geocodes one selected point to prefill the address, and falls back to manual coordinates. No Mapbox call happens without a user action. See [map address prefill](../docs/map-address-prefill.vi.md).
- **Roadmap map (F-21)**: `RoadmapDetailMap` uses only RM-03 restaurant coordinates for numbered/grouped stop markers, with shared day/item selection and read-only real-data info/rating/dish-photo panels. It consumes the existing itinerary's cached RM-14 effective origin; it does not request Directions/geocoding or invent route geometry. Missing configuration/coordinates/provider errors retain the actual stop list. Numbered marker elements explicitly keep button semantics when Mapbox mounts them. Offline browser checks use a fake token and fulfilled local style; live Mapbox quota is not used. See [roadmap detail](../docs/roadmap-detail.vi.md).
- **Locations**: `ProvinceField`/`WardField` use the shared catalogue; typed values stay editable when the catalogue fails.

## 8. Testing

| Suite                          | Command                | Notes                                                                                           |
| ------------------------------ | ---------------------- | ----------------------------------------------------------------------------------------------- |
| Unit                           | `npm test`             | Rules, DTO builders, services, proxy allowlist, session logic                                   |
| Public, auth, routing, account | `npm run test:browser` | Isolated production build + local auth stub (port 5164)                                         |
| Owner workspace                | `npm run test:owner`   | Local API stub; Mapbox disabled                                                                 |
| Map, registration, profile     | `npm run test:map`     | Placeholder token; every Mapbox request is intercepted by the specs                             |
| Local smoke                    | `npm run test:smoke`   | Real local backend and seeded accounts; needs `ANGI_TEST_PASSWORD` and `SESSION_PASSWORD`       |
| Live (opt-in)                  | `npm run test:live`    | Real local backend, own accounts; see [live verification](../docs/live-backend-verification.md) |

`scripts/owner-test-server.mjs` snapshots source and public assets into an ignored `.cache/owner-test-*` workspace, shares installed dependencies and serves it on port 3001 so a running preview is untouched. Use `--production` (build, then `next start`), `--build` (compile only) or the default `next dev` (React Strict Mode is disabled in that dev snapshot so request counts match production). No private env file is copied. Run suites sequentially: they share ports 3001 and 5164. Test fixtures live under `tests/`; product code never imports them.

## 9. Configuration

Variables are listed in `.env.example` and the README. `API_BASE_URL`, `SESSION_PASSWORD` and `APP_URL` are server-only. `NEXT_PUBLIC_API_BASE_URL` (normally `/api`), `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` (public `pk.` token, optional) and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (optional; without it the Google button is not rendered) are embedded in browser builds. Database credentials and external-service secrets must never be placed in browser code or public assets.

Mapbox usage policy: do not probe tokens, open live maps or run provider-consuming tests without an explicit request. Automated suites intercept all Mapbox traffic.
