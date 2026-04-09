-- 202604080004_constraints_indexes_triggers.sql
-- Constraints, indexes, trigger functions, updated_at hooks, and audit logging.

create or replace function app_private.has_business_role(
  p_business_id uuid,
  p_roles public.user_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_users bu
    where bu.business_id = p_business_id
      and bu.user_id = auth.uid()
      and bu.is_active = true
      and bu.deleted_at is null
      and bu.role = any(p_roles)
  );
$$;

create or replace function app_private.is_business_member(
  p_business_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select app_private.has_business_role(
    p_business_id,
    array['owner', 'admin', 'accountant', 'viewer']::public.user_role[]
  );
$$;

create or replace function public.next_document_number(
  p_business_id uuid,
  p_sequence_type public.sequence_type
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq public.numbering_sequences%rowtype;
  v_current_number bigint;
  v_now date := current_date;
  v_can_issue boolean;
begin
  v_can_issue := app_private.has_business_role(
    p_business_id,
    array['owner', 'admin']::public.user_role[]
  );

  if not coalesce(v_can_issue, false) then
    raise exception 'Not authorized to issue document numbers for this business.';
  end if;

  select *
  into v_seq
  from public.numbering_sequences
  where business_id = p_business_id
    and sequence_type = p_sequence_type
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Numbering sequence not configured for business % and type %', p_business_id, p_sequence_type;
  end if;

  if v_seq.reset_period = 'yearly'
     and (v_seq.last_reset_at is null or date_trunc('year', v_seq.last_reset_at) < date_trunc('year', v_now)) then
    v_current_number := 1;
  elsif v_seq.reset_period = 'monthly'
     and (v_seq.last_reset_at is null or date_trunc('month', v_seq.last_reset_at) < date_trunc('month', v_now)) then
    v_current_number := 1;
  else
    v_current_number := v_seq.next_number;
  end if;

  update public.numbering_sequences
  set next_number = v_current_number + 1,
      last_reset_at = v_now,
      updated_at = now()
  where id = v_seq.id;

  return v_seq.prefix || lpad(v_current_number::text, v_seq.padding, '0') || v_seq.suffix;
end;
$$;

grant execute on function public.next_document_number(uuid, public.sequence_type) to authenticated;

create or replace function app_private.handle_business_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is not null then
    insert into public.business_users (
      business_id,
      user_id,
      role,
      is_active,
      invited_at,
      accepted_at,
      created_by
    )
    values (
      new.id,
      new.created_by,
      'owner',
      true,
      now(),
      now(),
      new.created_by
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_business_created_owner_membership on public.businesses;
create trigger trg_business_created_owner_membership
after insert on public.businesses
for each row
execute function app_private.handle_business_created();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

create or replace function app_private.validate_pdf_archive_document()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_business_id uuid;
  v_document_number text;
begin
  if new.document_kind = 'quote' then
    select q.business_id, q.quote_number
      into v_business_id, v_document_number
    from public.quotes q
    where q.id = new.document_id
      and q.deleted_at is null;
  elsif new.document_kind = 'invoice' then
    select i.business_id, i.invoice_number
      into v_business_id, v_document_number
    from public.invoices i
    where i.id = new.document_id
      and i.deleted_at is null;
  else
    raise exception 'Unsupported document_kind: %', new.document_kind;
  end if;

  if v_business_id is null then
    raise exception 'Document % (%) not found for PDF archive.', new.document_id, new.document_kind;
  end if;

  if v_business_id <> new.business_id then
    raise exception 'business_id mismatch for pdf_archives row %', new.id;
  end if;

  if new.document_number is null then
    new.document_number := v_document_number;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_pdf_archive_document on public.pdf_archives;
create trigger trg_validate_pdf_archive_document
before insert or update on public.pdf_archives
for each row
execute function app_private.validate_pdf_archive_document();

create or replace function app_private.validate_email_log_document()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_business_id uuid;
begin
  if new.document_kind is null and new.document_id is null then
    return new;
  end if;

  if new.document_kind = 'quote' then
    select q.business_id into v_business_id
    from public.quotes q
    where q.id = new.document_id
      and q.deleted_at is null;
  elsif new.document_kind = 'invoice' then
    select i.business_id into v_business_id
    from public.invoices i
    where i.id = new.document_id
      and i.deleted_at is null;
  else
    raise exception 'Unsupported document_kind for email log: %', new.document_kind;
  end if;

  if v_business_id is null then
    raise exception 'Document % (%) not found for email log.', new.document_id, new.document_kind;
  end if;

  if v_business_id <> new.business_id then
    raise exception 'business_id mismatch for email_logs row %', new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_email_log_document on public.email_logs;
create trigger trg_validate_email_log_document
before insert or update on public.email_logs
for each row
execute function app_private.validate_email_log_document();

create or replace function app_private.validate_client_contact_business()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_client_business_id uuid;
begin
  select c.business_id
    into v_client_business_id
  from public.clients c
  where c.id = new.client_id
    and c.deleted_at is null;

  if v_client_business_id is null then
    raise exception 'Client % not found for client contact.', new.client_id;
  end if;

  if v_client_business_id <> new.business_id then
    raise exception 'business_id mismatch between client_contacts and clients.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_client_contact_business on public.client_contacts;
create trigger trg_validate_client_contact_business
before insert or update on public.client_contacts
for each row
execute function app_private.validate_client_contact_business();

create or replace function app_private.validate_quote_business_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_client_business_id uuid;
  v_contact_client_id uuid;
  v_contact_business_id uuid;
  v_template_business_id uuid;
  v_template_version_business_id uuid;
  v_invoice_business_id uuid;
begin
  select c.business_id
    into v_client_business_id
  from public.clients c
  where c.id = new.client_id
    and c.deleted_at is null;

  if v_client_business_id is null or v_client_business_id <> new.business_id then
    raise exception 'Client business mismatch on quotes row.';
  end if;

  if new.client_contact_id is not null then
    select cc.client_id, cc.business_id
      into v_contact_client_id, v_contact_business_id
    from public.client_contacts cc
    where cc.id = new.client_contact_id
      and cc.deleted_at is null;

    if v_contact_business_id is null
       or v_contact_business_id <> new.business_id
       or v_contact_client_id <> new.client_id then
      raise exception 'Client contact mismatch on quotes row.';
    end if;
  end if;

  if new.template_id is not null then
    select dt.business_id into v_template_business_id
    from public.document_templates dt
    where dt.id = new.template_id
      and dt.deleted_at is null;

    if v_template_business_id is null or v_template_business_id <> new.business_id then
      raise exception 'Template business mismatch on quotes row.';
    end if;
  end if;

  if new.template_version_id is not null then
    select tv.business_id into v_template_version_business_id
    from public.template_versions tv
    where tv.id = new.template_version_id
      and tv.deleted_at is null;

    if v_template_version_business_id is null or v_template_version_business_id <> new.business_id then
      raise exception 'Template version business mismatch on quotes row.';
    end if;
  end if;

  if new.converted_to_invoice_id is not null then
    select i.business_id into v_invoice_business_id
    from public.invoices i
    where i.id = new.converted_to_invoice_id
      and i.deleted_at is null;

    if v_invoice_business_id is null or v_invoice_business_id <> new.business_id then
      raise exception 'Converted invoice business mismatch on quotes row.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_quote_business_scope on public.quotes;
create trigger trg_validate_quote_business_scope
before insert or update on public.quotes
for each row
execute function app_private.validate_quote_business_scope();

create or replace function app_private.validate_invoice_business_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_client_business_id uuid;
  v_contact_client_id uuid;
  v_contact_business_id uuid;
  v_template_business_id uuid;
  v_template_version_business_id uuid;
  v_quote_business_id uuid;
begin
  select c.business_id
    into v_client_business_id
  from public.clients c
  where c.id = new.client_id
    and c.deleted_at is null;

  if v_client_business_id is null or v_client_business_id <> new.business_id then
    raise exception 'Client business mismatch on invoices row.';
  end if;

  if new.client_contact_id is not null then
    select cc.client_id, cc.business_id
      into v_contact_client_id, v_contact_business_id
    from public.client_contacts cc
    where cc.id = new.client_contact_id
      and cc.deleted_at is null;

    if v_contact_business_id is null
       or v_contact_business_id <> new.business_id
       or v_contact_client_id <> new.client_id then
      raise exception 'Client contact mismatch on invoices row.';
    end if;
  end if;

  if new.template_id is not null then
    select dt.business_id into v_template_business_id
    from public.document_templates dt
    where dt.id = new.template_id
      and dt.deleted_at is null;

    if v_template_business_id is null or v_template_business_id <> new.business_id then
      raise exception 'Template business mismatch on invoices row.';
    end if;
  end if;

  if new.template_version_id is not null then
    select tv.business_id into v_template_version_business_id
    from public.template_versions tv
    where tv.id = new.template_version_id
      and tv.deleted_at is null;

    if v_template_version_business_id is null or v_template_version_business_id <> new.business_id then
      raise exception 'Template version business mismatch on invoices row.';
    end if;
  end if;

  if new.source_quote_id is not null then
    select q.business_id into v_quote_business_id
    from public.quotes q
    where q.id = new.source_quote_id
      and q.deleted_at is null;

    if v_quote_business_id is null or v_quote_business_id <> new.business_id then
      raise exception 'Source quote business mismatch on invoices row.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_invoice_business_scope on public.invoices;
create trigger trg_validate_invoice_business_scope
before insert or update on public.invoices
for each row
execute function app_private.validate_invoice_business_scope();

create or replace function app_private.validate_quote_item_business_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_quote_business_id uuid;
  v_product_business_id uuid;
begin
  select q.business_id
    into v_quote_business_id
  from public.quotes q
  where q.id = new.quote_id
    and q.deleted_at is null;

  if v_quote_business_id is null or v_quote_business_id <> new.business_id then
    raise exception 'Quote item business mismatch.';
  end if;

  if new.product_service_id is not null then
    select ps.business_id
      into v_product_business_id
    from public.products_services ps
    where ps.id = new.product_service_id
      and ps.deleted_at is null;

    if v_product_business_id is null or v_product_business_id <> new.business_id then
      raise exception 'Quote item product/service business mismatch.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_quote_item_business_scope on public.quote_items;
create trigger trg_validate_quote_item_business_scope
before insert or update on public.quote_items
for each row
execute function app_private.validate_quote_item_business_scope();

create or replace function app_private.validate_invoice_item_business_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_invoice_business_id uuid;
  v_product_business_id uuid;
begin
  select i.business_id
    into v_invoice_business_id
  from public.invoices i
  where i.id = new.invoice_id
    and i.deleted_at is null;

  if v_invoice_business_id is null or v_invoice_business_id <> new.business_id then
    raise exception 'Invoice item business mismatch.';
  end if;

  if new.product_service_id is not null then
    select ps.business_id
      into v_product_business_id
    from public.products_services ps
    where ps.id = new.product_service_id
      and ps.deleted_at is null;

    if v_product_business_id is null or v_product_business_id <> new.business_id then
      raise exception 'Invoice item product/service business mismatch.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_invoice_item_business_scope on public.invoice_items;
create trigger trg_validate_invoice_item_business_scope
before insert or update on public.invoice_items
for each row
execute function app_private.validate_invoice_item_business_scope();

create or replace function app_private.validate_payment_business_scope()
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
    raise exception 'Payment business mismatch with invoice.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_payment_business_scope on public.payments;
create trigger trg_validate_payment_business_scope
before insert or update on public.payments
for each row
execute function app_private.validate_payment_business_scope();

create or replace function app_private.validate_template_version_business_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_template_business_id uuid;
begin
  select dt.business_id
    into v_template_business_id
  from public.document_templates dt
  where dt.id = new.template_id
    and dt.deleted_at is null;

  if v_template_business_id is null or v_template_business_id <> new.business_id then
    raise exception 'Template version business mismatch with parent template.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_template_version_business_scope on public.template_versions;
create trigger trg_validate_template_version_business_scope
before insert or update on public.template_versions
for each row
execute function app_private.validate_template_version_business_scope();

create or replace function app_private.log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new jsonb;
  v_old jsonb;
  v_action public.activity_action;
  v_business_id uuid;
  v_entity_id uuid;
  v_label text;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_old := null;
    v_action := 'insert';
    v_business_id := app_private.try_uuid(v_new ->> 'business_id');
    v_entity_id := app_private.try_uuid(v_new ->> 'id');
  elsif tg_op = 'UPDATE' then
    v_new := to_jsonb(new);
    v_old := to_jsonb(old);
    v_business_id := coalesce(
      app_private.try_uuid(v_new ->> 'business_id'),
      app_private.try_uuid(v_old ->> 'business_id')
    );
    v_entity_id := coalesce(
      app_private.try_uuid(v_new ->> 'id'),
      app_private.try_uuid(v_old ->> 'id')
    );

    if (v_old ? 'deleted_at') and (v_old ->> 'deleted_at') is null and (v_new ->> 'deleted_at') is not null then
      v_action := 'soft_delete';
    elsif (v_old ? 'deleted_at') and (v_old ->> 'deleted_at') is not null and (v_new ->> 'deleted_at') is null then
      v_action := 'restore';
    elsif (v_old ? 'status') and (v_new ? 'status') and (v_old ->> 'status') is distinct from (v_new ->> 'status') then
      v_action := 'status_change';
    else
      v_action := 'update';
    end if;
  else
    return coalesce(new, old);
  end if;

  if v_business_id is null then
    return coalesce(new, old);
  end if;

  v_label := coalesce(
    v_new ->> 'quote_number',
    v_new ->> 'invoice_number',
    v_new ->> 'display_name',
    v_new ->> 'name',
    v_old ->> 'quote_number',
    v_old ->> 'invoice_number',
    v_old ->> 'display_name',
    v_old ->> 'name'
  );

  insert into public.activity_logs (
    business_id,
    actor_user_id,
    action,
    entity_table,
    entity_id,
    entity_label,
    before_data,
    after_data,
    metadata
  )
  values (
    v_business_id,
    auth.uid(),
    v_action,
    tg_table_name,
    v_entity_id,
    v_label,
    v_old,
    v_new,
    jsonb_build_object('operation', tg_op, 'source', 'trigger')
  );

  return coalesce(new, old);
end;
$$;

-- updated_at triggers

drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at
before update on public.profiles
for each row
execute function app_private.set_updated_at();

drop trigger if exists trg_businesses_set_updated_at on public.businesses;
create trigger trg_businesses_set_updated_at
before update on public.businesses
for each row
execute function app_private.set_updated_at();

drop trigger if exists trg_business_users_set_updated_at on public.business_users;
create trigger trg_business_users_set_updated_at
before update on public.business_users
for each row
execute function app_private.set_updated_at();

drop trigger if exists trg_tax_settings_set_updated_at on public.tax_settings;
create trigger trg_tax_settings_set_updated_at
before update on public.tax_settings
for each row
execute function app_private.set_updated_at();

drop trigger if exists trg_numbering_sequences_set_updated_at on public.numbering_sequences;
create trigger trg_numbering_sequences_set_updated_at
before update on public.numbering_sequences
for each row
execute function app_private.set_updated_at();

drop trigger if exists trg_clients_set_updated_at on public.clients;
create trigger trg_clients_set_updated_at
before update on public.clients
for each row
execute function app_private.set_updated_at();

drop trigger if exists trg_client_contacts_set_updated_at on public.client_contacts;
create trigger trg_client_contacts_set_updated_at
before update on public.client_contacts
for each row
execute function app_private.set_updated_at();

drop trigger if exists trg_products_services_set_updated_at on public.products_services;
create trigger trg_products_services_set_updated_at
before update on public.products_services
for each row
execute function app_private.set_updated_at();

drop trigger if exists trg_document_templates_set_updated_at on public.document_templates;
create trigger trg_document_templates_set_updated_at
before update on public.document_templates
for each row
execute function app_private.set_updated_at();

drop trigger if exists trg_template_versions_set_updated_at on public.template_versions;
create trigger trg_template_versions_set_updated_at
before update on public.template_versions
for each row
execute function app_private.set_updated_at();

drop trigger if exists trg_logo_assets_set_updated_at on public.logo_assets;
create trigger trg_logo_assets_set_updated_at
before update on public.logo_assets
for each row
execute function app_private.set_updated_at();

drop trigger if exists trg_quotes_set_updated_at on public.quotes;
create trigger trg_quotes_set_updated_at
before update on public.quotes
for each row
execute function app_private.set_updated_at();

drop trigger if exists trg_quote_items_set_updated_at on public.quote_items;
create trigger trg_quote_items_set_updated_at
before update on public.quote_items
for each row
execute function app_private.set_updated_at();

drop trigger if exists trg_invoices_set_updated_at on public.invoices;
create trigger trg_invoices_set_updated_at
before update on public.invoices
for each row
execute function app_private.set_updated_at();

drop trigger if exists trg_invoice_items_set_updated_at on public.invoice_items;
create trigger trg_invoice_items_set_updated_at
before update on public.invoice_items
for each row
execute function app_private.set_updated_at();

drop trigger if exists trg_payments_set_updated_at on public.payments;
create trigger trg_payments_set_updated_at
before update on public.payments
for each row
execute function app_private.set_updated_at();

drop trigger if exists trg_email_logs_set_updated_at on public.email_logs;
create trigger trg_email_logs_set_updated_at
before update on public.email_logs
for each row
execute function app_private.set_updated_at();

-- activity/audit triggers for mutable core tables.

drop trigger if exists trg_activity_clients on public.clients;
create trigger trg_activity_clients
after insert or update on public.clients
for each row
execute function app_private.log_activity();

drop trigger if exists trg_activity_client_contacts on public.client_contacts;
create trigger trg_activity_client_contacts
after insert or update on public.client_contacts
for each row
execute function app_private.log_activity();

drop trigger if exists trg_activity_products_services on public.products_services;
create trigger trg_activity_products_services
after insert or update on public.products_services
for each row
execute function app_private.log_activity();

drop trigger if exists trg_activity_quotes on public.quotes;
create trigger trg_activity_quotes
after insert or update on public.quotes
for each row
execute function app_private.log_activity();

drop trigger if exists trg_activity_quote_items on public.quote_items;
create trigger trg_activity_quote_items
after insert or update on public.quote_items
for each row
execute function app_private.log_activity();

drop trigger if exists trg_activity_invoices on public.invoices;
create trigger trg_activity_invoices
after insert or update on public.invoices
for each row
execute function app_private.log_activity();

drop trigger if exists trg_activity_invoice_items on public.invoice_items;
create trigger trg_activity_invoice_items
after insert or update on public.invoice_items
for each row
execute function app_private.log_activity();

drop trigger if exists trg_activity_payments on public.payments;
create trigger trg_activity_payments
after insert or update on public.payments
for each row
execute function app_private.log_activity();

drop trigger if exists trg_activity_document_templates on public.document_templates;
create trigger trg_activity_document_templates
after insert or update on public.document_templates
for each row
execute function app_private.log_activity();

drop trigger if exists trg_activity_template_versions on public.template_versions;
create trigger trg_activity_template_versions
after insert or update on public.template_versions
for each row
execute function app_private.log_activity();

drop trigger if exists trg_activity_tax_settings on public.tax_settings;
create trigger trg_activity_tax_settings
after insert or update on public.tax_settings
for each row
execute function app_private.log_activity();

drop trigger if exists trg_activity_numbering_sequences on public.numbering_sequences;
create trigger trg_activity_numbering_sequences
after insert or update on public.numbering_sequences
for each row
execute function app_private.log_activity();

drop trigger if exists trg_activity_email_logs on public.email_logs;
create trigger trg_activity_email_logs
after insert or update on public.email_logs
for each row
execute function app_private.log_activity();

-- Unique constraints via partial indexes for soft-delete compatibility.
create unique index if not exists ux_business_users_business_user_active
  on public.business_users (business_id, user_id)
  where deleted_at is null;

create unique index if not exists ux_tax_settings_one_default_per_business
  on public.tax_settings (business_id)
  where is_default = true and deleted_at is null;

create unique index if not exists ux_tax_settings_code_per_business
  on public.tax_settings (business_id, code)
  where code is not null and deleted_at is null;

create unique index if not exists ux_numbering_sequences_business_type_active
  on public.numbering_sequences (business_id, sequence_type)
  where deleted_at is null;

create unique index if not exists ux_client_contacts_primary_per_client
  on public.client_contacts (client_id)
  where is_primary = true and deleted_at is null;

create unique index if not exists ux_products_services_sku_per_business
  on public.products_services (business_id, sku)
  where sku is not null and deleted_at is null;

create unique index if not exists ux_document_templates_default_per_type
  on public.document_templates (business_id, template_type)
  where is_default = true and deleted_at is null;

create unique index if not exists ux_template_versions_template_version
  on public.template_versions (template_id, version_number)
  where deleted_at is null;

create unique index if not exists ux_template_versions_published_per_template
  on public.template_versions (template_id)
  where is_published = true and deleted_at is null;

create unique index if not exists ux_logo_assets_business_object_path
  on public.logo_assets (business_id, object_path)
  where deleted_at is null;

create unique index if not exists ux_quotes_business_number
  on public.quotes (business_id, quote_number)
  where deleted_at is null;

create unique index if not exists ux_quote_items_order_per_quote
  on public.quote_items (quote_id, line_order)
  where deleted_at is null;

create unique index if not exists ux_invoices_business_number
  on public.invoices (business_id, invoice_number)
  where deleted_at is null;

create unique index if not exists ux_invoice_items_order_per_invoice
  on public.invoice_items (invoice_id, line_order)
  where deleted_at is null;

create unique index if not exists ux_payments_reference_per_business
  on public.payments (business_id, payment_reference)
  where payment_reference is not null and deleted_at is null;

create unique index if not exists ux_pdf_archives_bucket_object_path
  on public.pdf_archives (bucket_name, object_path)
  where deleted_at is null;

-- Lookup and reporting indexes.
create index if not exists ix_business_users_user_active
  on public.business_users (user_id, business_id)
  where deleted_at is null;

create index if not exists ix_clients_business_active_name
  on public.clients (business_id, is_active, display_name)
  where deleted_at is null;

create index if not exists ix_products_services_business_active_name
  on public.products_services (business_id, is_active, name)
  where deleted_at is null;

create index if not exists ix_quotes_business_status_dates
  on public.quotes (business_id, status, issued_at, valid_until)
  where deleted_at is null;

create index if not exists ix_invoices_business_status_dates
  on public.invoices (business_id, status, issue_date, due_date)
  where deleted_at is null;

create index if not exists ix_payments_business_invoice_date
  on public.payments (business_id, invoice_id, payment_date)
  where deleted_at is null;

create index if not exists ix_template_versions_template_created
  on public.template_versions (template_id, created_at desc)
  where deleted_at is null;

create index if not exists ix_pdf_archives_document_lookup
  on public.pdf_archives (business_id, document_kind, document_id, created_at desc)
  where deleted_at is null;

create index if not exists ix_email_logs_document_status
  on public.email_logs (business_id, document_kind, document_id, status, created_at desc)
  where deleted_at is null;

create index if not exists ix_activity_logs_business_created
  on public.activity_logs (business_id, created_at desc);
