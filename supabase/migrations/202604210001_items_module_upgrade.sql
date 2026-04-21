-- 202604210001_items_module_upgrade.sql
-- Items module upgrade: accounting-aware item master fields for goods/services.

alter table public.products_services
  add column if not exists usage_unit text,
  add column if not exists is_capital_asset boolean not null default false,
  add column if not exists image_url text,
  add column if not exists sales_rate numeric(14,2) check (sales_rate >= 0),
  add column if not exists sales_account_id text,
  add column if not exists sales_description text,
  add column if not exists purchase_rate numeric(14,2) not null default 0 check (purchase_rate >= 0),
  add column if not exists purchase_account_id text,
  add column if not exists purchase_description text,
  add column if not exists preferred_vendor_id uuid references public.clients(id) on delete set null,
  add column if not exists reporting_tags_json jsonb not null default '[]'::jsonb,
  add column if not exists created_source text not null default 'manual';

update public.products_services
set
  usage_unit = coalesce(nullif(usage_unit, ''), nullif(unit, ''), 'each'),
  sales_rate = coalesce(sales_rate, unit_price, 0),
  sales_description = coalesce(sales_description, description),
  purchase_rate = coalesce(purchase_rate, 0),
  reporting_tags_json = coalesce(reporting_tags_json, '[]'::jsonb),
  created_source = coalesce(nullif(created_source, ''), 'manual')
where true;

alter table public.products_services
  alter column usage_unit set not null,
  alter column usage_unit set default 'each',
  alter column sales_rate set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_services_created_source_check'
      and conrelid = 'public.products_services'::regclass
  ) then
    alter table public.products_services
      add constraint products_services_created_source_check
      check (created_source in ('manual', 'import', 'clone', 'system'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_services_reporting_tags_is_array'
      and conrelid = 'public.products_services'::regclass
  ) then
    alter table public.products_services
      add constraint products_services_reporting_tags_is_array
      check (jsonb_typeof(reporting_tags_json) = 'array');
  end if;
end $$;

create index if not exists ix_products_services_business_type_active
  on public.products_services (business_id, item_type, is_active)
  where deleted_at is null;

create index if not exists ix_products_services_business_vendor
  on public.products_services (business_id, preferred_vendor_id)
  where deleted_at is null;
