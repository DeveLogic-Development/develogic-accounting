# DeveLogic Accounting UX/UI System

## UX Rationale
DeveLogic Accounting should feel authoritative, calm, and efficient. The interface balances high-density accounting workflows with clean visual hierarchy so users can process financial state quickly without feeling overwhelmed.

The product direction combines:
- QuickBooks and Xero clarity for KPI-led dashboards and obvious status hierarchy.
- Zoho Books density for practical table workflows and quick actions.
- Sage-style branding controls for polished documents.
- Odoo-like template workflow for reusable quote/invoice composition.

Core UX principles:
- Make financial status obvious in under 2 seconds.
- Keep high-frequency actions reachable with one tap on mobile and one click on desktop.
- Preserve context: users should edit, preview, send, and audit documents without losing state.
- Prefer predictable, low-surprise interactions for trust-heavy accounting tasks.

## Design Tokens

### 1) Color System
Use neutral-forward surfaces with restrained brand accents.

```css
:root {
  /* Brand */
  --color-brand-900: #0B2A4A;
  --color-brand-700: #174B7A;
  --color-brand-500: #2A6FA8;
  --color-brand-100: #E8F1F8;

  /* Accent */
  --color-accent-700: #0E6B4F;
  --color-accent-500: #1C8C66;
  --color-accent-100: #E7F6F1;

  /* Neutrals */
  --color-slate-950: #111827;
  --color-slate-900: #1F2937;
  --color-slate-700: #374151;
  --color-slate-500: #6B7280;
  --color-slate-300: #D1D5DB;
  --color-slate-200: #E5E7EB;
  --color-slate-100: #F3F4F6;
  --color-slate-50: #F8FAFC;
  --color-white: #FFFFFF;

  /* Feedback */
  --color-success-700: #0F766E;
  --color-success-100: #DCFCE7;
  --color-warning-700: #B45309;
  --color-warning-100: #FEF3C7;
  --color-danger-700: #B91C1C;
  --color-danger-100: #FEE2E2;
  --color-info-700: #1D4ED8;
  --color-info-100: #DBEAFE;

  /* Semantic */
  --bg-app: var(--color-slate-50);
  --bg-surface: var(--color-white);
  --bg-surface-muted: #F9FAFB;
  --text-primary: var(--color-slate-950);
  --text-secondary: var(--color-slate-700);
  --text-muted: var(--color-slate-500);
  --border-default: var(--color-slate-200);
  --border-strong: var(--color-slate-300);
  --focus-ring: #2563EB;
}
```

### 2) Spacing Scale
```css
:root {
  --space-0: 0;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
}
```

### 3) Typography Scale
Typeface stack:
- Headings/UI emphasis: `Manrope`
- Body/forms/tables: `IBM Plex Sans`
- Numeric/monospace metadata: `JetBrains Mono`

```css
:root {
  --font-heading: 'Manrope', system-ui, sans-serif;
  --font-body: 'IBM Plex Sans', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;

  --text-xs: 12px;
  --text-sm: 14px;
  --text-md: 16px;
  --text-lg: 18px;
  --text-xl: 20px;
  --text-2xl: 24px;
  --text-3xl: 30px;

  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.65;
}
```

### 4) Shape, Elevation, Motion
```css
:root {
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;

  --shadow-sm: 0 1px 2px rgba(16, 24, 40, 0.06);
  --shadow-md: 0 8px 24px rgba(16, 24, 40, 0.08);
  --shadow-lg: 0 16px 40px rgba(16, 24, 40, 0.12);

  --motion-fast: 140ms;
  --motion-base: 220ms;
  --ease-standard: cubic-bezier(0.2, 0.8, 0.2, 1);
}
```

## Component Patterns

### 1) Card Patterns
- KPI card: metric value, delta, trend sparkline, last-updated timestamp.
- Entity summary card: title, status chip, key amounts, quick actions.
- Action card: icon, short guidance, primary CTA for empty/onboarding moments.
- Card header always supports `title + subtitle + right-side action`.

### 2) Table Patterns
- Desktop: sticky header, optional sticky first column, compact row mode toggle.
- First row action cluster: `Search`, `Filters`, `Status`, `Date range`, `Export`.
- Row quick actions: `View`, `Edit`, `Duplicate`, `Send`, `More`.
- Bulk actions appear in contextual top bar after row selection.
- Responsive conversion:
- Below `md`: each row becomes a stacked card with status, amount, due date, and primary action button.
- Keep filter/sort controls available in a collapsible top sheet.

### 3) Form Patterns
- 8px baseline grid, label above input, helper text below.
- Validation state colors use semantic tokens, not hardcoded colors.
- Autosave indicator for long forms (`Saving`, `Saved`, `Unsaved changes`).
- Financial inputs include formatted preview (currency, tax percent).
- Primary submit pinned in sticky mobile action bar.

### 4) Status Badge Patterns
Quote statuses:
- `Draft` neutral
- `Sent` info
- `Viewed` info-muted
- `Accepted` success
- `Declined` danger
- `Expired` warning
- `Converted` accent

Invoice statuses:
- `Draft` neutral
- `Issued` info
- `Sent` info-muted
- `Viewed` brand
- `Partially Paid` warning
- `Paid` success
- `Overdue` danger
- `Void` neutral-muted

Badge rules:
- Include icon + text.
- Minimum contrast 4.5:1.
- Keep fixed height and horizontal padding for scan consistency.

### 5) Empty State Patterns
- Always include: contextual title, one-sentence explanation, primary CTA, optional secondary CTA.
- Provide guided defaults where useful:
- “Create first quote from template.”
- “Add your first tax rule.”
- “Upload logo to brand documents.”

## Navigation and Layout Behavior

### 1) Mobile Nav Behavior
- Bottom tab nav for top-level destinations: `Dashboard`, `Clients`, `Quotes`, `Invoices`, `More`.
- Global create action via floating or centered `+` action opening bottom sheet.
- Sticky action bar on edit/create screens with `Save Draft`, `Preview`, `Send` or `Convert`.
- Secondary filters in slide-up sheet to keep list screen clean.

### 2) Desktop Sidebar Behavior
- Left sidebar fixed with grouped navigation:
- Core: Dashboard, Clients, Products/Services, Quotes, Invoices.
- Documents: Templates, PDF Archive, Email History.
- Administration: Business Settings, Tax/Settings, Activity.
- Sidebar supports collapsed icon-only mode and remembers preference.
- Contextual page actions live in top app bar.

## Document Builder UI Patterns
Template editor should use a three-panel layout on desktop:
- Left panel: block library, saved snippets, field toggles.
- Center canvas: live page preview with page-size switch (A4/Letter).
- Right panel: selected block properties, style controls, conditional visibility rules.

Required builder capabilities:
- Version save and publish workflow.
- Logo upload and placement controls.
- Token insertion for dynamic fields (`{{client.name}}`, `{{invoice.number}}`, etc.).
- Reusable header/footer blocks.
- Mobile mode switches to step-based editing with full-screen preview modal.

## Screen Breakdown

### Dashboard
- KPI strip: `Total Outstanding`, `Overdue Invoices`, `Draft Quotes`, `Accepted Quotes Awaiting Conversion`.
- Main graph: monthly invoiced totals (12-month toggle).
- Secondary panels: recent activity feed, overdue list, quick-create actions.

### Clients List + Detail
- List: search, tags/status, outstanding balance column, last activity, quick create quote/invoice.
- Detail: profile, contacts, document history, total billed, total outstanding.

### Products/Services List + Detail
- List: type filters, active/inactive switch, price/tax columns, usage count.
- Detail: pricing, tax defaults, linked quote/invoice usage timeline.

### Quotes List + Detail
- List: status tabs, date filters, client filters, total value, expiry indicators.
- Detail: quote timeline, preview panel, send history, convert-to-invoice CTA.

### Create/Edit Quote
- Split layout: editable line items + sticky financial summary.
- Smart helpers: add from products, reorder lines, apply discounts/tax mode.
- Sticky mobile action bar: `Save Draft`, `Preview PDF`, `Send Quote`.

### Invoices List + Detail
- List: aging buckets, overdue emphasis, payment status chips.
- Detail: payment timeline, balance due, send events, downloadable PDFs.

### Create/Edit Invoice
- Similar interaction model to quote editor.
- Additional payment terms, due-date helpers, partial payment visibility.
- Sticky mobile action bar: `Save Draft`, `Preview PDF`, `Send Invoice`.

### Template Library
- Card/grid view with template type, status, last updated, default marker.
- Quick actions: preview, duplicate, edit, publish/archive.

### Template Editor
- Three-panel document builder.
- Device/page-size preview toggle.
- Version management panel with publish notes.

### Business Settings
- Business identity, legal details, default currency/timezone, logo management.
- Email sender settings and signature branding.

### Tax/Settings
- Tax table editor with default tax lock, activation toggle, and rate validation.
- Numbering sequence controls for quotes/invoices with prefix/suffix and reset period.

### Email History
- Sent/failed/bounced filters, recipient search, resend action.
- Detail drawer with payload summary and attachment list.

### PDF Archive Viewer
- Search by document number/client/date.
- Right-side preview pane with metadata: template version, checksum, generated timestamp.

## Responsive Behavior Notes
- Breakpoints: `sm 640`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1536`.
- Tables convert to cards below `md`, preserving status and primary action prominence.
- Primary actions remain visible through sticky bars on mobile forms and detail screens.
- Filters collapse into sheets/drawers on mobile and remain inline on desktop.
- Chart cards use horizontal scroll fallback below `sm` when dense.

## Suggested Implementation Structure

```txt
src/
  design-system/
    tokens/
      colors.css
      spacing.css
      typography.css
      elevation.css
      motion.css
    primitives/
      Button.tsx
      Input.tsx
      Select.tsx
      Badge.tsx
      Card.tsx
      Table.tsx
      Tabs.tsx
      Drawer.tsx
      Sheet.tsx
    patterns/
      AppShell.tsx
      DataTable.tsx
      MobileEntityCard.tsx
      FilterBar.tsx
      StickyActionBar.tsx
      StatusBadge.tsx
      EmptyState.tsx
      KPIStatCard.tsx
      ActivityFeed.tsx
      DocumentLineEditor.tsx
      DocumentSummaryPanel.tsx
      TemplateBuilderLayout.tsx
  modules/
    dashboard/
    clients/
    products/
    quotes/
    invoices/
    templates/
    settings/
    email-history/
    pdf-archive/
```

## Component List (Build Priority)
1. App shell: sidebar, top bar, mobile nav, sticky action bar.
2. Data display: KPI card, data table, responsive entity card, status badges.
3. Forms: inputs, currency fields, tax selectors, validation messaging.
4. Document editing: line editor, totals summary, preview panel.
5. Template tools: block palette, properties panel, publish/version controls.
6. Utility: filter bar, empty states, activity timeline, toast system.
