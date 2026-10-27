# Setup

The short version lives in the [README](../README.md#local-setup). This page adds the details that do not fit there. For a complete Vietnamese walkthrough of the backend, local accounts and manual owner checks, see the [local run and test guide](local-run-and-test-guide.vi.md).

Use Node.js 22 or newer (24 recommended) and npm. Run commands inside `angi-frontend`.

```powershell
npm ci
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
```

Set `SESSION_PASSWORD` to a random string of at least 32 characters (preserve an existing `.env.local`):

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

```powershell
npm run dev
```

Open <http://localhost:3000/>. The public homepage uses local editorial content and needs no backend. Sign in, register and every other screen need the backend running at `API_BASE_URL`. There is no demo or preview mode: routes such as `/demo`, `/dev/components`, `/dishes` or `/restaurants` do not exist.

## Environment variables

| Variable                          | Default/example                | Purpose                                                                            |
| --------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------- |
| `API_BASE_URL`                    | `http://127.0.0.1:5154/api/v1` | Server-only backend URL                                                            |
| `NEXT_PUBLIC_API_BASE_URL`        | `/api`                         | Same-origin browser API handlers                                                   |
| `APP_URL`                         | `http://localhost:3000`        | Origin validation for mutations; must match the browser origin                     |
| `SESSION_PASSWORD`                | Private random key, ≥ 32 chars | Encrypts the session cookie                                                        |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | Empty                          | Optional public `pk.*` token for the owner map picker and permanent address lookup |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID`    | Empty                          | Optional; must match `Google:ClientId` in the backend. Empty → no Google button    |

Public variables are selected at build time; restart development or rebuild after changing them. Use IPv4 `127.0.0.1` in `API_BASE_URL` for the local Docker stack: Node.js may resolve `localhost` to `::1`, but the backend port is bound to IPv4 only, which produces `503 SERVICE_UNAVAILABLE` on login.

## Maps

Manual coordinates and browser geolocation always work. A public Mapbox token enables the map, POI search and address prefill; the account must support permanent geocoding (`permanent=true`) because the coordinates are stored on the restaurant. Restrict the token to your application origins. `./scripts/sync-mapbox-env.ps1` copies the backend's public token into `.env.local` (or `.env`) and refuses secret tokens. Automated suites never use a real token: they set a placeholder and intercept all Mapbox requests. See [manual Mapbox checks](mapbox-features.vi.md) and [address prefill](map-address-prefill.vi.md).

Province, district and ward suggestions come from the public [Provinces Open API V1](https://provinces.open-api.vn/) (63 provinces/cities, the catalogue before the July 2025 merger, with districts) through `/api/locations/provinces[/{code}/districts]` and `/api/locations/districts/{code}/wards`; no key is needed. Owner forms use province → district → ward (the district is required by OWN-01), and typed values stay editable when the catalogue is unavailable. See [the address note](address-entry-v2.vi.md).

## Checks

```powershell
npm run lint
npm run typecheck      # run npm run build first on a fresh checkout
npm test
npm run build
npm run format:check
node scripts/verify-assets.mjs
```

Browser suites (Chromium via Playwright):

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH='.cache/browsers'
npx playwright install chromium
npm run test:browser   # homepage, auth, routing, account
npm run test:owner     # owner workspace against a local API stub
npm run test:map       # registration, profile, map picker, province/ward
```

Each suite snapshots the source and public assets into an ignored `.cache/owner-test-*` workspace, builds and serves it on port 3001 and starts an API stub on port 5164, with test-only auth. No private env file is copied and a running preview on port 3000 is untouched. Run the suites one at a time because they share ports. Set `ANGI_TEST_DEV=1` to serve the snapshot with `next dev` instead of building it, and `node scripts/owner-test-server.mjs --build` to only compile a snapshot. Keep `PLAYWRIGHT_BROWSERS_PATH` consistent with your Chromium installation.

`npm run test:smoke` needs the running local backend, seeded local accounts, `ANGI_TEST_PASSWORD` and `SESSION_PASSWORD`. `npm run test:live` runs the opt-in suites in `tests/live` against the real local backend with your own accounts and `.env.integration`; see [live backend verification](live-backend-verification.md).

Screenshots, manifests and browser reports go into the ignored `artifacts/`, `playwright-report/` and `test-results/` directories.

## Feature notes

Detailed behavior, exact contracts and manual checks for each owner feature are in the Vietnamese notes: [business hours](business-hours.vi.md), [verification](restaurant-verification.vi.md), [status and history](verification-status.vi.md), [resubmission](verification-resubmission.vi.md), [menu](restaurant-menu.vi.md) and [menu approval](menu-approval.vi.md). The contract summary and routes are in the [scope inventory](scope-inventory.md).
