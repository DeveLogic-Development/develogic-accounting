-- 202604080002_core_tables.sql
-- Core identity, business, master data, and template tables.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  registration_number text,
  vat_number text,
  email text,
  phone text,
  website text,
  address_line1 text,
  address_line2 text,
  city text,
  state_province text,
  postal_code text,
  country_code char(2) not null default 'ZA',
  currency_code char(3) not null default 'ZAR',
  timezone text not null default 'Africa/Johannesburg',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.business_users (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.user_role not null default 'owner',
  is_active boolean not null default true,
  invited_at timestamptz,
  accepted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.tax_settings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  code text,
  rate numeric(5,2) not null check (rate >= 0 and rate <= 100),
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.numbering_sequences (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  sequence_type public.sequence_type not null,
  prefix text not null default '',
  suffix text not null default '',
  next_number bigint not null default 1 check (next_number > 0),
  padding integer not null default 4 check (padding >= 1 and padding <= 12),
  reset_period public.sequence_reset_period not null default 'never',
  last_reset_at date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_type public.client_type not null default 'business',
  display_name text not null,
  legal_name text,
  email text,
  phone text,
  tax_number text,
  billing_address_line1 text,
  billing_address_line2 text,
  billing_city text,
  billing_state_province text,
  billing_postal_code text,
  billing_country_code char(2),
  shipping_address_line1 text,
  shipping_address_line2 text,
  shipping_city text,
  shipping_state_province text,
  shipping_postal_code text,
  shipping_country_code char(2),
  payment_terms_days integer not null default 30 check (payment_terms_days >= 0),
  notes text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  title text,
  is_primary boolean not null default false,
  receives_documents boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.products_services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  item_type public.product_service_type not null default 'service',
  name text not null,
  sku text,
  description text,
  unit text not null default 'each',
  unit_price numeric(14,2) not null check (unit_price >= 0),
  tax_setting_id uuid references public.tax_settings(id) on delete set null,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.document_templates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  template_type public.template_type not null,
  name text not null,
  description text,
  status public.template_status not null default 'draft',
  is_default boolean not null default false,
  is_system boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.template_versions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  template_id uuid not null references public.document_templates(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  is_published boolean not null default false,
  schema_version integer not null default 1 check (schema_version > 0),
  content_json jsonb not null default '{}'::jsonb,
  style_json jsonb not null default '{}'::jsonb,
  labels_json jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.logo_assets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  bucket_name text not null default 'branding-assets',
  object_path text not null,
  file_name text,
  mime_type text,
  file_size_bytes bigint,
  width_px integer,
  height_px integer,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
