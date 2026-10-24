# ANGI design coverage

The visual reference for the product is the **public homepage** (`/`), implemented from the owner's redesign (see [public homepage](public-homepage.md)). The rest of the frontend was aligned with it in October 2026 and reduced to screens that are connected to the backend (see the [scope inventory](scope-inventory.md)).

## What is covered

| Design element         | Implementation                                                                                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Palette                | Canvas `#F4EFE7`, Card `#FFFFFF`, Control `#EEE9E7`, Ink `#222222`, Muted `#68615D`, Coral `#FF5E62`, Line `#E7E3E5` (`src/styles/theme/tokens.css`, unchanged)                                                          |
| Typography             | Fraunces 900 for the brand and headings; Be Vietnam Pro 400/600 for body text and controls; fonts self-hosted                                                                                                            |
| Layout                 | One page width (1224px), gutter (40/24/20/16px by breakpoint) and header height shared by the homepage and every app page                                                                                                |
| Header and footer      | `SiteHeader`, `SiteNav`, `AccountMenu`, `SiteFooter` — identical on the homepage, auth pages, account and owner workspace                                                                                                |
| Buttons, fields, cards | `src/shared/ui` and `src/components/ui/primitives.tsx`: primary/secondary/tertiary/destructive/icon buttons, labelled fields with helper and error text, password field with show/hide, cards, alerts, badges, skeletons |
| Dialogs                | One native `<dialog>` implementation with open/close transitions, focus management and Escape; `ConfirmDialog` for every decision; no browser `alert`, `confirm` or `prompt`                                             |
| States                 | Loading (skeleton/spinner), empty, error with retry, success and disabled/busy states on every connected screen                                                                                                          |
| Responsive             | 1440, 1024, 768, 390 and 320px; no page-wide horizontal scroll; tables and navigation contain their own overflow                                                                                                         |
| Motion                 | Short transitions; `prefers-reduced-motion` removes them                                                                                                                                                                 |

## Screens

| Screen                                                     | Design basis                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Homepage                                                   | Owner redesign (collage, taste and roadmap examples, searchable editorial collection)                                                                                                                                                                                                                                                                                           |
| Login, register, recovery                                  | Shared auth shell: eyebrow, serif heading, card, footer link; Vietnamese copy                                                                                                                                                                                                                                                                                                   |
| Account                                                    | Identity card and profile form in a two-column grid; password dialog                                                                                                                                                                                                                                                                                                            |
| Owner overview, profile, hours, status, verification, menu | Existing Figma-derived owner families restyled with the shared tokens and shell; per-feature notes (Vietnamese) in [business hours](business-hours.vi.md), [verification](restaurant-verification.vi.md), [status and history](verification-status.vi.md), [resubmission](verification-resubmission.vi.md), [menu](restaurant-menu.vi.md), [menu approval](menu-approval.vi.md) |
| Owner location picker                                      | Full-surface map dialog: search upper left, close upper right, locate/zoom on the right, save lower right; manual coordinates; see [map address prefill](map-address-prefill.vi.md)                                                                                                                                                                                             |

## Owner review replies

The owner "Lắng nghe thực khách" screen (`465:52828`) moved out of the shared `features/owner/pages.tsx` into `restaurant-reviews-page.tsx` with a dedicated stylesheet. It shows a rating summary (average, five-level breakdown, answered/unanswered/hidden counts), three filters (reply status, star level, sort order), and the review list with customer photos and the restaurant reply. Replying opens the shared `Dialog`; removing an existing reply uses the shared `ConfirmDialog`, and a hidden review cannot be replied to.

Data is a demo fixture (`src/mocks/owner-reviews.ts`, 15 reviews covering every star level, with and without photos, replied and not replied, plus one hidden review). **No API is wired yet**: the backend has no owner reply endpoint, so a reply is kept in component state for the session only and is marked `Đang chờ kiểm duyệt`. A banner states this explicitly. Public `GET /restaurants/{id}/reviews` (REST-04) remains the only real reviews contract; adding owner replies requires a new backend endpoint plus its use case, migration and proxy allowlist entry.

Browser coverage: `tests/browser/owner-reviews.spec.ts` (filtering, empty-field validation, reply, pending badge, confirmed removal, disabled button on hidden reviews).

## Earlier screens

Guest, Traveler, Moderator and Administrator screens (discovery, guides, blogs, roadmaps, expenses, moderation, administration, permissions, audit and synchronization) keep their original design coverage and demo fixtures. They render inside the earlier workspace shell with their own scoped stylesheet (`src/styles/legacy-workspace.css`) and are restyled only when their authors integrate them with the backend. [design-inventory.json](design-inventory.json) records the original Figma frame inventory (7,271 frames, sections and component definitions).

## Assets

Local exports, fonts and licenses are listed in [assets.json](assets.json) and verified by `node scripts/verify-assets.mjs`. Screenshots are never used as page content; decorative images have empty alt text and meaningful images describe their content.
