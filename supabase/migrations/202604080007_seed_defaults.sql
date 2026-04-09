-- 202604080007_seed_defaults.sql
-- Default seed strategy for business-level setup (tax, numbering, templates).

create or replace function public.seed_business_defaults(
  p_business_id uuid,
  p_actor uuid default auth.uid()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote_template_id uuid;
  v_invoice_template_id uuid;
begin
  -- Tax defaults (ZA-friendly baseline)
  insert into public.tax_settings (
    business_id,
    name,
    code,
    rate,
    is_default,
    is_active,
    created_by
  )
  values
    (p_business_id, 'VAT 15%', 'VAT15', 15.00, true, true, p_actor),
    (p_business_id, 'Zero-rated', 'VAT0', 0.00, false, true, p_actor)
  on conflict do nothing;

  -- Numbering defaults
  insert into public.numbering_sequences (
    business_id,
    sequence_type,
    prefix,
    suffix,
    next_number,
    padding,
    reset_period,
    last_reset_at,
    created_by
  )
  values
    (p_business_id, 'quote', 'QUO-', '', 1, 5, 'yearly', current_date, p_actor),
    (p_business_id, 'invoice', 'INV-', '', 1, 5, 'yearly', current_date, p_actor)
  on conflict do nothing;

  -- Quote template
  insert into public.document_templates (
    business_id,
    template_type,
    name,
    description,
    status,
    is_default,
    is_system,
    created_by
  )
  values (
    p_business_id,
    'quote',
    'Modern Quote',
    'Default quote template with branding and terms block.',
    'published',
    true,
    true,
    p_actor
  )
  on conflict do nothing
  returning id into v_quote_template_id;

  if v_quote_template_id is null then
    select id into v_quote_template_id
    from public.document_templates
    where business_id = p_business_id
      and template_type = 'quote'
      and is_default = true
      and deleted_at is null
    order by created_at asc
    limit 1;
  end if;

  if v_quote_template_id is not null then
    insert into public.template_versions (
      business_id,
      template_id,
      version_number,
      is_published,
      schema_version,
      content_json,
      style_json,
      labels_json,
      created_by
    )
    select
      p_business_id,
      v_quote_template_id,
      1,
      true,
      1,
      jsonb_build_object(
        'blocks', jsonb_build_array('header', 'client', 'line_items', 'totals', 'terms', 'signature'),
        'showExpiry', true,
        'showAcceptance', true
      ),
      jsonb_build_object(
        'fontFamily', 'Inter',
        'accentColor', '#0F4C81',
        'showLogo', true,
        'density', 'comfortable'
      ),
      jsonb_build_object(
        'title', 'Quotation',
        'item', 'Item',
        'quantity', 'Qty',
        'unitPrice', 'Unit Price',
        'total', 'Total'
      ),
      p_actor
    where not exists (
      select 1
      from public.template_versions tv
      where tv.template_id = v_quote_template_id
        and tv.version_number = 1
        and tv.deleted_at is null
    );
  end if;

  -- Invoice template
  insert into public.document_templates (
    business_id,
    template_type,
    name,
    description,
    status,
    is_default,
    is_system,
    created_by
  )
  values (
    p_business_id,
    'invoice',
    'Modern Invoice',
    'Default invoice template with payment terms and summary.',
    'published',
    true,
    true,
    p_actor
  )
  on conflict do nothing
  returning id into v_invoice_template_id;

  if v_invoice_template_id is null then
    select id into v_invoice_template_id
    from public.document_templates
    where business_id = p_business_id
      and template_type = 'invoice'
      and is_default = true
      and deleted_at is null
    order by created_at asc
    limit 1;
  end if;

  if v_invoice_template_id is not null then
    insert into public.template_versions (
      business_id,
      template_id,
      version_number,
      is_published,
      schema_version,
      content_json,
      style_json,
      labels_json,
      created_by
    )
    select
      p_business_id,
      v_invoice_template_id,
      1,
      true,
      1,
      jsonb_build_object(
        'blocks', jsonb_build_array('header', 'client', 'line_items', 'totals', 'payment_details', 'terms'),
        'showDueDate', true,
        'showBalance', true
      ),
      jsonb_build_object(
        'fontFamily', 'Inter',
        'accentColor', '#0A6E4E',
        'showLogo', true,
        'density', 'comfortable'
      ),
      jsonb_build_object(
        'title', 'Tax Invoice',
        'invoiceNo', 'Invoice No.',
        'dueDate', 'Due Date',
        'balanceDue', 'Balance Due'
      ),
      p_actor
    where not exists (
      select 1
      from public.template_versions tv
      where tv.template_id = v_invoice_template_id
        and tv.version_number = 1
        and tv.deleted_at is null
    );
  end if;
end;
$$;

grant execute on function public.seed_business_defaults(uuid, uuid) to authenticated;

-- Extend business creation hook to seed defaults immediately.
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

  perform public.seed_business_defaults(new.id, new.created_by);

  return new;
end;
$$;

-- Optional one-time backfill for already-created businesses.
do $$
declare
  r record;
begin
  for r in
    select b.id as business_id, b.created_by
    from public.businesses b
    where b.deleted_at is null
  loop
    perform public.seed_business_defaults(r.business_id, r.created_by);
  end loop;
end $$;
