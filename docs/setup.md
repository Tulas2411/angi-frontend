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

| Variable                               | Default/example                    | Purpose                                                                                     |
| -------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------- |
| `API_BASE_URL`                         | `http://localhost:5154/api/v1`     | Server-only existing backend URL                                                            |
| `NEXT_PUBLIC_API_BASE_URL`             | `/api`                             | Same-origin browser API handlers                                                            |
| `APP_URL`                              | `http://localhost:3000`            | Origin validation and app URL                                                               |
| `SESSION_PASSWORD`                     | Private random key, ≥32 characters | Existing encrypted cookie                                                                   |
| `NEXT_PUBLIC_DATA_MODE`                | `live`                             | Business adapter: live unavailable until implemented; `demo` for fixture-backed shells      |
| `NEXT_PUBLIC_ENABLE_DEMO`              | `true`                             | Set `false` to disable the entire `/demo` route family                                      |
| `NEXT_PUBLIC_ENABLE_COMPONENT_GALLERY` | `false`                            | Gallery/scenarios automatically enabled in development; production requires explicit `true` |

Public environment variables are selected at build time. Restart development or rebuild after changing them. Production can disable previews and should keep the gallery flag false. Real `/login` uses the existing backend; role roots continue to require a real session even if business data mode is demo. Demo role selection does not authenticate a user.

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

```powershell
npm run test:visual
npm run test:states
node scripts/verify-assets.mjs
npm run format:check
```

Screenshots, manifests and browser reports go into ignored `artifacts/`, `playwright-report/` and `test-results/`. `PLAYWRIGHT_BASE_URL` can override the screenshot scripts' origin. `test:smoke` requires the running local backend and existing seeded accounts; see the main README.
