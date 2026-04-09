-- 202604080001_init_extensions_enums.sql
-- Foundation: extensions, private schema, and enum types.

create extension if not exists pgcrypto;

create schema if not exists app_private;

-- Future-ready user roles, even though v1 is owner-focused.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('owner', 'admin', 'accountant', 'viewer');
  end if;

  if not exists (select 1 from pg_type where typname = 'client_type') then
    create type public.client_type as enum ('business', 'individual');
  end if;

  if not exists (select 1 from pg_type where typname = 'product_service_type') then
    create type public.product_service_type as enum ('product', 'service');
  end if;

  if not exists (select 1 from pg_type where typname = 'quote_status') then
    create type public.quote_status as enum (
      'draft',
      'sent',
      'viewed',
      'accepted',
      'declined',
      'expired',
      'cancelled',
      'converted'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'invoice_status') then
    create type public.invoice_status as enum (
      'draft',
      'issued',
      'sent',
      'viewed',
      'partially_paid',
      'paid',
      'overdue',
      'void'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type public.payment_status as enum ('pending', 'completed', 'failed', 'refunded', 'cancelled');
  end if;

  if not exists (select 1 from pg_type where typname = 'payment_method') then
    create type public.payment_method as enum (
      'bank_transfer',
      'card',
      'cash',
      'mobile_money',
      'other'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'template_type') then
    create type public.template_type as enum ('quote', 'invoice');
  end if;

  if not exists (select 1 from pg_type where typname = 'template_status') then
    create type public.template_status as enum ('draft', 'published', 'archived');
  end if;

  if not exists (select 1 from pg_type where typname = 'document_kind') then
    create type public.document_kind as enum ('quote', 'invoice');
  end if;

  if not exists (select 1 from pg_type where typname = 'email_status') then
    create type public.email_status as enum ('queued', 'sent', 'failed', 'bounced');
  end if;

  if not exists (select 1 from pg_type where typname = 'sequence_type') then
    create type public.sequence_type as enum ('quote', 'invoice');
  end if;

  if not exists (select 1 from pg_type where typname = 'sequence_reset_period') then
    create type public.sequence_reset_period as enum ('never', 'yearly', 'monthly');
  end if;

  if not exists (select 1 from pg_type where typname = 'tax_mode') then
    create type public.tax_mode as enum ('exclusive', 'inclusive', 'none');
  end if;

  if not exists (select 1 from pg_type where typname = 'activity_action') then
    create type public.activity_action as enum (
      'insert',
      'update',
      'soft_delete',
      'restore',
      'status_change',
      'convert',
      'send_email',
      'generate_pdf',
      'payment_recorded'
    );
  end if;
end $$;

create or replace function app_private.try_uuid(input text)
returns uuid
language plpgsql
immutable
as $$
declare
  parsed uuid;
begin
  if input is null or btrim(input) = '' then
    return null;
  end if;

  begin
    parsed := input::uuid;
  exception
    when others then
      return null;
  end;

  return parsed;
end;
$$;

create or replace function app_private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
