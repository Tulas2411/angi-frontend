# ANGI — Frontend Coding Rules

Rules for changes to `angi-frontend`. Read [project_architecture.md](project_architecture.md), especially its sources of truth, before implementation. Team onboarding: [../README.md](../README.md). Git restrictions and human workflow: [commit_guide.md](commit_guide.md).

## 1. Scope and feature ownership

- Use the existing `src/features` folders. Add page behavior in the owning feature, reusable controls in the UI kit and API mapping at the service boundary.
- Keep `src/app` focused on routing, metadata, server guards, layouts and page composition. Do not duplicate a whole feature inside a route file.
- New screens ship only when integrated with the real backend: no mock service, fixture fallback or placeholder business screen in them. Earlier workspace screens stay as their authors built them (demo fixtures included) until their owners integrate or retire them. Never delete or rewrite another teammate's module because an endpoint is missing: hide the route or ask the author. Test fixtures live under `tests/` and are never imported by new `src` code. Extract pure calculations and presentation rules into `*-rules.ts` files so they can be tested independently.
- Scope changes to the assigned FE feature. Add dependencies, roles or API contracts only when the task and verified sources require them.

## 2. Dependency direction

| Area                        | May depend on                                           | Must not depend on                                           |
| --------------------------- | ------------------------------------------------------- | ------------------------------------------------------------ |
| Base/composed UI primitives | React, shared UI/types and visual tokens                | Feature pages, business providers, auth server helpers       |
| Domain components           | UI primitives and domain/view types                     | Route files or unrelated page implementations                |
| Feature pages               | Domain components, UI, typed service interfaces         | Arbitrary backend URLs or database clients                   |
| Business adapters           | Verified wire DTOs, explicit mappers and API boundary   | JSX or page state                                            |
| Client modules              | Browser-safe helpers and serializable data              | `server-only` modules, Node APIs, credentials or token pairs |
| Server Route Handlers       | Auth server helpers, HTTP helpers and verified services | Browser-only APIs                                            |

Use `@/` imports for code under `src`. Keep imports inside a small feature relative when that improves clarity. Do not create circular dependencies or import from `src/app` into shared code.

## 3. TypeScript and naming

| Element                          | Convention                            | Example                                        |
| -------------------------------- | ------------------------------------- | ---------------------------------------------- |
| Components/types/interfaces      | PascalCase                            | `RestaurantDetail`, `AuthUserDto`              |
| Functions, hooks and variables   | camelCase; hooks begin with `use`     | `readApiResponse`, `useRestaurant`             |
| Source files and feature folders | kebab-case, following existing layout | `login-form.tsx`, `data-service.ts`            |
| Next.js special files            | Framework names                       | `page.tsx`, `layout.tsx`, `route.ts`           |
| Roles on the wire                | Exact backend constants               | `TRAVELER`, `RESTAURANT_OWNER`, `MOD`, `ADMIN` |
| Other API enums/fields           | Exact documented values               | `pending_verification`, `avatarUrl`            |

- Keep strict TypeScript. Prefer `unknown` plus narrowing for external data; do not bypass validation with `any`, unexplained non-null assertions or casts that invent a contract.
- Use typed props and named domain types. Wire DTOs live beside the owning feature (`*-types.ts`); preserve backend nullability and ID types there and map to view shapes explicitly.
- Reuse `ApiResponse`, `AuthUserDto` and `RoleCode`. Use type-only imports where applicable.
- Documentation and code identifiers are English. User-facing messages, field labels and accessible names remain Vietnamese.

## 4. Server and client boundaries

- Check the installed docs in `node_modules/next/dist/docs/` before changing framework behavior. This is App Router, not Pages Router.
- Pages/layouts default to Server Components. Add `"use client"` only where hooks, event handlers or browser APIs are needed; do not turn the entire app into a client component.
- Keep server modules marked `import "server-only"`. Do not re-export them through a browser barrel.
- Await `params`, `searchParams` and `cookies()` where required by the installed Next.js APIs.
- Pass browser-safe serializable props across the boundary. Never serialize `AuthResultDto` or a server session into rendered HTML, client props or browser JSON.
- Cookie writes, session destruction and token rotation belong in Route Handlers. `requireUser` may read/redirect during rendering; it must not rotate and save a cookie during that render.

## 5. Routing and authorization

- Reuse `requireUser`, `HOME_BY_ROLE` and `RoleCode`; do not maintain a second role policy in a page.
- Protect root and nested role routes. A protected layout authenticates the user; it does not replace each role-specific guard.
- ADMIN can access moderation under the existing policy. Do not treat ADMIN as implicitly allowed in every other role workspace.
- UI permissions control presentation, not real authorization. BE verifies access, ownership and moderation state for every operation.
- A query parameter or client state must never override the real session.
- Keep navigation consistent with `AppShell`, `SiteNav` and `ownerRoutes` for integrated screens, and with `WorkspaceShell` for earlier workspace screens (wrapped in `LegacyScope` so their styles stay scoped). Add a route to the integrated navigation only when its backend adapter exists. Unknown routes answer 404.
- Tests for denied navigation must accept Next.js streamed redirects and verify that protected content is not rendered, rather than relying only on one HTTP status.

## 6. API client and error handling

- Browser API calls use `src/shared/api/client.ts`. Server backend requests use the server helper. Do not scatter raw authenticated `fetch` calls across components.
- Read URLs from env. Keep browser requests same-origin and backend URLs server-side; never hardcode deployment hosts.
- Consume `ApiResponse.data`, including successful `null`. Do not return the whole envelope to feature callers or invent an empty object when the API returns null.
- Handle expected failures with `ApiError` and branch on `errorCode`. Never compare localized `message` text to decide behavior.
- Preserve field `errors`, error `data` (such as `suspendedUntil`) and `Retry-After`; do not flatten them into a generic string too early.
- Keep backend codes distinct from existing FE transport/parser codes (`INVALID_RESPONSE`, `BAD_REQUEST`, `HTTP_<status>`). Do not introduce new backend error codes from FE.
- Show safe user feedback and allow retry where appropriate. Do not expose stack traces, tokens or request bodies containing secrets.
- Terminal session failures use the centralized client redirect/handler cleanup. Login credential errors must remain in the form, not cause a redirect loop.

## 7. Adding a live endpoint

1. Find the latest backend API contract and confirm the operation exists in the backend implementation. If those sources are unavailable, leave the integration pending rather than deriving a DTO from a Figma screen or fixture.
2. Add typed wire request/response models in the owning feature, separate from view shapes. Map between them explicitly.
3. Add the exact method/path to the Next.js proxy allowlist and export the corresponding Route Handler method. Never accept a caller-controlled upstream host.
4. Keep the browser on the same-origin API client. Preserve Origin checks for mutations and `withAuth` for protected calls; use public calls only where the contract says they are public.
5. Preserve designed status, pagination, query behavior, units, nulls and structured errors. Pass the designed success status to `ok(data, status)`; its default is 200.
6. Add a typed service/adapter and render its loading, empty, error and success states. A failed live call shows retry feedback; it never falls back to sample data.
7. Test response/error handling and relevant role/data behavior. Update the documented integration status.
8. Complete the final API Design reconciliation required by [Checks and evidence](#13-checks-and-evidence).

An allowlisted path is not an implemented endpoint. The generic `api.post` helper requires an exported server method and the exact allowlist entry. Use `api.upload` for multipart requests and let fetch generate the boundary. Do not invent a whole-state `AppData` save API.

## 8. Authentication and refresh

- Use the existing HttpOnly encrypted session. Never store tokens in browser storage, URLs, fixtures, analytics or console output.
- Keep token rotation centralized in `withAuth`/`refreshSession` and the coordinator. Preserve single-flight refresh and the latest-pair registry for concurrent/late requests.
- Retry a protected request at most once after `UNAUTHORIZED`; do not refresh on `FORBIDDEN`, credential failures or general business errors. Proactive expiry checks must not create an additional retry loop.
- Save the complete rotated pair with backend expiration timestamps. Logout must use the current refresh token, clear the cookie and record local revocation.
- Preserve Origin validation, no-store behavior and cookie flags. Do not weaken them to make a test pass.
- Preserve full navigation after login/logout until a replacement is verified to clear cached protected content. Document a narrowly scoped lint exception when needed.
- Do not claim process-local session maps support multiple instances, durable revocation after restart or serverless concurrency. Those require a shared atomic store.

## 9. State, effects and mutations

- Use local state for transient controls, workspace context for shared state, and URL state for navigation/filter state that should be shareable. Avoid competing sources of truth.
- Clone data before updates; do not mutate context state or props.
- Serialize saves (a submitting ref plus a busy flag) so overlapping updates do not overwrite each other. Publish saved state and success feedback only after the operation succeeds.
- Keep pending/busy feedback visible and disable duplicate submissions. Preserve unsaved form input on errors and support cancellation before destructive actions.
- Effects must clean up listeners, timers and stale async updates. Do not use effects to mirror values that can be derived during render.
- Never imply an action succeeded before the backend confirmed it. Illustrative homepage examples must say they are not saved.

## 10. Forms, dates and presentation

- Use native semantic forms and reusable `Field`, `Input`, `TextArea`, `SelectField`, `Choice` and related primitives.
- Every action requiring user confirmation must use an in-app popup modal built from the shared `Dialog` or `ConfirmDialog`. Never use browser `alert`, `confirm` or `prompt` for these decisions. Inline alerts/toasts may provide feedback that does not require a user decision.
- Every control needs an accessible label. Connect helper/errors through `aria-describedby` and invalid state through `aria-invalid`.
- Validate for useful UX, then keep BE authoritative. Do not silently change its limits or enum values to match a fixture.
- Use the current route and role policy when showing auth and staff controls. Public registration offers Traveler/Owner.
- Keep the restaurant's verification, operating and moderation statuses, and pending menu edits, as distinct states in the UI.
- Keep monetary values numeric and format VND for display. Preserve UTC API timestamps and distinguish date-only values from instants when formatting.

## 11. UI kit, assets and responsive behavior

- Reuse existing components and variants before adding a new abstraction. Shared UI receives typed props; it must not know backend URLs or role-specific page logic.
- Use theme tokens (`src/styles/theme/tokens.css`) and shared CSS for color, spacing, type, radii, elevation, page width and gutter. The palette and the homepage fonts (Fraunces 900 headings, Be Vietnam Pro body) are fixed; avoid copied magic values where a token fits.
- Add visual variants centrally; do not copy a whole button/dialog/table into a feature to change styling.
- Keep local design asset provenance and font licenses. Do not use screenshots as page content or invent remote asset paths.
- Preserve aspect ratios and image fallbacks. Decorative images use empty alt text; meaningful images describe their content.
- Keep forms, tables, dialogs and navigation usable at desktop and mobile widths. Contain intentional table overflow without hiding page content or creating page-wide horizontal scrolling.
- Keyboard operation, visible focus, modal focus/return behavior, Escape, textual statuses and reduced motion are part of the component contract.
- Represent loading, empty, unavailable, denied, error and success states. A failed live adapter must never show sample data in its place.

## 12. Configuration and external boundaries

- `.env.example` lists variable names and safe defaults. `.env.local` and real credentials stay local; preserve existing values during setup.
- `NEXT_PUBLIC_*` values are public/build-time values. Store session secrets and backend-only URLs without that prefix.
- Keep database and external-service secrets out of browser code and public assets. FE reaches backend operations through verified contracts, not direct database access.
- Avoid introducing libraries already covered by native HTML, React or existing helpers. When a dependency is justified, review its footprint and update the npm lockfile with npm rather than editing it manually.
- Mapbox usage policy from the owner (2026-10-16): do not probe tokens, open live maps or run provider/browser tests that consume Mapbox usage without an explicit request. Automated suites must intercept every Mapbox request (`tests/browser/mapbox-fixture.ts`) and use a placeholder token. Documentation reads and offline API-contract reconciliation do not authorize provider calls.

## 13. Checks and evidence

| Change                                            | Relevant checks                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------- |
| Documentation only                                | Formatting, internal links, file paths, command/env names and diff review |
| Type/data/calculation/API/auth logic              | Focused Vitest tests, lint/typecheck and build where relevant             |
| Routes, forms, dialogs, permissions or navigation | Relevant browser tests, keyboard/access checks and relevant build/tests   |
| Layout, shared styles or assets                   | Representative desktop/mobile visual checks and asset verification        |

CI currently runs lint, unit tests, build and typecheck. Build generates route types on a fresh checkout. Browser, visual and formatting checks run separately; do not describe them as mandatory CI jobs until the workflow actually includes them.

After code and checks for every task, reopen the latest API Design workbook from disk and reconcile the finished task against its relevant endpoint, DTO, JSON sample, validation and error entries again. Check for a newer workbook or changes to the same version during the task; fix the task's affected code and rerun relevant checks before reporting completion. Record the file/version and inspected sheets/ranges in verification evidence. If the task has no API mapping, record that finding without inventing a contract. An earlier extraction alone is not a final contract check.

Write meaningful tests for behavior and failure modes, not for implementation trivia. Use deterministic fixtures and explicit clocks where time matters. Use isolated local credentials for auth smoke tests; do not send those tests to a shared/production environment.

Report checks that ran, checks that could not run and their reasons. Do not edit historical verification counts to imply a new test run. Keep generated screenshots/reports/cache files in ignored directories.

## 14. Documentation and change delivery

- README is the portable team entry point; `.agents/project_architecture.md` owns architectural policy and this file owns coding policy. `docs/` records setup detail, design coverage and verification evidence.
- Update relevant docs when adding a route, env variable, adapter, dependency or supported integration. Describe current behavior and remaining limitations.
- Preserve unrelated work, avoid broad formatting/refactors and review the final diff.
- Automated assistants leave changes unstaged and uncommitted. They never create/modify commits, rewrite history, push, or create/merge PRs. The human workflow is documented separately and is not authorization for an assistant to perform it.
