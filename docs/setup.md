# Setup and previews

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

| Variable                               | Default/example                    | Purpose                                                                                             |
| -------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------- |
| `API_BASE_URL`                         | `http://localhost:5154/api/v1`     | Server-only existing backend URL                                                                    |
| `NEXT_PUBLIC_API_BASE_URL`             | `/api`                             | Same-origin browser API handlers                                                                    |
| `APP_URL`                              | `http://localhost:3000`            | Origin validation and app URL                                                                       |
| `SESSION_PASSWORD`                     | Private random key, ≥32 characters | Existing encrypted cookie                                                                           |
| `NEXT_PUBLIC_DATA_MODE`                | `live`                             | Owner registration/profile/hours/status use live APIs; other adapters pending; `demo` uses fixtures |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`      | Empty                              | Optional public `pk.*` token for the restaurant map and permanent address search                    |
| `NEXT_PUBLIC_ENABLE_DEMO`              | `true`                             | Set `false` to disable the entire `/demo` route family                                              |
| `NEXT_PUBLIC_ENABLE_COMPONENT_GALLERY` | `false`                            | Gallery/scenarios automatically enabled in development; production requires explicit `true`         |

Public environment variables are selected at build time. Restart development or rebuild after changing them. Production can disable previews and should keep the gallery flag false. Real `/login` uses the existing backend; role roots continue to require a real session even if business data mode is demo. Demo role selection does not authenticate a user.

F-43 opens at `/restaurant/register` after Owner login; owner root also loads registration when no restaurant exists. It requires backend OWN-01/OWN-02 and MEDIA-01, verified in API Design v1.8. Manual coordinates and browser geolocation work without Mapbox. A public Mapbox token enables the map and address search; the account must support permanent geocoding (`permanent=true`) for coordinates saved to a restaurant. Restrict the public token to your application origins. Province suggestions use the pre-merger V1 catalog to match the current required-district API model; owners can enter full names manually. The fixture-only new-owner scenario is `/dev/scenarios?state=owner-register-restaurant`.

F-44 opens at `/restaurant/profile`; preview it at `/demo/owner/profile`. A missing live restaurant offers registration, while a failed GET offers retry without fixtures. The profile uses OWN-02/OWN-03 and uploads replacement images through MEDIA-01. Saving excludes unchanged fields and never changes hours or restaurant statuses. Optional text/price/cover can be cleared; the gallery supports replacing the complete list or clearing it after confirmation. Cancel uses a modal and restores the latest saved values.

F-45 uses the hours tab at `/restaurant/profile?tab=hours` or `/demo/owner/profile?tab=hours`. Load through OWN-02 and save through OWN-04 PUT. The request is the complete `{ hours: [...] }` schedule; `[]` clears it. Multiple intervals per day and overnight opening are supported with validation across days and the circular week. Use Vietnam time (`HH:mm`, UTC+7), with Sunday encoded as 0. The response supplies saved `hours` and `isOpenNow`; this schedule flag does not change the separately managed operating status. Confirmation modals protect removal, clearing, cancellation and dirty tab exits. Live errors never substitute fixtures. Deploy with OWN-02 and OWN-04 available in BE.

F-46 uses the status tab at `/restaurant/profile?tab=status` or `/demo/owner/profile?tab=status`. Load current states through OWN-02; save the selected operating state through OWN-05 PUT only after modal confirmation. All three documented states are supported, with an optional reason up to 500 characters. A reason alone does not update an unchanged status. The response supplies only `operatingStatus`; hours and verification/moderation remain unchanged. `RESTAURANT_SUSPENDED` prevents reopening without discarding the draft or logging the owner out. Suspended restaurants can still close. Demo status changes remain in provider memory during navigation and reset on reload/remount. Deploy with OWN-02 and OWN-05 available in BE.

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
