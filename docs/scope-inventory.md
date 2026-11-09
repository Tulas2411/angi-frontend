# Screen and endpoint inventory

Which backend operations each area uses, through which code, and which tests cover it. Routes and access: [routes and status](routes.md). Operation IDs are those of `angi-backend/docs/ANGI_API_Design_Ver1.8.xlsx` (sheet "Backend API"). Checked against `src/` on 2026-11-09.

Rule: a screen stays only if its data and actions come from a backend operation that exists. Outside `/demo` no screen falls back to sample data.

## Areas

| Area                   | Operations                                                                           | Code                                              |
| ---------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------- |
| Authentication         | AUTH-01..09                                                                          | `/api/auth/[action]`, `features/auth`             |
| Account                | ME-01..03                                                                            | `features/account`                                |
| Notifications          | NOTI-01..03                                                                          | `features/notifications`                          |
| Homepage               | RM-01                                                                                | `features/discovery` (editorial content is local) |
| Dishes and restaurants | DISH-01/02, REST-01..04, REV-01, REP-01, CAT-02, MEDIA-01                            | `features/explore`                                |
| Food guides            | BLOG-01..11, REP-02, MEDIA-01                                                        | `features/blogs`                                  |
| Taste survey           | PREF-02, PREF-03                                                                     | `features/preferences`                            |
| Dish roll              | DISH-03                                                                              | `features/roll`                                   |
| Roadmaps               | RM-01..11, RM-13, RM-14, CAT-02                                                      | `features/roadmaps`                               |
| Food assistant         | AGENT-01..04, IMP-01                                                                 | `features/roadmaps/agent-*`                       |
| Owner workspace        | OWN-01..20, MEDIA-01, CAT-02                                                         | `features/owner`                                  |
| Moderation             | MOD-RP1..RP4, MOD-U1..U4, MOD-B1..B3, MOD-R1..R4, MOD-V1..V3, MOD-M1..M4, MOD-F1..F3 | `features/moderation`                             |
| Administration         | ADM-D1..D3, OPS-01, ADM-M1..M4, ADM-P1..P4                                           | `features/admin`                                  |
| Provinces and wards    | none (Provinces Open API V2, server fetch, cached)                                   | `/api/locations/provinces[/{code}/wards]`         |

Moderation, administration and owner reviews render in the earlier workspace shell (`LegacyAppShell` → `PlatformProvider` in `live` mode). Screens of that shell without a backend operation report the data as unavailable instead of showing fixtures: today only `/administration/audit`. `/demo/*` renders the same screens in `demo` mode on `src/mocks`, only when `NEXT_PUBLIC_ENABLE_DEMO=true`.

Not used by the frontend: HOME-01 (the homepage is editorial).

## Proxy allowlist (`/api/backend/...`)

The proxy (`src/app/api/backend/[...path]/route.ts`) forwards only exact `METHOD path` pairs; anything else is `404 ROUTE_NOT_FOUND`. Ids in paths must be positive integers, so a path can never reach another backend route. Mutations validate `Origin`.

| Matcher                             | Operations                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `allowedEndpoints` in the route     | `GET\|PATCH me`, `PUT me/password`, `GET me/notifications`, `GET me/notifications/unread-count`, `POST me/notifications/read`, `GET\|POST\|PATCH owner/restaurant`, `PUT owner/restaurant/business-hours`, `PUT owner/restaurant/operating-status`, `GET\|POST owner/restaurant/verifications`, `GET owner/restaurant/reviews`, `POST media`, `GET tags`, `GET\|POST roadmaps` |
| Inline in the route                 | `POST owner/restaurant/verifications/{id}/resubmit`                                                                                                                                                                                                                                                                                                                            |
| `shared/api/roadmap-proxy.ts`       | RM-03..11, RM-13, RM-14 (`roadmaps/{id}/...`)                                                                                                                                                                                                                                                                                                                                  |
| `shared/api/owner-menu-proxy.ts`    | OWN-09..18                                                                                                                                                                                                                                                                                                                                                                     |
| `shared/api/owner-reviews-proxy.ts` | OWN-19, OWN-20                                                                                                                                                                                                                                                                                                                                                                 |
| `shared/api/public-proxy.ts`        | Dishes, restaurants (guests allowed for reads), reviews and reports, blogs, `POST dishes/roll`, `POST impressions`                                                                                                                                                                                                                                                             |
| `shared/api/preference-proxy.ts`    | PREF-02, PREF-03                                                                                                                                                                                                                                                                                                                                                               |
| `shared/api/agent-proxy.ts`         | AGENT-01..04                                                                                                                                                                                                                                                                                                                                                                   |
| `shared/api/moderation-proxy.ts`    | MOD-* (MOD and ADMIN sessions only; verifications MOD only)                                                                                                                                                                                                                                                                                                                    |
| `shared/api/admin-proxy.ts`         | ADM-D*, OPS-01, ADM-M*, ADM-P*                                                                                                                                                                                                                                                                                                                                                 |

Add an operation only after confirming it exists in the backend, and keep its documented success status and body rules.

## Known gaps

- Account: no avatar upload.
- Google sign-in: rendered only when `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set.
- Homepage taste and roadmap examples: editorial, never saved, no backend call.
- `/administration/audit`: no backend operation.

## Tests

| Command                                                   | Specs                                                                                                                                                                                      |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm test` (Vitest)                                       | Rules, DTO builders, services, proxy allowlist, session and refresh logic, formatting, address and province logic                                                                          |
| `npm run test:browser`                                    | `playwright.config.ts`: homepage, auth, routes and redirects, account, roadmaps (plan, list, detail, add, generate, reorder, rate, assistant), explore, blogs, notifications, roll, footer |
| `npm run test:owner`                                      | `playwright.owner.config.ts`: owner overview, hours, status, verification and history, resubmission, menu, menu approval                                                                   |
| `npm run test:map`                                        | `playwright.map.config.ts`: registration, profile, map picker, provinces and wards, nearest province                                                                                       |
| `npx playwright test -c playwright.roadmap-map.config.ts` | Roadmap and assistant maps with the real renderer and local Mapbox fixtures (`ANGI_TEST_MAPBOX_OFFLINE=1`)                                                                                 |
| `npm run test:live` (opt-in)                              | `tests/live` against the real local backend with your own accounts                                                                                                                         |

Not collected by any config yet: `admin-dashboard`, `admin-mods`, `admin-permissions`, `menu-review`, `owner-reviews`, `report-handling`, `restaurant-moderation` and `verification-review` (`tests/browser/*.spec.ts`). Add them to a config before relying on them.
