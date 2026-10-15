# Setup and previews

For a complete Vietnamese walkthrough of backend/frontend setup, local accounts, manual Owner checks and automated live tests, see [the local run and test guide](local-run-and-test-guide.vi.md).

For the focused ANGI-36/48/55 checks and read-only `dev` source snapshot option, see [owner task live verification (Vietnamese)](owner-tasks-live-verification.vi.md#cách-chạy-lại-bộ-kiểm-thử-riêng-ba-task).

For the real local .NET/PostgreSQL stack and `npm run test:live`, follow the sibling backend's `docker/local/README.md`. From this frontend run `./scripts/prepare-live-tests.ps1`, `npm run test:live`, then `./scripts/cleanup-live-tests.ps1`. These opt-in checks use port 3001, a fresh seeded owner and ignored `.env.integration`; they preserve existing FE env files and use the actual BE instead of the owner API stubs. They require Docker Desktop and the configured backend at localhost:5154.

Use Node.js 24 and npm. Run commands inside `angi-frontend`.

```powershell
npm ci
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
```

Set `SESSION_PASSWORD` to a random string of at least 32 characters. Preserve existing local configuration if `.env.local` already exists. Generate a key with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.

```powershell
npm run dev
```

Open <http://localhost:3000/demo> for Guest, Traveler, Owner, Moderator and Admin previews. <http://localhost:3000/dev/components> is the component gallery; <http://localhost:3000/dev/scenarios> holds reproducible business states. No backend is required for these previews. Mock data persists during client navigation within a workspace and resets on refresh/workspace remount.

| Variable                               | Default/example                    | Purpose                                                                                      |
| -------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------- |
| `API_BASE_URL`                         | `http://127.0.0.1:5154/api/v1`     | Server-only existing backend URL                                                             |
| `NEXT_PUBLIC_API_BASE_URL`             | `/api`                             | Same-origin browser API handlers                                                             |
| `APP_URL`                              | `http://localhost:3000`            | Origin validation and app URL                                                                |
| `SESSION_PASSWORD`                     | Private random key, ≥32 characters | Existing encrypted cookie                                                                    |
| `NEXT_PUBLIC_DATA_MODE`                | `live`                             | Owner registration/profile/hours use live APIs; other adapters pending; `demo` uses fixtures |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`      | Empty                              | Optional public `pk.*` token for the restaurant map and permanent address search             |
| `NEXT_PUBLIC_ENABLE_DEMO`              | `true`                             | Set `false` to disable the entire `/demo` route family                                       |
| `NEXT_PUBLIC_ENABLE_COMPONENT_GALLERY` | `false`                            | Gallery/scenarios automatically enabled in development; production requires explicit `true`  |

Public environment variables are selected at build time. Restart development or rebuild after changing them. Production can disable previews and should keep the gallery flag false. Real `/login` uses the existing backend; role roots continue to require a real session even if business data mode is demo. Demo role selection does not authenticate a user.

Use IPv4 `127.0.0.1` in `API_BASE_URL` for the local Docker stack. Node.js may resolve `localhost` to `::1`, but the backend port is bound to IPv4 only; this produces `503 SERVICE_UNAVAILABLE` on login. Keep `APP_URL` matched to the frontend browser origin, normally `http://localhost:3000`.

To use the existing backend's public Mapbox token, run `./scripts/sync-mapbox-env.ps1` from FE root, then restart FE. This preserves other settings and updates `.env.local` when it exists, otherwise `.env`. It refuses secret tokens. All Mapbox views require the public token; missing/failed map configuration displays feedback and coordinate entry instead of map artwork. Run `npx playwright test --config=playwright.map.config.ts` for isolated picker/itinerary-map checks with intercepted provider responses.

F-43 opens at `/restaurant/register` after Owner login; owner root also loads registration when no restaurant exists. It requires backend OWN-01/OWN-02 and MEDIA-01, verified in API Design v1.8. Manual coordinates and browser geolocation work without Mapbox. A public Mapbox token enables the map and address search; the account must support permanent geocoding (`permanent=true`) for coordinates saved to a restaurant. Restrict the public token to your application origins. Province suggestions use the pre-merger V1 catalog to match the current required-district API model; owners can enter full names manually. The fixture-only new-owner scenario is `/dev/scenarios?state=owner-register-restaurant`.

The location dialog fills its entire surface with an interactive Mapbox GL JS map, loaded when the picker opens. Scroll the wheel inside the modal to zoom without holding Ctrl; hold the left mouse button on the map and drag to pan. Moving the camera keeps the selected geographic point and saved coordinates unchanged. Click the map to select a new point; keyboard users can focus the map canvas, pan with arrow keys and press Enter/Space to select its center. Search sits at the upper left; locate and zoom controls sit at the lower right beside Save. Both the marker popup and bottom location card have independent close buttons that preserve the selected coordinates. Click the marker or select a new point to show information again. Manual coordinates are available through **Nhập tọa độ** and open automatically when Mapbox is missing, WebGL is unavailable or the map style fails. All location pickers use this component, including demo workspaces, itinerary creation and the component gallery. The itinerary panel continues to use Mapbox Static Images with restaurant-coordinate markers; demo business data remains isolated fixtures.

F-44 opens at `/restaurant/profile`; preview it at `/demo/owner/profile`. A missing live restaurant offers registration, while a failed GET offers retry without fixtures. The profile uses OWN-02/OWN-03 and uploads replacement images through MEDIA-01. Saving excludes unchanged fields and never changes hours or restaurant statuses. Optional text/price/cover can be cleared; the gallery supports replacing the complete list or clearing it after confirmation. Cancel uses a modal and restores the latest saved values.

Province suggestions use the same public [Provinces Open API V1 catalog](https://provinces.open-api.vn/) across restaurant address forms, trip destinations, header/restaurant location search, map search and the gallery, including demo workspaces. This is the pre-July-2025 catalog, retained because the current restaurant API requires a district. Type a province with or without Vietnamese accents, then click a suggestion or use the arrow keys and Enter. The selected value is the official name; loading suggestions does not rewrite an existing profile. The street address, district and ward remain separate fields. On catalog failure, full-name entry remains possible and **Tải lại danh sách tỉnh/thành** retries without losing the typed value. Results are shared across mounted fields, cached for five minutes in the browser and revalidated daily upstream. No key or new env setting is required. Run `npx playwright test --config=playwright.province.config.ts` for isolated catalog/UI checks with intercepted catalog responses. Restart a long-running FE dev process if Fast Refresh serves old server HTML after these component changes.

F-45 uses the hours tab at `/restaurant/profile?tab=hours` or `/demo/owner/profile?tab=hours`. Load through OWN-02 and save through OWN-04 PUT. The request is the complete `{ hours: [...] }` schedule; `[]` clears it. Multiple intervals per day and overnight opening are supported with validation across days and the circular week. Use Vietnam time (`HH:mm`, UTC+7), with Sunday encoded as 0. The response supplies saved `hours` and `isOpenNow`; this schedule flag does not change the separately managed operating status. Confirmation modals protect removal, clearing, cancellation and dirty tab exits. Live errors never substitute fixtures. Deploy with OWN-02 and OWN-04 available in BE.

```powershell
npm run build
npm run typecheck
npm run lint
npm test
```

Build first on a fresh checkout so Next can generate route types. Browser validation:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH='.cache/browsers'
npx playwright install chromium
npm run test:browser
```

Playwright starts a dev server or reuses port 3000. Screenshot scripts expect that server to be running:

Run F-43 with `npx playwright test --config=playwright.owner.config.ts`, F-44 with `npx playwright test --config=playwright.profile.config.ts` and F-45 with `npx playwright test --config=playwright.hours.config.ts`. All three snapshot source/assets into ignored `.cache` workspaces before starting frontend port 3001 and an API stub at 5164 with test-only auth. They copy no private env file and do not reuse an existing frontend, so your regular preview can stay running. Run these suites sequentially because they use the same test ports. `node scripts/owner-test-server.mjs --build` similarly builds an isolated snapshot. Keep `PLAYWRIGHT_BROWSERS_PATH` consistent with your Chromium installation.

```powershell
npm run test:visual
npm run test:states
node scripts/verify-assets.mjs
npm run format:check
```

Screenshots, manifests and browser reports go into ignored `artifacts/`, `playwright-report/` and `test-results/`. `PLAYWRIGHT_BASE_URL` can override the screenshot scripts' origin. `test:smoke` requires the running local backend and existing seeded accounts; see the main README.
