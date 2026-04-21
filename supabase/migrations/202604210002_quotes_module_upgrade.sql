-- 202604210002_quotes_module_upgrade.sql
-- Quotes module upgrade: richer quote metadata, comments, attachments, and conversion preferences.

alter table public.quotes
  add column if not exists reference_number text,
  add column if not exists salesperson text,
  add column if not exists project_name text,
  add column if not exists subject text,
  add column if not exists adjustment_total numeric(14,2) not null default 0,
  add column if not exists recipient_emails jsonb not null default '[]'::jsonb,
  add column if not exists billing_address_snapshot jsonb,
  add column if not exists shipping_address_snapshot jsonb,
  add column if not exists conversion_preferences jsonb not null default '{"carryCustomerNotes":true,"carryTermsAndConditions":true,"carryAddresses":true}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'quotes_recipient_emails_is_array'
      and conrelid = 'public.quotes'::regclass
  ) then
    alter table public.quotes
      add constraint quotes_recipient_emails_is_array
      check (jsonb_typeof(recipient_emails) = 'array');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'quotes_conversion_preferences_is_object'
      and conrelid = 'public.quotes'::regclass
  ) then
    alter table public.quotes
      add constraint quotes_conversion_preferences_is_object
      check (jsonb_typeof(conversion_preferences) = 'object');
  end if;
end $$;

update public.quotes
set
  recipient_emails = coalesce(recipient_emails, '[]'::jsonb),
  conversion_preferences = coalesce(
    conversion_preferences,
    '{"carryCustomerNotes":true,"carryTermsAndConditions":true,"carryAddresses":true}'::jsonb
  )
where true;

create table if not exists public.quote_comments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.quote_attachments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
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
  constraint quote_attachments_storage_path_pair_check check (
    (bucket_name is null and object_path is null)
    or (bucket_name is not null and object_path is not null)
  )
);

create or replace function app_private.validate_quote_comment_business_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_quote_business_id uuid;
begin
  select q.business_id
    into v_quote_business_id
  from public.quotes q
  where q.id = new.quote_id
    and q.deleted_at is null;

  if v_quote_business_id is null or v_quote_business_id <> new.business_id then
    raise exception 'Quote comment business mismatch.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_quote_comment_business_scope on public.quote_comments;
create trigger trg_validate_quote_comment_business_scope
before insert or update on public.quote_comments
for each row
execute function app_private.validate_quote_comment_business_scope();

create or replace function app_private.validate_quote_attachment_business_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_quote_business_id uuid;
begin
  select q.business_id
    into v_quote_business_id
  from public.quotes q
  where q.id = new.quote_id
    and q.deleted_at is null;

  if v_quote_business_id is null or v_quote_business_id <> new.business_id then
    raise exception 'Quote attachment business mismatch.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_quote_attachment_business_scope on public.quote_attachments;
create trigger trg_validate_quote_attachment_business_scope
before insert or update on public.quote_attachments
for each row
execute function app_private.validate_quote_attachment_business_scope();

drop trigger if exists trg_quote_comments_set_updated_at on public.quote_comments;
create trigger trg_quote_comments_set_updated_at
before update on public.quote_comments
for each row
execute function app_private.set_updated_at();

drop trigger if exists trg_quote_attachments_set_updated_at on public.quote_attachments;
create trigger trg_quote_attachments_set_updated_at
before update on public.quote_attachments
for each row
execute function app_private.set_updated_at();

drop trigger if exists trg_activity_quote_comments on public.quote_comments;
create trigger trg_activity_quote_comments
after insert or update on public.quote_comments
for each row
execute function app_private.log_activity();

drop trigger if exists trg_activity_quote_attachments on public.quote_attachments;
create trigger trg_activity_quote_attachments
after insert or update on public.quote_attachments
for each row
execute function app_private.log_activity();

create index if not exists ix_quotes_business_status_issue_date
  on public.quotes (business_id, status, issued_at)
  where deleted_at is null;

create index if not exists ix_quotes_business_client_issue_date
  on public.quotes (business_id, client_id, issued_at)
  where deleted_at is null;

create index if not exists ix_quote_comments_business_quote
  on public.quote_comments (business_id, quote_id, created_at desc)
  where deleted_at is null;

create index if not exists ix_quote_attachments_business_quote
  on public.quote_attachments (business_id, quote_id, created_at desc)
  where deleted_at is null;

alter table public.quote_comments enable row level security;
alter table public.quote_attachments enable row level security;

drop policy if exists quote_comments_select_member on public.quote_comments;
create policy quote_comments_select_member
  on public.quote_comments
  for select
  to authenticated
  using (app_private.is_business_member(business_id));

drop policy if exists quote_comments_insert_owner_admin on public.quote_comments;
create policy quote_comments_insert_owner_admin
  on public.quote_comments
  for insert
  to authenticated
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists quote_comments_update_owner_admin on public.quote_comments;
create policy quote_comments_update_owner_admin
  on public.quote_comments
  for update
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]))
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists quote_comments_delete_owner_admin on public.quote_comments;
create policy quote_comments_delete_owner_admin
  on public.quote_comments
  for delete
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists quote_attachments_select_member on public.quote_attachments;
create policy quote_attachments_select_member
  on public.quote_attachments
  for select
  to authenticated
  using (app_private.is_business_member(business_id));

drop policy if exists quote_attachments_insert_owner_admin on public.quote_attachments;
create policy quote_attachments_insert_owner_admin
  on public.quote_attachments
  for insert
  to authenticated
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists quote_attachments_update_owner_admin on public.quote_attachments;
create policy quote_attachments_update_owner_admin
  on public.quote_attachments
  for update
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]))
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists quote_attachments_delete_owner_admin on public.quote_attachments;
create policy quote_attachments_delete_owner_admin
  on public.quote_attachments
  for delete
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));
