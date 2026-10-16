# Setup and previews

For a complete Vietnamese walkthrough of backend/frontend setup, local accounts, manual Owner checks and automated live tests, see [the local run and test guide](local-run-and-test-guide.vi.md).

For the focused ANGI-36/48/55 checks and read-only `dev` source snapshot option, see [owner task live verification (Vietnamese)](owner-tasks-live-verification.vi.md#cách-chạy-lại-bộ-kiểm-thử-riêng-ba-task).

For the real local .NET/PostgreSQL stack and `npm run test:live`, follow the sibling backend's `docker/local/README.md`. From this frontend run `./scripts/prepare-live-tests.ps1`, `npm run test:live`, then `./scripts/cleanup-live-tests.ps1`. These opt-in checks use port 3001, a fresh seeded owner and ignored `.env.integration`; they preserve existing FE env files and use the actual BE instead of the owner API stubs. They require Docker Desktop and the configured backend at localhost:5154.

F-47/F-48 have a separate opt-in `playwright.verification-live.config.ts` that runs against local Kestrel/PostgreSQL and real private Cloudinary storage, with Mapbox disabled. Follow the [fresh-owner preparation/run/cleanup instructions](verification-status.vi.md#bộ-kiểm-tra-be-thật-f-47f-48) and [live results/remaining boundaries](verification-live.vi.md). Do not run the general live suite as a substitute when only verification coverage is needed.

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

To use the existing backend's public Mapbox token, run `./scripts/sync-mapbox-env.ps1` from FE root, then restart FE. This preserves other settings and updates `.env.local` when it exists, otherwise `.env`. It refuses secret tokens. All Mapbox views require the public token; missing/failed map configuration displays feedback and coordinate entry instead of map artwork. The owner confirmed the replacement token works; this delivery does not read, sync or probe it. The owner requested code only and will test the new features; do not run map/browser/provider checks on their behalf. See [manual Mapbox verification](mapbox-features.vi.md).

F-43 opens at `/restaurant/register` after Owner login; owner root also loads registration when no restaurant exists. It requires backend OWN-01/OWN-02 and MEDIA-01, verified in API Design v1.8. Manual coordinates and browser geolocation work without Mapbox. A public Mapbox token enables the map and address search; the account must support permanent geocoding (`permanent=true`) for coordinates saved to a restaurant. Restrict the public token to your application origins. Province and ward suggestions use the post-merger V2 catalog; owners can enter full names manually. The fixture-only new-owner scenario is `/dev/scenarios?state=owner-register-restaurant`.

The location dialog fills its surface with Mapbox GL JS when explicitly opened. Wheel zoom and drag panning change the camera while preserving selected coordinates. Map points, POIs and ANGI restaurant markers can be selected; keyboard users can pan and press Enter/Space to select the center. Search sits at the upper left; manual coordinates, street/satellite layers, locate, zoom and Save remain available. Both information cards have independent close buttons that preserve the point. **Vùng bản đồ** filters loaded Streets POIs and supplied ANGI records without a search request; zoom level and loaded tiles limit this catalog. **POI mở rộng** submits Search Box forward/category queries; **Địa chỉ** submits permanent V6 geocoding. The location card opens Directions with explicit endpoint search/current position/manual coordinates, car/bicycle/walk profiles, alternatives and Vietnamese steps. No search or routing occurs on typing or camera changes. The itinerary panel now opens the same explorer on demand instead of downloading Static Images. Discovery, restaurant/dish detail and matching Roll Dish results also expose this explorer. Business data still follows the existing live/demo adapter status; a map does not implement the pending recommendation or discovery adapters.

F-44 opens at `/restaurant/profile`; preview it at `/demo/owner/profile`. A missing live restaurant offers registration, while a failed GET offers retry without fixtures. The profile uses OWN-02/OWN-03 and uploads replacement images through MEDIA-01. Saving excludes unchanged fields and never changes hours or restaurant statuses. Optional text/price/cover can be cleared; the gallery supports replacing the complete list or clearing it after confirmation. Cancel uses a modal and restores the latest saved values.

Province suggestions use the public [Provinces Open API V2 catalog](https://provinces.open-api.vn/) across restaurant address forms, trip destinations, header/restaurant location search and the gallery, including demo workspaces. V2 contains the 34 provinces/cities after the July 2025 merger. Restaurant forms use province → ward, with no district input. Ward suggestions come from `/api/locations/provinces/{code}/wards`, which fetches only the selected province's V2 wards. Changing province clears the previous ward; loading/retrying catalogs preserves existing values and permits manual full-name entry on failure. Codes are used only to load suggestions; business requests still store names. Browser caches last five minutes and provider responses are revalidated daily. No key or new env setting is required. Run `npx playwright test --config=playwright.province.config.ts` for isolated catalog/UI checks. Restart FE and deploy the matching backend change that makes legacy `district` optional. See [the V2 address note](address-entry-v2.vi.md) for the API Design v1.8 discrepancy.

F-45 uses the hours tab at `/restaurant/profile?tab=hours` or `/demo/owner/profile?tab=hours`. Load through OWN-02 and save through OWN-04 PUT. The request is the complete `{ hours: [...] }` schedule; `[]` clears it. Multiple intervals per day and overnight opening are supported with validation across days and the circular week. Use Vietnam time (`HH:mm`, UTC+7), with Sunday encoded as 0. The response supplies saved `hours` and `isOpenNow`; this schedule flag does not change the separately managed operating status. Confirmation modals protect removal, clearing, cancellation and dirty tab exits. Live errors never substitute fixtures. Deploy with OWN-02 and OWN-04 available in BE.

F-46 uses the status tab at `/restaurant/profile?tab=status` or `/demo/owner/profile?tab=status`. Load current states through OWN-02; save the selected operating state through OWN-05 PUT only after modal confirmation. All three documented states are supported, with an optional reason up to 500 characters. A reason alone does not update an unchanged status. The response supplies only `operatingStatus`; hours and verification/moderation remain unchanged. `RESTAURANT_SUSPENDED` prevents reopening without discarding the draft or logging the owner out. Suspended restaurants can still close. Demo status changes remain in provider memory during navigation and reset on reload/remount. Deploy with OWN-02 and OWN-05 available in BE.

F-47 opens at `/restaurant/verification`. For an unverified demo owner, use `/dev/scenarios?state=owner-verification-new`; the default demo owner is already verified. OWN-02 supplies eligibility and the latest verification. Upload each document through MEDIA-01 with `purpose=verification_doc`, then send legal information and numeric media IDs through OWN-06 POST after modal confirmation. A business license is required; JPG/PNG/WEBP are limited to 5 MB and PDF to 10 MB. Failed uploads can retry the remaining files, and failed submissions retain the draft. Pending/verified/rejected restaurants cannot submit a new initial verification. The latest response is shown with private signed document links opened only on demand. F-48 integrates full history through OWN-07. F-49 connects OWN-08 for the latest rejected/needs-more-info request, with retained/new documents and no required license document. See [resubmission usage and separate stub/live commands](verification-resubmission.vi.md) and [status/history manual checks](verification-status.vi.md). No new application env variables are required. See [F-47 contract and manual checks](restaurant-verification.vi.md).

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

Run F-43 with `npx playwright test --config=playwright.owner.config.ts`, F-44 with `npx playwright test --config=playwright.profile.config.ts`, F-45 with `npx playwright test --config=playwright.hours.config.ts` and F-46 with `npx playwright test --config=playwright.status.config.ts`. All four snapshot source/assets into ignored `.cache` workspaces before starting frontend port 3001 and an API stub at 5164 with test-only auth. They copy no private env file and do not reuse an existing frontend, so your regular preview can stay running. Run these suites sequentially because they use the same test ports. `node scripts/owner-test-server.mjs --build` similarly builds an isolated snapshot. Keep `PLAYWRIGHT_BROWSERS_PATH` consistent with your Chromium installation.

```powershell
npm run test:visual
npm run test:states
node scripts/verify-assets.mjs
npm run format:check
```

Screenshots, manifests and browser reports go into ignored `artifacts/`, `playwright-report/` and `test-results/`. `PLAYWRIGHT_BASE_URL` can override the screenshot scripts' origin. `test:smoke` requires the running local backend and existing seeded accounts; see the main README.
