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

## Retired

The earlier coverage of demo-only Guest, Traveler, Moderator and Administrator screens (discovery, guides, roadmaps, expenses, moderation, administration, permissions, audit and synchronization) was retired together with those screens. They return only when their backend endpoints exist and an adapter is built. [design-inventory.json](design-inventory.json) still records the original Figma frame inventory (7,271 frames, sections and component definitions) as a historical reference; most of its routes no longer exist.

## Assets

Local exports, fonts and licenses are listed in [assets.json](assets.json) and verified by `node scripts/verify-assets.mjs`. Screenshots are never used as page content; decorative images have empty alt text and meaningful images describe their content.
