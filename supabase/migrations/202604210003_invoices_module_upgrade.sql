-- 202604210003_invoices_module_upgrade.sql
-- Invoices module upgrade: richer invoice metadata and attachment support.

alter table public.invoices
  add column if not exists order_number text,
  add column if not exists accounts_receivable_account_id text,
  add column if not exists salesperson text,
  add column if not exists subject text,
  add column if not exists payment_terms text,
  add column if not exists internal_memo text,
  add column if not exists adjustment_total numeric(14,2) not null default 0,
  add column if not exists recipient_emails jsonb not null default '[]'::jsonb,
  add column if not exists billing_address_snapshot jsonb,
  add column if not exists shipping_address_snapshot jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'invoices_recipient_emails_is_array'
      and conrelid = 'public.invoices'::regclass
  ) then
    alter table public.invoices
      add constraint invoices_recipient_emails_is_array
      check (jsonb_typeof(recipient_emails) = 'array');
  end if;
end $$;

update public.invoices
set
  recipient_emails = coalesce(recipient_emails, '[]'::jsonb),
  payment_terms = coalesce(payment_terms, terms)
where true;

create table if not exists public.invoice_attachments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  bucket_name text,
  object_path text,
  inline_data_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint invoice_attachments_storage_path_pair_check check (
    (bucket_name is null and object_path is null)
    or (bucket_name is not null and object_path is not null)
  )
);

create or replace function app_private.validate_invoice_attachment_business_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_invoice_business_id uuid;
begin
  select i.business_id
    into v_invoice_business_id
  from public.invoices i
  where i.id = new.invoice_id
    and i.deleted_at is null;

  if v_invoice_business_id is null or v_invoice_business_id <> new.business_id then
    raise exception 'Invoice attachment business mismatch.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_invoice_attachment_business_scope on public.invoice_attachments;
create trigger trg_validate_invoice_attachment_business_scope
before insert or update on public.invoice_attachments
for each row
execute function app_private.validate_invoice_attachment_business_scope();

drop trigger if exists trg_invoice_attachments_set_updated_at on public.invoice_attachments;
create trigger trg_invoice_attachments_set_updated_at
before update on public.invoice_attachments
for each row
execute function app_private.set_updated_at();

drop trigger if exists trg_activity_invoice_attachments on public.invoice_attachments;
create trigger trg_activity_invoice_attachments
after insert or update on public.invoice_attachments
for each row
execute function app_private.log_activity();

create index if not exists ix_invoices_business_status_due_date
  on public.invoices (business_id, status, due_date)
  where deleted_at is null;

create index if not exists ix_invoices_business_client_issue_date
  on public.invoices (business_id, client_id, issue_date)
  where deleted_at is null;

create index if not exists ix_invoice_attachments_business_invoice
  on public.invoice_attachments (business_id, invoice_id, created_at desc)
  where deleted_at is null;

alter table public.invoice_attachments enable row level security;

drop policy if exists invoice_attachments_select_member on public.invoice_attachments;
create policy invoice_attachments_select_member
  on public.invoice_attachments
  for select
  to authenticated
  using (app_private.is_business_member(business_id));

drop policy if exists invoice_attachments_insert_owner_admin on public.invoice_attachments;
create policy invoice_attachments_insert_owner_admin
  on public.invoice_attachments
  for insert
  to authenticated
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists invoice_attachments_update_owner_admin on public.invoice_attachments;
create policy invoice_attachments_update_owner_admin
  on public.invoice_attachments
  for update
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]))
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists invoice_attachments_delete_owner_admin on public.invoice_attachments;
create policy invoice_attachments_delete_owner_admin
  on public.invoice_attachments
  for delete
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));
