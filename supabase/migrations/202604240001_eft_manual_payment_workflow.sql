-- 202604240001_eft_manual_payment_workflow.sql
-- Adds EFT settings, invoice public payment metadata, and payment proof submission workflow tables.

alter table public.businesses
  add column if not exists eft_enabled boolean not null default true,
  add column if not exists eft_bank_name text,
  add column if not exists eft_account_holder text,
  add column if not exists eft_account_number text,
  add column if not exists eft_branch_code text,
  add column if not exists eft_account_type text,
  add column if not exists eft_swift_bic text,
  add column if not exists eft_reference_instruction text,
  add column if not exists eft_instruction_notes text,
  add column if not exists eft_proof_allowed_mime_types jsonb not null default '["application/pdf","image/jpeg","image/png"]'::jsonb,
  add column if not exists eft_proof_max_file_size_bytes bigint not null default 10485760,
  add column if not exists eft_public_submission_enabled boolean not null default true,
  add column if not exists eft_include_public_submission_link_in_email boolean not null default true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'businesses_eft_proof_mime_types_is_array'
      and conrelid = 'public.businesses'::regclass
  ) then
    alter table public.businesses
      add constraint businesses_eft_proof_mime_types_is_array
      check (jsonb_typeof(eft_proof_allowed_mime_types) = 'array');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'businesses_eft_max_file_size_positive'
      and conrelid = 'public.businesses'::regclass
  ) then
    alter table public.businesses
      add constraint businesses_eft_max_file_size_positive
      check (eft_proof_max_file_size_bytes > 0);
  end if;
end $$;

alter table public.invoices
  add column if not exists eft_payment_reference text,
  add column if not exists public_payment_token text,
  add column if not exists public_payment_enabled boolean not null default true;

update public.invoices
set
  eft_payment_reference = coalesce(nullif(trim(eft_payment_reference), ''), invoice_number),
  public_payment_enabled = coalesce(public_payment_enabled, true)
where true;

create index if not exists ix_invoices_public_payment_token
  on public.invoices (public_payment_token)
  where public_payment_token is not null and deleted_at is null;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'invoice_payment_submission_status') then
    create type public.invoice_payment_submission_status as enum (
      'submitted',
      'under_review',
      'approved',
      'rejected',
      'cancelled'
    );
  end if;
end $$;

create table if not exists public.invoice_payment_submissions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  public_token text not null,
  status public.invoice_payment_submission_status not null default 'submitted',
  payer_name text,
  payer_email text,
  submitted_amount numeric(14,2) not null check (submitted_amount > 0),
  submitted_payment_date date not null,
  submitted_reference text,
  note text,
  proof_file_name text not null,
  proof_file_mime_type text not null,
  proof_file_size_bytes bigint not null check (proof_file_size_bytes > 0),
  proof_file_bucket text,
  proof_file_object_path text,
  proof_file_inline_data_url text,
  review_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  approved_payment_id uuid unique references public.payments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint invoice_payment_submissions_storage_path_pair_check check (
    (proof_file_bucket is null and proof_file_object_path is null)
    or (proof_file_bucket is not null and proof_file_object_path is not null)
  )
);

create or replace function app_private.validate_invoice_payment_submission_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_invoice public.invoices%rowtype;
begin
  select *
    into v_invoice
  from public.invoices i
  where i.id = new.invoice_id
    and i.deleted_at is null;

  if v_invoice.id is null then
    raise exception 'Invoice not found for payment submission.';
  end if;

  if new.business_id is null then
    new.business_id := v_invoice.business_id;
  end if;
  if new.client_id is null then
    new.client_id := v_invoice.client_id;
  end if;

  if new.business_id <> v_invoice.business_id then
    raise exception 'Payment submission business mismatch with invoice.';
  end if;
  if new.client_id <> v_invoice.client_id then
    raise exception 'Payment submission client mismatch with invoice.';
  end if;
  if coalesce(v_invoice.public_payment_enabled, true) = false then
    raise exception 'Public payment submissions are disabled for this invoice.';
  end if;
  if coalesce(v_invoice.public_payment_token, '') = '' then
    raise exception 'Invoice has no active public payment token.';
  end if;
  if new.public_token <> v_invoice.public_payment_token then
    raise exception 'Invalid invoice payment submission token.';
  end if;
  if v_invoice.status = 'void' then
    raise exception 'Voided invoices cannot accept payment submissions.';
  end if;

  if new.status = 'approved' and new.reviewed_at is null then
    new.reviewed_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_invoice_payment_submission_scope on public.invoice_payment_submissions;
create trigger trg_validate_invoice_payment_submission_scope
before insert or update on public.invoice_payment_submissions
for each row
execute function app_private.validate_invoice_payment_submission_scope();

drop trigger if exists trg_invoice_payment_submissions_set_updated_at on public.invoice_payment_submissions;
create trigger trg_invoice_payment_submissions_set_updated_at
before update on public.invoice_payment_submissions
for each row
execute function app_private.set_updated_at();

drop trigger if exists trg_activity_invoice_payment_submissions on public.invoice_payment_submissions;
create trigger trg_activity_invoice_payment_submissions
after insert or update on public.invoice_payment_submissions
for each row
execute function app_private.log_activity();

create index if not exists ix_invoice_payment_submissions_business_status
  on public.invoice_payment_submissions (business_id, status, created_at desc)
  where deleted_at is null;

create index if not exists ix_invoice_payment_submissions_invoice_created_at
  on public.invoice_payment_submissions (invoice_id, created_at desc)
  where deleted_at is null;

create index if not exists ix_invoice_payment_submissions_public_token
  on public.invoice_payment_submissions (public_token, created_at desc)
  where deleted_at is null;

alter table public.invoice_payment_submissions enable row level security;

drop policy if exists invoice_payment_submissions_select_member on public.invoice_payment_submissions;
create policy invoice_payment_submissions_select_member
  on public.invoice_payment_submissions
  for select
  to authenticated
  using (app_private.is_business_member(business_id));

drop policy if exists invoice_payment_submissions_insert_owner_admin on public.invoice_payment_submissions;
create policy invoice_payment_submissions_insert_owner_admin
  on public.invoice_payment_submissions
  for insert
  to authenticated
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists invoice_payment_submissions_insert_public_token on public.invoice_payment_submissions;
create policy invoice_payment_submissions_insert_public_token
  on public.invoice_payment_submissions
  for insert
  to anon
  with check (
    status = 'submitted'
    and reviewed_by is null
    and reviewed_at is null
    and approved_payment_id is null
    and exists (
      select 1
      from public.invoices i
      where i.id = invoice_id
        and i.deleted_at is null
        and i.status <> 'void'
        and coalesce(i.public_payment_enabled, true) = true
        and i.public_payment_token = public_token
    )
  );

drop policy if exists invoice_payment_submissions_update_owner_admin on public.invoice_payment_submissions;
create policy invoice_payment_submissions_update_owner_admin
  on public.invoice_payment_submissions
  for update
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]))
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists invoice_payment_submissions_delete_owner_admin on public.invoice_payment_submissions;
create policy invoice_payment_submissions_delete_owner_admin
  on public.invoice_payment_submissions
  for delete
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));
