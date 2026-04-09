# Manual QA Checklist

## Environment and capability
- [ ] App loads with minimal env configured (`.env.example` baseline).
- [ ] Dashboard shows configuration/capability notices when integrations are incomplete.
- [ ] Email send buttons are disabled with clear messaging when capability is unavailable.

## Quotes and invoices
- [ ] Draft quote can be edited; non-draft edit is blocked.
- [ ] Accepted quote converts to invoice correctly.
- [ ] Draft invoice can be edited; void invoice payment is blocked.
- [ ] Partial and full payment transitions invoice status correctly.
- [ ] Overdue status reflects due-date + outstanding logic.

## Templates
- [ ] Template create/edit/publish still works.
- [ ] Invalid template config is blocked by validation.
- [ ] Quote/invoice forms show template selection and preserve version references.

## PDF pipeline
- [ ] Draft PDF generation works for draft docs.
- [ ] Historical archive generation creates immutable records.
- [ ] PDF archive list/filter/sort works.
- [ ] Detail pages open/download latest PDF successfully.

## Email delivery
- [ ] Compose modal pre-fills recipient/subject/body.
- [ ] Sending uses archived attachment and logs attempt/result.
- [ ] Failed sends surface clear errors and do not falsely update document status.
- [ ] Successful quote send updates quote status to sent when applicable.
- [ ] Successful invoice send updates invoice status according to workflow rules.
- [ ] Resend creates a new log entry and preserves resend linkage.

## Dashboard and reports
- [ ] KPI cards render correctly with sparse data.
- [ ] Trends display without layout breakage on mobile/desktop.
- [ ] Reports date presets/custom range behave correctly.
- [ ] Aging, conversion, sales, payments, email, and PDF summaries are internally consistent.

## Filtering/search
- [ ] Quotes, invoices, clients, products, email history, and PDF archive filters are functional.
- [ ] Combined filters produce expected subsets.
- [ ] Empty-state messaging is clear for no-match filter results.

## Error and resilience
- [ ] Network/server failures return user-facing safe errors.
- [ ] No unhandled crashes during send/generate/filter operations.
- [ ] Critical actions show proper disabled/loading states.
