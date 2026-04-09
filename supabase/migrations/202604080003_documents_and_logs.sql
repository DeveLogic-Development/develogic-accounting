-- 202604080003_documents_and_logs.sql
-- Quotes, invoices, payment, PDF archive, email logs, and activity logs.

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  client_contact_id uuid references public.client_contacts(id) on delete set null,
  quote_number text not null,
  status public.quote_status not null default 'draft',
  issued_at date,
  valid_until date,
  currency_code char(3) not null default 'ZAR',
  tax_mode public.tax_mode not null default 'exclusive',
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  discount_total numeric(14,2) not null default 0 check (discount_total >= 0),
  tax_total numeric(14,2) not null default 0 check (tax_total >= 0),
  total numeric(14,2) not null default 0 check (total >= 0),
  notes text,
  terms text,
  template_id uuid references public.document_templates(id) on delete set null,
  template_version_id uuid references public.template_versions(id) on delete set null,
  template_snapshot jsonb,
  last_pdf_archive_id uuid,
  sent_at timestamptz,
  viewed_at timestamptz,
  responded_at timestamptz,
  decline_reason text,
  converted_to_invoice_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint quotes_valid_date_check check (
    valid_until is null
    or issued_at is null
    or valid_until >= issued_at
  )
);

create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  line_order integer not null check (line_order > 0),
  product_service_id uuid references public.products_services(id) on delete set null,
  item_name text not null,
  item_description text,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  discount_percent numeric(5,2) not null default 0 check (discount_percent >= 0 and discount_percent <= 100),
  tax_rate numeric(5,2) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  line_subtotal numeric(14,2) not null default 0 check (line_subtotal >= 0),
  line_tax_amount numeric(14,2) not null default 0 check (line_tax_amount >= 0),
  line_total numeric(14,2) not null default 0 check (line_total >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  client_contact_id uuid references public.client_contacts(id) on delete set null,
  invoice_number text not null,
  status public.invoice_status not null default 'draft',
  issue_date date,
  due_date date,
  currency_code char(3) not null default 'ZAR',
  tax_mode public.tax_mode not null default 'exclusive',
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  discount_total numeric(14,2) not null default 0 check (discount_total >= 0),
  tax_total numeric(14,2) not null default 0 check (tax_total >= 0),
  total numeric(14,2) not null default 0 check (total >= 0),
  balance_due numeric(14,2) not null default 0 check (balance_due >= 0),
  notes text,
  terms text,
  source_quote_id uuid references public.quotes(id) on delete set null,
  template_id uuid references public.document_templates(id) on delete set null,
  template_version_id uuid references public.template_versions(id) on delete set null,
  template_snapshot jsonb,
  last_pdf_archive_id uuid,
  issued_at timestamptz,
  sent_at timestamptz,
  viewed_at timestamptz,
  paid_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint invoices_due_date_check check (
    due_date is null
    or issue_date is null
    or due_date >= issue_date
  ),
  constraint invoices_balance_total_check check (balance_due <= total)
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  line_order integer not null check (line_order > 0),
  product_service_id uuid references public.products_services(id) on delete set null,
  item_name text not null,
  item_description text,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  discount_percent numeric(5,2) not null default 0 check (discount_percent >= 0 and discount_percent <= 100),
  tax_rate numeric(5,2) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  line_subtotal numeric(14,2) not null default 0 check (line_subtotal >= 0),
  line_tax_amount numeric(14,2) not null default 0 check (line_tax_amount >= 0),
  line_total numeric(14,2) not null default 0 check (line_total >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  payment_reference text,
  payment_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  method public.payment_method not null default 'bank_transfer',
  status public.payment_status not null default 'completed',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.pdf_archives (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  document_kind public.document_kind not null,
  document_id uuid not null,
  document_number text,
  template_version_id uuid references public.template_versions(id) on delete set null,
  template_snapshot jsonb not null default '{}'::jsonb,
  payload_snapshot jsonb not null default '{}'::jsonb,
  bucket_name text not null default 'document-files',
  object_path text not null,
  file_name text,
  file_size_bytes bigint,
  sha256_checksum text,
  generation_context text not null default 'send' check (generation_context in ('preview', 'send', 'manual', 'system')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  document_kind public.document_kind,
  document_id uuid,
  pdf_archive_id uuid references public.pdf_archives(id) on delete set null,
  recipient_email text not null,
  cc_emails jsonb not null default '[]'::jsonb,
  bcc_emails jsonb not null default '[]'::jsonb,
  attachment_objects jsonb not null default '[]'::jsonb,
  subject text not null,
  body_preview text,
  provider text not null default 'smtp',
  status public.email_status not null default 'queued',
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint email_logs_document_pair_check check (
    (document_kind is null and document_id is null)
    or (document_kind is not null and document_id is not null)
  ),
  constraint email_logs_cc_is_array check (jsonb_typeof(cc_emails) = 'array'),
  constraint email_logs_bcc_is_array check (jsonb_typeof(bcc_emails) = 'array'),
  constraint email_logs_attachments_is_array check (jsonb_typeof(attachment_objects) = 'array')
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action public.activity_action not null,
  entity_table text not null,
  entity_id uuid,
  entity_label text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Deferred/cyclic relations.
alter table public.quotes
  add constraint quotes_converted_to_invoice_fk
  foreign key (converted_to_invoice_id)
  references public.invoices(id)
  on delete set null;

alter table public.quotes
  add constraint quotes_last_pdf_archive_fk
  foreign key (last_pdf_archive_id)
  references public.pdf_archives(id)
  on delete set null;

alter table public.invoices
  add constraint invoices_last_pdf_archive_fk
  foreign key (last_pdf_archive_id)
  references public.pdf_archives(id)
  on delete set null;

alter table public.businesses
  add column if not exists logo_asset_id uuid;

alter table public.businesses
  add constraint businesses_logo_asset_fk
  foreign key (logo_asset_id)
  references public.logo_assets(id)
  on delete set null;
