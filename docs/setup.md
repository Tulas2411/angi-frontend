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

| Variable                               | Default/example                    | Purpose                                                                                         |
| -------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------- |
| `API_BASE_URL`                         | `http://localhost:5154/api/v1`     | Server-only existing backend URL                                                                |
| `NEXT_PUBLIC_API_BASE_URL`             | `/api`                             | Same-origin browser API handlers                                                                |
| `APP_URL`                              | `http://localhost:3000`            | Origin validation and app URL                                                                   |
| `SESSION_PASSWORD`                     | Private random key, ≥32 characters | Existing encrypted cookie                                                                       |
| `NEXT_PUBLIC_DATA_MODE`                | `live`                             | Owner registration uses live APIs; other business adapters remain pending; `demo` uses fixtures |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`      | Empty                              | Optional public `pk.*` token for the restaurant map and permanent address search                |
| `NEXT_PUBLIC_ENABLE_DEMO`              | `true`                             | Set `false` to disable the entire `/demo` route family                                          |
| `NEXT_PUBLIC_ENABLE_COMPONENT_GALLERY` | `false`                            | Gallery/scenarios automatically enabled in development; production requires explicit `true`     |

Public environment variables are selected at build time. Restart development or rebuild after changing them. Production can disable previews and should keep the gallery flag false. Real `/login` uses the existing backend; role roots continue to require a real session even if business data mode is demo. Demo role selection does not authenticate a user.

F-43 opens at `/restaurant/register` after Owner login; owner root/profile also loads registration when no restaurant exists. It requires backend OWN-01/OWN-02 and MEDIA-01, verified in API Design v1.8. Manual coordinates and browser geolocation work without Mapbox. A public Mapbox token enables the map and address search; the account must support permanent geocoding (`permanent=true`) for coordinates saved to a restaurant. Restrict the public token to your application origins. Province suggestions use the pre-merger V1 catalog to match the current required-district API model; owners can enter full names manually. The fixture-only new-owner scenario is `/dev/scenarios?state=owner-register-restaurant`.

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

Run the isolated F-43 suite with `npx playwright test --config=playwright.owner.config.ts`. It starts frontend port 3001 and an API stub at 5164 with test-only auth, uses no real account or backend, and does not reuse an existing frontend. Stop other Next.js dev/build processes for this checkout first because they share `.next`. Keep `PLAYWRIGHT_BROWSERS_PATH` consistent with your Chromium installation.

```powershell
npm run test:visual
npm run test:states
node scripts/verify-assets.mjs
npm run format:check
```

Screenshots, manifests and browser reports go into ignored `artifacts/`, `playwright-report/` and `test-results/`. `PLAYWRIGHT_BASE_URL` can override the screenshot scripts' origin. `test:smoke` requires the running local backend and existing seeded accounts; see the main README.
