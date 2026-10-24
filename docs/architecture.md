# Frontend architecture notes

Canonical architecture and sources of truth are in [the frontend project rules](../.agents/project_architecture.md); implementation conventions are in [the coding rules](../.agents/coding_rule.md). This page is a short map of where things live.

The repository is Next.js App Router, React, strict TypeScript and npm. The encrypted session, refresh coordination, server guards and the backend proxy allowlist are the foundation for every screen. Playwright and Prettier are development dependencies; simple components use React and native HTML rather than form or query libraries.

| Area                               | Responsibility                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/styles/theme/tokens.css`      | Palette, typography, spacing, radii, shadows, page width, gutter, header height, motion     |
| `src/app/globals.css`              | Base styles, layout, controls, site header/footer/account menu, dialogs, responsive rules   |
| `public/assets`                    | Local fonts, homepage photos, logo and licenses (manifest: `docs/assets.json`)              |
| `src/shared/ui`                    | Button, Input, Card, Alert, Badge primitives and typed variants                             |
| `src/components/ui/primitives.tsx` | Fields, password field, combobox, tabs, dialog and confirm dialog, upload, skeleton, avatar |
| `src/components/site`              | `SiteHeader`, `SiteNav`, `AccountMenu`, `SiteFooter` shared by the homepage and the app     |
| `src/components/app-shell.tsx`     | Authenticated shell: skip link, header, owner navigation, footer                            |
| `src/components/domain`            | Map location dialog and interactive map, province and ward fields                           |
| `src/features/auth`                | Session, roles and landing pages, login/register/recovery forms, server helpers             |
| `src/features/account`             | Account page, rules and service for ME-01/02/03                                             |
| `src/features/discovery`           | Public homepage and its local content                                                       |
| `src/features/owner`               | Owner pages, services, rules and DTOs for OWN-01..18                                        |
| `src/shared/api`                   | Browser client, error model, server HTTP helpers, owner-menu proxy rules                    |

## Earlier workspace screens

Screens built before the shared shell (`/demo/*`, `(explore)`, owner reviews, moderation, administration) keep `PlatformProvider`, `src/mocks` and `WorkspaceShell`. Their stylesheet is `src/styles/legacy-workspace.css`, generated from the previous global CSS and scoped under `.legacy-ui` (`LegacyScope`), so it cannot change the integrated screens.

## Data boundary

Every integrated screen loads and saves through a typed service that calls the same-origin API client. Services return the unwrapped `data` of the backend envelope and raise `ApiError` for failures. There is no whole-state save, no provider that owns business data and no sample data behind a failed call: a failed load shows an error with retry. Pending menu edits, verification, operating and moderation statuses stay separate fields in the UI.

## Accessibility and composition

Native form controls have labels, helper and error text and accessible names. Native `<dialog>` modals manage focus, return focus and handle Escape; the open and close transitions respect `prefers-reduced-motion`. The sticky header uses `scroll-padding-top` so focused elements are not hidden under it. Focus outlines are visible, badges include text, alerts announce status and tables or navigation contain their own overflow on small screens. All pages share one width and gutter, from 1440px down to 320px.

## Contracts

The canonical API Design workbook is maintained in the backend repository (`angi-backend/.docs/ANGI_API_Design_Ver1.8.xlsx` at the time of writing). Figma constraints never establish server DTOs. See the [scope inventory](scope-inventory.md) for which operations are integrated.
