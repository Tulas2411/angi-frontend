# Frontend architecture

These are implementation notes for the frontend scaffold. Canonical architecture and sources of truth are in [the frontend project rules](../.agents/project_architecture.md); implementation conventions are in [the coding rules](../.agents/coding_rule.md).

The repository remains Next.js App Router, React, strict TypeScript, Tailwind 4 and npm. Existing auth DTOs, encrypted session, refresh coordination, server guards and backend proxy allowlist are retained. No new backend or deployment was introduced. Playwright and Prettier are development dependencies; simple components use React and native HTML rather than added form/query libraries.

| Area                                         | Responsibility                                                                                      |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `src/styles/theme/tokens.css`                | Retrieved colors, typography, dimensions, radii, borders and shadows                                |
| `src/app/globals.css`                        | Responsive layout, component interaction states and reduced motion                                  |
| `public/assets/figma`, `public/assets/fonts` | Real local Figma exports, fonts and font licenses                                                   |
| `src/shared/ui`                              | Existing Button/Input/Card/Alert/Badge primitives and typed variants                                |
| `src/components/ui/primitives.tsx`           | Labels/fields, choices, tabs, dialogs/drawers, tables, uploads, image fallback and feedback         |
| `src/components/layout/workspace.tsx`        | Role navigation, public/staff shells, profile identity, footer and breadcrumbs via page composition |
| `src/components/domain`                      | Cards, independent statuses and map picker/artwork                                                  |
| `src/features/*/pages.tsx`                   | Domain page composition and controlled interactions                                                 |
| `src/features/roadmaps/expenses.tsx`         | Expense records, totals and confirmation flow                                                       |
| `src/features/platform/contracts.ts`         | Typed frontend view models and `DataService` interface                                              |
| `src/api/services/data-service.ts`           | Isolated demo service and explicit unavailable live adapter                                         |
| `src/features/platform/provider.tsx`         | Data loading/readiness, retry, serialized mutations, busy feedback and toast                        |
| `src/features/platform/rules.ts`             | Permissions, dates, pagination, snapshots and single-event retry rules                              |
| `src/mocks`                                  | Internally consistent fixtures, fixed demo date and development scenarios                           |

## Data and adapter boundary

`DataService.load()` returns `AppData`; `save(next)` returns the saved view model. The provider uses cloned state and serializes mutations to prevent lost concurrent edits. It publishes loading/ready/unavailable states, retry, busy state and feedback. The router renders usable feature components only after readiness. Replace the live adapter with verified API DTO mapping without changing page props or component contracts. A future granular service/query layer can sit behind this boundary; the scaffold's whole-state save is not an invented backend endpoint.

Fixtures are deterministic, using a fixed 2026-10-09 demo date. Entity IDs connect dish/restaurant/menu/trip records. Pending menu edits stay separate from the current menu. Published blog trip snapshots freeze names/prices so later menu edits do not rewrite published content. Owner registration updates the current Owner restaurant reference. Demo profile edits update the header and authored mock content. Uploaded photos use local data URLs so they survive component unmounts during navigation; no remote upload/media ID is invented. These changes reset on reload and are never sent to auth/backend handlers.

## Authorization and important rules

Server routes use the existing `requireUser` role guard. Admin accesses moderation through the existing role policy. UI permissions help explain access, while the backend remains authoritative for real authorization. The demo role DTOs exist only under explicit preview routes and never create an authenticated cookie.

Self-registration permits only Traveler and Owner. Mod creation captures invitation state without a password field or real email delivery. Mod editing allows display name and activation, without deletion or role conversion. Permission editors support inherit/allow/deny, serialize only explicit allow/deny, and replace the whole override array; empty means inherit defaults. Audit views have no mutation controls. Single dead synchronization retry queues pending without claiming completion. Restaurant verification, operating and moderation statuses are distinct fields. Hidden blog/comment context preserves the unavailable-reading limitation.

## Accessibility and composition

Native form controls have labels, helper/error text and accessible names. Tabs and combobox support keyboard navigation. Native modal dialogs manage focus, return focus and handle Escape; drawers reuse the same semantics. Focus outlines are visible, badges include text, notifications/toasts announce status, and motion respects `prefers-reduced-motion`.

Desktop uses the reference content width and role-specific navigation. Mobile stacks content while containing navigation/table overflow; modal content scrolls within viewport bounds. Map controls are intentionally positioned overlays on exported static artwork. No full-screen screenshot is used as a UI asset.

## Pending contracts

The canonical API Design workbook is maintained in the separate `angi-backend/.docs/` directory (currently `ANGI_API_Design_Ver1.8.xlsx` in the sibling checkout). Current non-auth models have not been mapped to those contracts; they remain frontend view models, and Figma constraints do not establish server DTOs. Business adapters, invitations, verification/recovery/OAuth, media storage, AI/recommendations and live mapping need verified endpoint contracts and backend availability. Frontend demo preview limits (31-day generated trips, small destination fixtures, simulated upload delay and bounded photo counts) are documented scaffold behavior, not claimed server restrictions. Existing real auth request fields/errors remain authoritative.
