---
version: alpha
name: VnRental-linear-inspired-dashboard
description: "A Linear-inspired operational dashboard system for VnRental: quiet, dense, precise, and product-first. The system borrows Linear's discipline around restrained color, hairline borders, compact controls, and clean typography, but shifts the brand accent from lavender-blue to a deep rental-operations teal (#0f766e). The default product surface is light graphite-white, not marketing dark mode: warm off-white canvas, white panels, graphite ink, soft teal focus states, and sparse semantic color for operational status. The result should feel modern and trustworthy without looking like an old Bootstrap or Ant Design admin template."

colors:
  primary: "#0f766e"
  on-primary: "#ffffff"
  primary-hover: "#14b8a6"
  primary-focus: "#0d9488"
  primary-soft: "#ccfbf1"
  primary-subtle: "#f0fdfa"
  ink: "#111827"
  ink-muted: "#4b5563"
  ink-subtle: "#6b7280"
  ink-tertiary: "#9ca3af"
  canvas: "#f6f7f4"
  surface-1: "#ffffff"
  surface-2: "#f9faf8"
  surface-3: "#f1f5f2"
  surface-4: "#e8eee9"
  hairline: "#e2e8e3"
  hairline-strong: "#cbd5cc"
  hairline-tertiary: "#b7c4b9"
  inverse-canvas: "#0b1110"
  inverse-surface-1: "#111917"
  inverse-surface-2: "#17211f"
  inverse-ink: "#f8faf8"
  semantic-success: "#16a34a"
  semantic-success-soft: "#dcfce7"
  semantic-warning: "#d97706"
  semantic-warning-soft: "#fef3c7"
  semantic-danger: "#dc2626"
  semantic-danger-soft: "#fee2e2"
  semantic-info: "#2563eb"
  semantic-info-soft: "#dbeafe"
  semantic-overlay: "#020617"

typography:
  display-xl:
    fontFamily: Geist Sans
    fontSize: 64px
    fontWeight: 650
    lineHeight: 1.05
    letterSpacing: -2.0px
  display-lg:
    fontFamily: Geist Sans
    fontSize: 48px
    fontWeight: 650
    lineHeight: 1.10
    letterSpacing: -1.2px
  display-md:
    fontFamily: Geist Sans
    fontSize: 36px
    fontWeight: 650
    lineHeight: 1.15
    letterSpacing: -0.8px
  headline:
    fontFamily: Geist Sans
    fontSize: 26px
    fontWeight: 650
    lineHeight: 1.20
    letterSpacing: -0.4px
  page-title:
    fontFamily: Geist Sans
    fontSize: 22px
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: -0.2px
  card-title:
    fontFamily: Geist Sans
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.30
    letterSpacing: 0
  body:
    fontFamily: Geist Sans
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.50
    letterSpacing: 0
  body-sm:
    fontFamily: Geist Sans
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: 0
  caption:
    fontFamily: Geist Sans
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.40
    letterSpacing: 0
  button:
    fontFamily: Geist Sans
    fontSize: 13px
    fontWeight: 550
    lineHeight: 1.20
    letterSpacing: 0
  eyebrow:
    fontFamily: Geist Sans
    fontSize: 11px
    fontWeight: 650
    lineHeight: 1.30
    letterSpacing: 0.6px
  mono:
    fontFamily: Geist Mono
    fontSize: 13px
    fontWeight: 450
    lineHeight: 1.50
    letterSpacing: 0

rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 10px
  xl: 14px
  xxl: 18px
  pill: 9999px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 72px

components:
  app-shell:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
  sidebar:
    backgroundColor: "{colors.inverse-canvas}"
    textColor: "{colors.inverse-ink}"
    rounded: "{rounded.xs}"
    width: 248px
  topbar:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    height: 60px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 8px 14px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
  button-primary-pressed:
    backgroundColor: "{colors.primary-focus}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
  button-secondary:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 8px 14px
  button-tertiary:
    backgroundColor: transparent
    textColor: "{colors.ink-muted}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 8px 14px
  metric-card:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: 18px
  data-panel:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: 0
  table-header:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-subtle}"
    typography: "{typography.eyebrow}"
  status-badge:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: 2px 8px
  text-input:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 8px 12px
  text-input-focused:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 8px 12px
  empty-state:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: 48px
---

## Overview

VnRental should feel like a focused operations tool, not a legacy admin template. The design borrows Linear's restraint: compact controls, strong alignment, sparse accent color, crisp typography, and fine 1px borders. It does not copy Linear's dark marketing site directly.

The product default is a light dashboard surface:

- `{colors.canvas}` is a warm off-white operational background.
- `{colors.surface-1}` is the main white panel surface for cards, tables, drawers, and modals.
- `{colors.inverse-canvas}` is reserved for the sidebar or rare high-contrast sections.
- `{colors.primary}` is deep teal, used only for primary actions, active states, focus rings, links, and selected navigation.

The visual tone is quiet, dense, trustworthy, and modern. Every screen should help landlords or operators scan rooms, contracts, invoices, and tenant state quickly.

## Color Direction

### Primary Accent

Use teal as the VnRental brand accent:

- **Primary** `{colors.primary}` `#0f766e`: primary buttons, selected nav, key links, important chart accents.
- **Primary Hover** `{colors.primary-hover}` `#14b8a6`: hover state for primary controls.
- **Primary Focus** `{colors.primary-focus}` `#0d9488`: focus rings and pressed states.
- **Primary Soft** `{colors.primary-soft}` `#ccfbf1`: selected chips, subtle active backgrounds.
- **Primary Subtle** `{colors.primary-subtle}` `#f0fdfa`: low-emphasis teal panels.

Teal should be scarce. Do not turn whole pages, cards, or table headers teal.

### Surfaces

The UI should be light, graphite, and calm:

- **Canvas** `{colors.canvas}`: app background.
- **Surface 1** `{colors.surface-1}`: cards, tables, modals, drawers.
- **Surface 2** `{colors.surface-2}`: table headers, subtle toolbar background.
- **Surface 3** `{colors.surface-3}`: selected-neutral chips, nested panels.
- **Inverse Canvas** `{colors.inverse-canvas}`: sidebar shell.

Depth comes from surface contrast, hairline borders, and very restrained shadows. Avoid heavy Bootstrap-style card shadows.

### Text

- **Ink** `{colors.ink}`: headings and primary data.
- **Ink Muted** `{colors.ink-muted}`: labels, table secondary values.
- **Ink Subtle** `{colors.ink-subtle}`: helper text, placeholders, metadata.
- **Ink Tertiary** `{colors.ink-tertiary}`: disabled text.

Data-heavy pages should prefer legibility over decoration.

### Semantic Colors

Use semantic color only when state matters:

- Success: paid, active, occupied, completed.
- Warning: upcoming due, contract ending soon, draft requiring action.
- Danger: overdue, expired, delete/destructive actions.
- Info: links, neutral system notices, generated public invoice links.

Semantic colors should appear as badges, icons, inline alerts, and small state indicators, not as dominant panels.

## Typography

Use `Geist Sans` and `Geist Mono`, already present in the frontend. Do not introduce a new font unless there is a strong product reason.

### Hierarchy

| Token | Size | Weight | Use |
|---|---:|---:|---|
| `{typography.display-xl}` | 64px | 650 | Rare marketing or auth hero |
| `{typography.display-lg}` | 48px | 650 | Rare section hero |
| `{typography.display-md}` | 36px | 650 | Large empty state or public invoice title |
| `{typography.headline}` | 26px | 650 | Modal/drawer hero sections |
| `{typography.page-title}` | 22px | 650 | Dashboard page title |
| `{typography.card-title}` | 16px | 600 | Panel/card title |
| `{typography.body}` | 14px | 400 | Default app text |
| `{typography.body-sm}` | 13px | 400 | Dense tables, forms, toolbar controls |
| `{typography.caption}` | 12px | 400 | Badges, metadata, helper text |
| `{typography.button}` | 13px | 550 | Buttons and tabs |
| `{typography.eyebrow}` | 11px | 650 | Table headers, section labels |
| `{typography.mono}` | 13px | 450 | Room numbers, invoice periods, IDs |

### Principles

- Keep app pages compact: title at 22px is enough for most screens.
- Use mono sparingly for identifiers: room number, invoice period, IDs, meter readings.
- Avoid oversized marketing typography inside dashboards.
- Letter spacing should be subtle; do not overuse negative tracking in dense tables.

## Layout

### App Shell

- Sidebar width: 248px desktop.
- Topbar height: 60px.
- Main content padding: 24px desktop, 16px tablet, 12px mobile.
- Content max width can be fluid for operational tables; avoid narrow centered dashboards when table scanning matters.

### Spacing

Use the 4px scale:

- `{spacing.xs}` 8px for tight control gaps.
- `{spacing.sm}` 12px for row gaps and chip spacing.
- `{spacing.md}` 16px for card inner group spacing.
- `{spacing.lg}` 24px for page padding and panel padding.
- `{spacing.xl}` 32px for major section gaps.

### Responsive Behavior

- Sidebar becomes a drawer below tablet width.
- Tables should gain horizontal scroll or transform into stacked record cards on mobile.
- KPI grids: 4 columns desktop, 2 tablet, 1 mobile.
- Form grids: 2 columns desktop, 1 mobile.
- Primary actions must remain reachable near page headers on all viewports.

## Elevation & Borders

| Level | Treatment | Use |
|---|---|---|
| 0 | Canvas only | Page background |
| 1 | Surface 1 + 1px hairline | Cards, table panels, form panels |
| 2 | Surface 2 + stronger hairline | Table header, hovered row, dropdown |
| 3 | Soft shadow + hairline | Popover, command menu, drawer |
| 4 | Teal focus ring | Focused input/control |

Use shadows sparingly:

- Cards: no shadow or tiny shadow only.
- Popovers/drawers: medium shadow allowed.
- Avoid large floating card shadows across the dashboard.

## Components

### Buttons

**Primary button**

- Background `{colors.primary}`.
- Text `{colors.on-primary}`.
- Height 36px desktop, at least 40px on touch layouts.
- Radius `{rounded.md}`.
- Use for one main action per screen: create invoice, add room, save.

**Secondary button**

- White background, hairline border, graphite text.
- Use for cancel, filters, secondary navigation.

**Tertiary button**

- Transparent background.
- Use for compact row actions, back actions, low-priority commands.

### Sidebar

The sidebar may use `{colors.inverse-canvas}` to create a premium product frame. Keep nav text compact and active state clear:

- Active item: teal accent bar or soft teal text, not a large bright fill.
- Group labels: uppercase 11px.
- Icons: lucide icons at 16px.
- User/account section remains visually quiet.

### Topbar

Topbar should be useful, not ornamental:

- Global search/command affordance.
- One primary shortcut action.
- Notification icon only if backed by real state.
- Sticky on desktop if content scrolls.

### Metric Cards

Metric cards should be compact and scannable:

- 14-18px padding.
- Title/caption muted.
- Number in graphite ink with tabular numerals.
- Small icon or status accent only; no large decorative illustration.

### Data Tables

Tables are the product's main working surface:

- Header background `{colors.surface-2}`.
- Header text uses `{typography.eyebrow}`.
- Row height around 56px for dense lists.
- Hover row uses `{colors.surface-2}`.
- Important numeric values use tabular numerals.
- Row actions should be icon buttons or compact menus.
- Do not put tables inside nested cards.

### Forms

Forms should feel guided but compact:

- Inputs use 36px height desktop, 40-44px touch.
- Labels at 12-13px, muted graphite.
- Group related fields into clear sections.
- Money and meter inputs should right-align only when it improves scanning.
- Validation appears inline below the field.

### Drawers And Modals

- Drawers are ideal for invoice details and room details.
- Drawer width: 520-640px desktop; full-screen on mobile.
- Sticky footer for primary actions.
- Use inline confirmation for destructive actions when possible.

### Empty States

Empty states should be functional:

- One small icon.
- One clear sentence.
- Optional primary action.
- Avoid emoji as the primary visual language.

## Do's And Don'ts

### Do

- Use teal as a scarce, intentional accent.
- Keep surfaces light and borders crisp.
- Build shared components before restyling every page.
- Prefer dense, readable tables for operational workflows.
- Use lucide icons consistently at restrained sizes.
- Keep radius mostly between 6px and 14px.
- Make mobile layouts explicit.

### Don't

- Don't copy Linear's near-black marketing site as the default app theme.
- Don't use purple/lavender as the brand accent.
- Don't make every card a floating decorative card.
- Don't use heavy gradients, oversized hero sections, or decorative blobs.
- Don't rely on inline styles for repeated components.
- Don't use old admin-template patterns like huge blue sidebars, heavy shadows, or crowded button bars.
- Don't add multiple competing accent colors.

## Implementation Notes

When updating the frontend:

1. Map these tokens into `frontend/app/globals.css`.
2. Update Clerk appearance colors to match teal/graphite.
3. Create or refine shared primitives before page rewrites: `PageHeader`, `MetricCard`, `DataPanel`, `DataTable`, `ToolbarSearch`, `EmptyState`.
4. Modernize `DashboardLayout`, `Sidebar`, and `Topbar` first.
5. Refactor pages in this order: dashboard, properties, property detail, rooms, invoices, tenants.
6. Preserve existing API/data logic while changing UI.
7. Verify desktop and mobile screenshots after each major page.

## Known Gaps

- This design system is tailored for the logged-in dashboard, not a marketing landing page.
- Public invoice pages may use a simpler, more receipt-like variant of the same tokens.
- Dark mode is not defined yet; the inverse sidebar is not a full dark theme.
- Chart color tokens should be added when real dashboard analytics are implemented.
