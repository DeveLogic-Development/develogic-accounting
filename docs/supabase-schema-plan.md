# DeveLogic Accounting - Supabase Schema Plan

## ERD Summary

### Identity and tenancy
- `profiles` (1:1 with `auth.users`)
- `businesses` (tenant root; includes business profile fields)
- `business_users` (membership + role, future multi-user ready)

### Master data
- `clients` (business customers)
- `client_contacts` (contacts per client)
- `products_services` (catalog)
- `tax_settings` (rates + default)
- `numbering_sequences` (quote/invoice numbering engine)

### Templates and branding
- `document_templates` (quote/invoice template container)
- `template_versions` (immutable-style version rows)
- `logo_assets` (storage metadata)

### Commercial documents
- `quotes` + `quote_items`
- `invoices` + `invoice_items`
- `payments`

### Delivery, archives, and audit
- `pdf_archives` (PDF metadata + template/payload snapshot)
- `email_logs` (email status + recipients + attachment object references)
- `activity_logs` (append-only audit/events)

### Key relationships
- `quotes.converted_to_invoice_id -> invoices.id`
- `invoices.source_quote_id -> quotes.id`
- `quotes.last_pdf_archive_id / invoices.last_pdf_archive_id -> pdf_archives.id`
- `quotes.template_version_id / invoices.template_version_id -> template_versions.id`

## Storage bucket plan
- `branding-assets` (private): logos and brand assets
- `document-files` (private): generated PDFs
- `email-attachments` (private): optional outbound attachment files

Object key convention: `{business_id}/{entity}/{file}`.

## Migration order
1. `202604080001_init_extensions_enums.sql`
2. `202604080002_core_tables.sql`
3. `202604080003_documents_and_logs.sql`
4. `202604080004_constraints_indexes_triggers.sql`
5. `202604080005_rls_policies.sql`
6. `202604080006_storage_buckets_and_policies.sql`
7. `202604080007_seed_defaults.sql`

## Trigger strategy
- `updated_at` triggers on mutable tables.
- Audit triggers (`activity_logs`) on core mutable entities.
- Integrity triggers for business-scope consistency across tenant-bound FKs.
- Business creation trigger:
  - auto-creates owner membership row
  - seeds default tax/numbering/template setup

## Seed strategy
- `public.seed_business_defaults(business_id, actor)` function seeds:
  - default VAT rows
  - quote/invoice numbering sequences
  - default quote + invoice templates and version 1
- Triggered automatically on new business creation.
- Includes optional backfill block for already existing businesses.
