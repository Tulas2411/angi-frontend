# Public homepage preview

> **Update 10/2026:** run the homepage suite with `npm run test:browser` (`playwright.config.ts`). The per-suite configs mentioned below were merged; the current behavior is summarized in [Current behavior](#current-behavior-october-2026-cleanup).


Owner-requested homepage redesign, 2026-10-22. No Jira key was assigned. Branch: `feat/public-homepage`, created without an upstream from the latest fetched `origin/dev` (`93d502f`). Changes remain unstaged and uncommitted.

## Open and review

Run the frontend normally and visit `http://localhost:3000/` in a private window or after logging out. Signed-in Restaurant Owners are redirected to `/restaurant`; every other signed-in role sees this page with the account menu instead of the login button (see "Current behavior" at the end). The existing session configuration is still required; no new env variables or packages were added.

- Desktop: food collage with two direct actions for taste discovery and roadmap examples. The existing cream, coral, ink and neutral palette is unchanged.
- Mobile: stacked hero, wrapping navigation/filters and an overlapping photo collection with exposed tap areas at narrow widths.
- Search the eight-item editorial collection by dish, origin or taste, with or without Vietnamese accents. Query and taste filters use `/?q=...&taste=...#mon-ngon`; reload, shared links and browser Back preserve the selection. Empty results offer a reset link.
- Open a dish to read its short story and serving suggestion in the shared accessible Dialog. Escape, close and continue actions return focus to the trigger.
- The collection displays photographs only in an overlapping scatter. Photo order, bounded rotation and size variation are randomized on the server for each response, then passed unchanged to the client. Small/medium/large sizes span 0.78–1.08 of each responsive slot, with a shuffled size distribution and bounded jitter; a single search result keeps its normal size. Back layers are dimmer; hover or keyboard focus brings a photo forward and keeps it sharp. Other photographs retain opacity 1 and receive brightness 0.28 with 12px blur over the whole photo, including its edges. Dish names remain accessible and full details appear in the popup. The denser revision adds bánh mì trứng, bún thịt nướng, cơm tấm sườn trứng and bánh cuốn using the existing `roll-1..4.png` exports, for eight distinct dishes and photographs. Search and filters select from this same collection.
- Registration/login links open the existing real auth pages. Owner/protected routes retain their existing guards.

## Layout revision: recommendations and roadmaps

The owner's follow-up requested stronger composition and visible emphasis on ANGI's two core features. The reading order is now: product promise → taste/roadmap/discovery navigation → interactive taste example → two-day roadmap example → searchable food collection → registration. The generic tea/story section was replaced by the roadmap board; search moved to the collection it actually searches. Hero imagery uses the existing `roll-2.png` grilled-pork noodle and `roll-1.png` egg-banh-mi exports; the roadmap also reuses `roll-0.png` pho and `roll-4.png` banh-cuon. No new remote assets or dependencies.

- `#goi-y`: choose rich, fresh or warm; the editorial dish and explanation change immediately. The example is labeled as illustrative and does not save a profile. The real personalization entry points to `/login`.
- `#lich-trinh`: select Day 1/Day 2 and an individual meal to change its photograph, time and description. Switching days selects that day's first meal. It is a sample meal plan with no invented restaurant address, routing distance, travel time, map or automatic optimization. The real itinerary entry points to `/login`.
- Both controls work with keyboard buttons and announce changes. They keep state only while mounted, make no API requests and require JavaScript; collection GET search/filtering continues to work without JavaScript.
- These examples explain the product direction. They do not implement F-17, replace the official survey `option_code` catalog, run a recommendation model or save a real roadmap. The previous pause on F-17 remains in effect.

## Scope and data

The photo scatter replaces the earlier rectangular dish cards. Eight depth levels and staggered rows create a denser overlap; responsive slots keep exposed tap areas and compact arrangements for filtered results. A single tap opens the selected dish on touch devices. Native modal entry/exit transitions use opacity, scale and a softened backdrop; content stays mounted through closing to avoid a blank exit frame. The denser revision uses a 560ms eased panel entry, a shorter 280ms exit and small, staggered content transitions. Backdrop opacity fades over a fixed blur instead of interpolating the full-screen blur radius. The already-loaded thumbnail supplies the image background while the larger popup image loads, preserving its aspect ratio and layout. `prefers-reduced-motion` removes panel/content transitions and photo zoom. Unsupported discrete transitions degrade to normal native dialog behavior. The shared Dialog gained only an optional `className` in the initial scatter delivery; this follow-up changes no shared modal behavior. Animation follows the native [MDN dialog transition pattern](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog#animating_dialogs), without a new animation package.

Typography refinement: the owner found the original headings too rigid. (Superseded: see "Current behavior" — headings and the brand render in Fraunces 900, body text and controls in Be Vietnam Pro 400/600.) The homepage then used one self-hosted Be Vietnam Pro family: 600 for headings and emphasis, 400 for body text. Heading tracking was relaxed from -0.045em to -0.025em, hero line height increased from 1.1 to 1.18, and the largest headline slightly reduced to suit the new letterforms. The former 800-weight Manrope face and its unused local font/license files were removed. Layout, palette and non-homepage typography stay unchanged. No remote font downloads occur at build or page load.

This is a visual/product direction implemented in the real app, not a replacement for all workspaces. Only `/` and its local components/styles changed. Other screens keep their current typography and layout. The static collection is described as food inspiration, with no invented restaurant IDs, prices, ratings, popularity, proximity, availability or live AI results. No backend recommendation, restaurant search, save or itinerary mutation is presented as working on this page.

The homepage calls no business adapter and initializes no map. The feature adds no backend/provider requests. The existing app-wide `GoogleProvider` remains unchanged and may load Google's sign-in SDK when configured; the isolated homepage suite disables it. Search is a server-rendered GET form and remains usable without JavaScript; the interactive previews require JavaScript. Be Vietnam Pro (400/600) is self-hosted using `next/font/local`, with its OFL license and official Google Fonts source recorded in `assets.json`. Existing `dish-0..4.png` and `roll-*.png` Figma exports supply the food/tea photographs; captions match their visible contents.

## Verification

Run from the frontend root with the project's Node.js version and installed dependencies:

```powershell
npm run lint
npm test
npm run build
npm run typecheck
$env:PLAYWRIGHT_BROWSERS_PATH = "$PWD/.cache/browsers"
npx playwright test -c playwright.config.ts
```

The homepage browser configuration builds an isolated production source snapshot on port 3001, copies no private env files, uses a local auth stub on 5164, clears the Mapbox token and blocks external browser requests. It leaves a user's running server on 3000 untouched. Screenshots go to ignored `artifacts/homepage/`; test reports/traces are also ignored. The browser path above assumes Chromium was installed into that local cache; otherwise use your normal Playwright browser installation.

Initial food-first version results on 2026-10-22 (before the layout revision above):

| Check                                                        | Result                                                                                                                                                                                                       |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Full ESLint, standalone TypeScript and changed-file Prettier | Passed                                                                                                                                                                                                       |
| Full Vitest suite                                            | 17 files, 142 tests passed                                                                                                                                                                                   |
| Isolated production build and Playwright homepage suite      | Build passed; 12 browser tests passed                                                                                                                                                                        |
| Responsive and visual review                                 | Screenshots inspected at 1440, 768 and 390px; 320px homepage/modal fit checked; 320px modal screenshot inspected                                                                                             |
| Images/fonts/licenses                                        | 44 Figma exports, 8 font files and 4 licenses verified by `scripts/verify-assets.mjs`                                                                                                                        |
| Auth and isolation                                           | All four existing role-home redirects preserved; protected owner navigation still redirects guests; login retains its Fraunces typography; guest discovery creates no auth cookie and makes no backend calls |
| External usage                                               | Browser requests outside localhost blocked, Mapbox token blank; zero Mapbox requests                                                                                                                         |

Screenshots: `artifacts/homepage/home-{1440,768,390,320}.png` and `dish-{1440,768,390,320}.png`. Browser coverage includes no-accent search, combined filters, empty/reset states, URL reload/Back, JavaScript-disabled search/filtering, registration/login links, skip navigation, native modal background inertness, Escape, focus restoration and image loading. The initial test harness was corrected to wait for navigation, skip images inside closed dialogs and account for Chromium's focusable scrolling dialog content; the final run above passed. The production build used the installed local runtime; CI remains configured for Node.js 24. No private env values were copied and no live backend/provider verification was required for this editorial UI preview.

### Layout revision verification — 2026-10-22

- Full ESLint, standalone TypeScript and changed-file Prettier passed. All 17 Vitest files / 142 tests passed again. Asset verification passed for 44 Figma exports, 8 font files and 4 licenses.
- Production build passed on an isolated source snapshot. The initial combined Playwright runner exceeded its 240-second server-start timeout; building that snapshot directly succeeded, then all **14 browser tests passed** against that same production output using an ignored local server-reuse configuration. No source, private env or provider behavior was changed to bypass the timeout.
- The two additional browser cases cover taste changes/reasons, keyboard selection, reset on reload, day/meal switching, resetting the meal when changing day, correct photo/caption and unchanged collection data. Existing guest search, no-JS search, modal focus, all four auth redirects and protected-route checks still pass.
- Homepage and modal fit at 1440, 768, 390 and 320px. Inspected the revised full desktop page and the dedicated recommendation/roadmap screenshots, including narrow mobile layouts. New section captures: `artifacts/homepage/goi-y-{1440,768,390,320}.png` and `lich-trinh-{1440,768,390,320}.png`. No horizontal overflow, failed local photos or Mapbox requests were observed. Guest interactions make zero backend calls.
- Only the homepage presentation/preview behavior changed; no live preference-survey, recommendation or roadmap integration was added. Changes remain on `feat/public-homepage`, unstaged and uncommitted.

### Typography refinement verification — 2026-10-22

Changed-file ESLint, standalone TypeScript, Prettier and the isolated production build passed. Six focused browser checks passed against that production output: homepage/modal layouts at 1440, 768, 390 and 320px, keyboard/Escape/focus restoration, and auth/protected navigation with unchanged login typography. Inspected the updated recommendation and roadmap screenshots on desktop/mobile; Vietnamese accents render correctly and there is no horizontal overflow. Asset verification now passes for 44 Figma exports, **7 font files and 3 licenses**, after removing the unused Manrope assets. External browser requests were blocked and there were zero Mapbox requests. The unit suite was not rerun for this font/style-only refinement; earlier unit counts above remain historical.

After these checks, reopened the latest workbook from disk once more: backend `ANGI_API_Design_Ver1.8.xlsx`, 778,867 bytes, with the same SHA-256 recorded below. Reviewed `Backend API` row 19 (HOME-01). Typography has no API mapping; no endpoint, DTO, JSON payload, validation or error behavior changed.

### Photo scatter and popup verification — 2026-10-22

- Full ESLint, standalone TypeScript, changed-file Prettier and asset verification passed. The final full Vitest run passed **18 files / 145 tests**, including shuffle completeness, immutable input, bounded rotation and filtered/single-result layouts.
- The isolated production build passed. All **17 homepage browser tests passed** against that production output. Coverage includes overlapping photo hit areas, hover brightness/dimming, keyboard activation, actual popup entry/exit transitions, retained content during closing, focus restoration and reopening. Existing search, no-JavaScript filtering, taste/roadmap examples and role redirects continue to pass.
- Inspected the photo collection at 1440px and 320px, desktop hover state and the 390px popup. Browser layout checks passed at 1440, 768, 390 and 320px. A separate touch check opened all four photos at 320px with reduced motion enabled and found no horizontal overflow.
- Updated captures: `artifacts/homepage/mon-ngon-{1440,768,390,320}.png`, `cloud-hover.png` and `dish-{1440,768,390,320}.png`. These generated files remain ignored. Local assets pass verification for 44 Figma exports, 7 font files and 3 licenses.
- Tests used the isolated local auth stub, blank Mapbox token and blocked external browser requests. The guest interactions make no backend calls and consume no Mapbox usage. Changes remain on `feat/public-homepage`, unstaged and uncommitted.
- After the final tests, compared the available workbooks and reopened the newest backend `ANGI_API_Design_Ver1.8.xlsx` from disk. Size and SHA-256 below are unchanged; inspected `Backend API` row 19 (HOME-01). This presentation-only revision has no API mapping and changes no endpoint, DTO, JSON payload, validation or error contract. HOME-01 integration remains outside this preview.

### Denser collection and softer popup verification — 2026-10-23

- Expanded the collection from four to eight distinct dishes using four existing local photographs. Added eight depth levels, staggered overlapping rows and responsive arrangements for filtered collections. No new assets, packages, routes or env variables.
- Full ESLint, standalone TypeScript, changed-file Prettier, asset verification and the isolated production build passed. Full Vitest: **18 files / 145 tests passed**. Final homepage browser run against that production output: **19 tests passed**.
- The two additional browser cases verify a cached thumbnail remains visible while the larger image is deliberately delayed on a 2x screen, with no image-container layout shift, and exposed hit areas for five/six filtered photos at 1440px and 320px. Existing tests now cover all eight photos on a touch device at 320px, reduced motion for panel and content, keyboard/focus restoration, real entry/exit transitions, repeated popup opening, search and auth redirects.
- Inspected the new 1440px/320px photo collections, the 390px popup and the delayed-image preview screenshot. Responsive layout checks passed at 1440, 768, 390 and 320px. Captures remain in ignored `artifacts/homepage/`; the slow-image case adds `dish-loading-preview.png`.
- The machine temporarily ran out of system/pagefile resources while checks were running; the production build and final checks subsequently completed successfully. The initial extra test fixtures were corrected to distinguish thumbnail/large-image requests on a 2x screen and use a search term that actually produces six results; application behavior was not changed to satisfy those fixture corrections.
- Only isolated local services were used, with external browser requests blocked and the Mapbox token blank. No real backend/provider calls were added. Branch remains `feat/public-homepage`; changes remain unstaged and uncommitted.
- After code and final checks, listed the available API Design workbooks and reopened the newest backend `ANGI_API_Design_Ver1.8.xlsx` from disk. Version, size (778,867 bytes) and SHA-256 below are unchanged. Inspected `Backend API` row 19 (HOME-01). This visual revision has no API mapping and changes no endpoint, DTO, JSON payload, validation or error contract; the editorial preview still does not call HOME-01.

### Varied sizes and opaque blur verification — 2026-10-23

- Added server-generated size factors from 0.78 to 1.08, shuffled independently of dish order/depth and adjusted by bounded jitter. The layout is serialized once; hover/focus preserves each photo's relative size and reduced motion retains the static size variation. A single filtered result stays at normal size.
- Removed opacity changes from photo hover/focus. All photo articles remain at opacity 1; inactive photos use brightness 0.28 and 12px blur, including their edges. The active photo stays sharp and bright. Popup transitions retain their existing opacity animation.
- Changed-file ESLint, standalone TypeScript and Prettier passed. The two relevant Vitest files passed **7 tests** for shuffle completeness, size/rotation bounds, guaranteed size spread and filtering. The full 145-test result above belongs to the preceding revision and was not rerun for this change.
- The isolated production snapshot was synchronized against the current source/assets inventory (three changed source files), then rebuilt. The successful normal retry exited 0. Next.js initially stopped after compilation with `SecurityFatalError`, reporting a known vulnerability in installed **16.4.0** and recommending an upgrade. The installed framework's normal retry mechanism permits continuing the task; this warning remains outstanding. No dependencies, upgrade preferences or security settings were changed. Local logs: `.cache/home-variance-build.log` and `home-variance-build-retry.log`.
- **9 focused browser tests passed** against that production output: varied rendered widths, overlapping hit areas, opacity staying 1 with the stronger blur, hover/keyboard selection, popup entry/exit/focus and delayed image loading, filtered five/six-result layouts, all eight touch targets at 320px with reduced motion, and page/modal layouts at 1440, 768, 390 and 320px.
- Inspected the updated 1440px/320px collection and `artifacts/homepage/cloud-hover.png`. Local auth stub only, blank Mapbox token and blocked external browser requests; no real backend/Mapbox calls. Changes remain unstaged and uncommitted on `feat/public-homepage`.
- After the final checks, compared available workbooks and reopened backend `ANGI_API_Design_Ver1.8.xlsx` from disk; it remains the newest copy at 778,867 bytes with the same SHA-256 below. Inspected `Backend API` row 19 (HOME-01). This presentation-only revision has no API mapping and changes no endpoint, DTO, JSON payload, validation or error contract.

## Final API Design reconciliation

After implementation and checks, reopened `../angi-backend/.docs/ANGI_API_Design_Ver1.8.xlsx` from disk and compared the available workbook versions. The backend copy is the newest available (778,867 bytes, modified 2026-10-15); SHA-256: `4899E6D319904575D4A47289CECF8FA93229A867A53110701DEDA5E15786186C`. It was unchanged during this task.

Inspected `Tổng quan` rows 91, 95, 109–110; `Backend API` rows 18–20; `UC ↔ API` rows 8 and 15; `Chi tiết Request-Response` rows 54–61; parsed the HOME-01 sample in `JSON mẫu` rows 293–400; reviewed `Mã lỗi` row 10 (`VALIDATION_FAILED`).

HOME-01 **does exist**: public `GET /api/v1/home`, optional token, `province` and `limit` (1–50). Its data contains `trendingDishes`, `topRestaurants`, `featuredBlogs` and `recommended` (`requestId`, `items`); banners are frontend content. This delivery intentionally covers the owner's requested visual homepage preview and **does not connect HOME-01**, DISH-01 search or IMP-01. The local `q`/`taste` filters are editorial UI parameters, not those APIs' wire fields or tag IDs. The collection makes no trending/top/live recommendation claim. Production catalog/recommendation blocks, real dish/restaurant detail links and impression handling remain a separate integration step. No endpoint, DTO, proxy allowlist or server error contract was changed.

After the layout revision and its checks, reopened the newest backend workbook from disk again. Version, size and SHA-256 above remain unchanged. Additionally inspected `Backend API` rows 19, 22, 29–34 and 41: HOME-01, DISH-03, PREF-02/03 and RM-01..04/11. Real survey submission requires official `optionCode` values, is Traveler-only and has one-time/409 semantics; the three homepage taste keys are never submitted as those codes. Real roadmap creation/detail require a Traveler session and server records; the local two-day example has no roadmap/restaurant IDs and calls none of those operations. Copy and login entry points reflect these boundaries. No DTO, validation/error handling or proxy contract was modified by the revision.

## Current behavior (October 2026 cleanup)

The frontend was reduced to backend-integrated screens and the rest of the app was aligned with this homepage (see the [scope inventory](scope-inventory.md)). What changed for `/`:

- **Shared shell.** The homepage uses the same `SiteHeader`, `AccountMenu` and `SiteFooter` as every other page, with the same page width (`--page-width`), gutter and header height from `src/styles/theme/tokens.css`. The homepage stylesheet no longer carries its own header, footer or skip-link rules.
- **Fonts as actually rendered.** Headings and the brand: Fraunces 900. Body text and controls: Be Vietnam Pro 400/600 (DM Sans 400/600 is also loaded). All fonts are self-hosted from `public/assets/fonts`. Earlier text in this file that mentions Be Vietnam Pro headings or `homeFont` describes a superseded revision. The palette is unchanged.
- **Signed-in state.** Owners are redirected to `/restaurant`. Traveler, Moderator and Administrator see the same page with the account menu (`/account`, logout) in place of the login button, and the "Tham gia ANGI" calls to action are hidden.
- **Copy.** The taste and roadmap examples are labelled as illustrations that are not saved. For guests their calls to action point to `/register` ("Tham gia ANGI"); the old "Đăng nhập để cá nhân hóa" and "Đăng nhập để tạo lịch trình" links are gone.
- **Reduced motion.** `prefers-reduced-motion` sets animation and transition durations to `0s` globally.
- **No backend calls.** The page makes no backend request; the recommendation, search and roadmap behavior remains local editorial content. HOME-01 exists in the backend but is intentionally not used.
- **Tests.** `tests/browser/public-home.spec.ts` (run with `npm run test:browser`) covers search and filters, no-JavaScript behavior, keyboard/Escape/focus restoration, the taste and roadmap examples, owner redirect versus signed-in homepage for the other roles, photo hit areas, reduced motion and layouts at 1440, 768, 390 and 320px.
