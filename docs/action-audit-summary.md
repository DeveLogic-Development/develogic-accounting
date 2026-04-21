# Button and Action Audit Summary

## Scope
- App shell navigation and top bar actions
- Dashboard links and quick actions
- Clients and products/services modules
- Quotes and invoices list/form/detail actions
- Template library and editor actions
- PDF archive actions
- Email history actions
- Settings and tax/numbering screens
- Modal and sticky action bars

## Broken or misleading actions found
- Top bar `Notifications` icon looked active but had no handler.
- Clients module: `Import CSV`, `Create Client`, `Export`, and empty-state `Create Client` had no handlers.
- Client detail: `Edit Client` and `New Quote` had no handlers.
- Products/services module: `Bulk Update`, `Create Item`, and empty-state `Create Item` had no handlers.
- Product/service detail: `Duplicate` and `Edit Item` had no handlers.
- Business settings: `Save Changes` and `Upload Logo` looked active but were not wired.
- Tax settings: `Save Configuration` and `+ Add Tax Rule` looked active but were not wired.
- Line item editor `Up/Down` actions were clickable even when no movement was possible.
- Quote/Invoice status actions used browser `window.prompt` flows for notes.

## Fixed actions
- Top bar `Refresh` now performs a full app refresh.
- Client detail `New Quote` now routes to `/quotes/new?clientId=...`.
- Quote form now pre-fills `clientId` from query param when present.
- Line item `Up/Down` buttons are now correctly disabled at list boundaries with clear titles.
- Quote and invoice transition actions no longer rely on browser prompt dialogs.
- Email-related disabled actions now expose explicit disabled reasons via title text.

## Intentionally disabled actions (with reason in UI)
- Client create/import/export flows
- Product/service create/bulk update/edit/duplicate flows
- Business settings save/upload/logo editing flows
- Tax and numbering save/add/edit flows

All of the above are now visibly disabled and paired with inline informational notices explaining that persistence/editing for these areas is not enabled in this build.

## UX improvements applied during action pass
- Added clear disabled visual state for all buttons/icon buttons.
- Added explicit inline notices in read-only sections to avoid dead-button confusion.
- Standardized unavailable-action messaging to remove ambiguity.
- Improved action intent on client detail by wiring a real next-step path (`New Quote`).
