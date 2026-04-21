-- 202604200002_customer_workspace_upgrade.sql
-- Customer workspace upgrade: richer customer profile fields, structured contact data,
-- and customer comments for detail-workspace collaboration.

alter table public.clients
  add column if not exists salutation text,
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists company_name text,
  add column if not exists work_phone_country_code text,
  add column if not exists work_phone_number text,
  add column if not exists mobile_phone_country_code text,
  add column if not exists mobile_phone_number text,
  add column if not exists customer_language text,
  add column if not exists currency_code char(3),
  add column if not exists accounts_receivable_account_id uuid,
  add column if not exists opening_balance numeric(14,2) not null default 0 check (opening_balance >= 0),
  add column if not exists payment_terms_label text,
  add column if not exists portal_enabled boolean not null default false,
  add column if not exists website_url text,
  add column if not exists department text,
  add column if not exists designation text,
  add column if not exists x_handle_or_url text,
  add column if not exists skype text,
  add column if not exists facebook text,
  add column if not exists remarks text,
  add column if not exists customer_owner_user_id uuid references auth.users(id) on delete set null,
  add column if not exists unused_credits numeric(14,2) not null default 0 check (unused_credits >= 0),
  add column if not exists custom_fields_json jsonb not null default '{}'::jsonb,
  add column if not exists reporting_tags_json jsonb not null default '[]'::jsonb,
  add column if not exists billing_attention text,
  add column if not exists billing_country_region text,
  add column if not exists billing_phone_country_code text,
  add column if not exists billing_phone_number text,
  add column if not exists billing_fax text,
  add column if not exists shipping_attention text,
  add column if not exists shipping_country_region text,
  add column if not exists shipping_phone_country_code text,
  add column if not exists shipping_phone_number text,
  add column if not exists shipping_fax text;

alter table public.clients
  alter column client_type set default 'business';

-- Backfill/normalize richer customer fields from existing baseline columns.
update public.clients
set
  company_name = coalesce(company_name, legal_name, display_name),
  currency_code = coalesce(currency_code, 'ZAR'),
  payment_terms_label = coalesce(payment_terms_label, case when payment_terms_days = 0 then 'Due on Receipt' else payment_terms_days::text || ' Days' end),
  billing_country_region = coalesce(billing_country_region, billing_country_code),
  shipping_country_region = coalesce(shipping_country_region, shipping_country_code)
where true;

alter table public.client_contacts
  add column if not exists salutation text,
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists work_phone_country_code text,
  add column if not exists work_phone_number text,
  add column if not exists mobile_phone_country_code text,
  add column if not exists mobile_phone_number text;

update public.client_contacts
set
  first_name = coalesce(first_name, split_part(full_name, ' ', 1)),
  last_name = coalesce(last_name, nullif(regexp_replace(full_name, '^\S+\s*', ''), '')),
  work_phone_number = coalesce(work_phone_number, phone)
where true;

create table if not exists public.customer_comments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.clients(id) on delete cascade,
  body text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists ix_customer_comments_customer_created
  on public.customer_comments (customer_id, created_at desc)
  where deleted_at is null;

create index if not exists ix_customer_comments_business_created
  on public.customer_comments (business_id, created_at desc)
  where deleted_at is null;

drop trigger if exists trg_customer_comments_set_updated_at on public.customer_comments;
create trigger trg_customer_comments_set_updated_at
before update on public.customer_comments
for each row
execute function app_private.set_updated_at();

drop trigger if exists trg_activity_customer_comments on public.customer_comments;
create trigger trg_activity_customer_comments
after insert or update on public.customer_comments
for each row
execute function app_private.log_activity();

alter table public.customer_comments enable row level security;

drop policy if exists customer_comments_select_member on public.customer_comments;
create policy customer_comments_select_member
  on public.customer_comments
  for select
  to authenticated
  using (app_private.is_business_member(business_id));

drop policy if exists customer_comments_insert_owner_admin on public.customer_comments;
create policy customer_comments_insert_owner_admin
  on public.customer_comments
  for insert
  to authenticated
  with check (app_private.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.user_role[]));

drop policy if exists customer_comments_update_owner_admin on public.customer_comments;
create policy customer_comments_update_owner_admin
  on public.customer_comments
  for update
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.user_role[]))
  with check (app_private.has_business_role(business_id, array['owner', 'admin', 'accountant']::public.user_role[]));

drop policy if exists customer_comments_delete_owner_admin on public.customer_comments;
create policy customer_comments_delete_owner_admin
  on public.customer_comments
  for delete
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));
