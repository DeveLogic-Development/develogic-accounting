-- 202604080005_rls_policies.sql
-- Enable row-level security and define authenticated access policies.

grant execute on function app_private.has_business_role(uuid, public.user_role[]) to authenticated;
grant execute on function app_private.is_business_member(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_users enable row level security;
alter table public.tax_settings enable row level security;
alter table public.numbering_sequences enable row level security;
alter table public.clients enable row level security;
alter table public.client_contacts enable row level security;
alter table public.products_services enable row level security;
alter table public.document_templates enable row level security;
alter table public.template_versions enable row level security;
alter table public.logo_assets enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.pdf_archives enable row level security;
alter table public.email_logs enable row level security;
alter table public.activity_logs enable row level security;

-- profiles (self access only)
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- businesses
drop policy if exists businesses_select_member on public.businesses;
create policy businesses_select_member
  on public.businesses
  for select
  to authenticated
  using (app_private.is_business_member(id));

drop policy if exists businesses_insert_creator on public.businesses;
create policy businesses_insert_creator
  on public.businesses
  for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists businesses_update_owner_admin on public.businesses;
create policy businesses_update_owner_admin
  on public.businesses
  for update
  to authenticated
  using (app_private.has_business_role(id, array['owner', 'admin']::public.user_role[]))
  with check (app_private.has_business_role(id, array['owner', 'admin']::public.user_role[]));

drop policy if exists businesses_delete_owner_admin on public.businesses;
create policy businesses_delete_owner_admin
  on public.businesses
  for delete
  to authenticated
  using (app_private.has_business_role(id, array['owner', 'admin']::public.user_role[]));

-- business_users
drop policy if exists business_users_select_member on public.business_users;
create policy business_users_select_member
  on public.business_users
  for select
  to authenticated
  using (app_private.is_business_member(business_id));

drop policy if exists business_users_insert_owner_admin on public.business_users;
create policy business_users_insert_owner_admin
  on public.business_users
  for insert
  to authenticated
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists business_users_update_owner_admin on public.business_users;
create policy business_users_update_owner_admin
  on public.business_users
  for update
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]))
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists business_users_delete_owner_admin on public.business_users;
create policy business_users_delete_owner_admin
  on public.business_users
  for delete
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

-- Generic business-scoped table policies

-- tax_settings
drop policy if exists tax_settings_select_member on public.tax_settings;
create policy tax_settings_select_member
  on public.tax_settings
  for select
  to authenticated
  using (app_private.is_business_member(business_id));

drop policy if exists tax_settings_insert_owner_admin on public.tax_settings;
create policy tax_settings_insert_owner_admin
  on public.tax_settings
  for insert
  to authenticated
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists tax_settings_update_owner_admin on public.tax_settings;
create policy tax_settings_update_owner_admin
  on public.tax_settings
  for update
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]))
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists tax_settings_delete_owner_admin on public.tax_settings;
create policy tax_settings_delete_owner_admin
  on public.tax_settings
  for delete
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

-- numbering_sequences
drop policy if exists numbering_sequences_select_member on public.numbering_sequences;
create policy numbering_sequences_select_member
  on public.numbering_sequences
  for select
  to authenticated
  using (app_private.is_business_member(business_id));

drop policy if exists numbering_sequences_insert_owner_admin on public.numbering_sequences;
create policy numbering_sequences_insert_owner_admin
  on public.numbering_sequences
  for insert
  to authenticated
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists numbering_sequences_update_owner_admin on public.numbering_sequences;
create policy numbering_sequences_update_owner_admin
  on public.numbering_sequences
  for update
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]))
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists numbering_sequences_delete_owner_admin on public.numbering_sequences;
create policy numbering_sequences_delete_owner_admin
  on public.numbering_sequences
  for delete
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

-- clients
drop policy if exists clients_select_member on public.clients;
create policy clients_select_member
  on public.clients
  for select
  to authenticated
  using (app_private.is_business_member(business_id));

drop policy if exists clients_insert_owner_admin on public.clients;
create policy clients_insert_owner_admin
  on public.clients
  for insert
  to authenticated
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists clients_update_owner_admin on public.clients;
create policy clients_update_owner_admin
  on public.clients
  for update
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]))
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists clients_delete_owner_admin on public.clients;
create policy clients_delete_owner_admin
  on public.clients
  for delete
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

-- client_contacts
drop policy if exists client_contacts_select_member on public.client_contacts;
create policy client_contacts_select_member
  on public.client_contacts
  for select
  to authenticated
  using (app_private.is_business_member(business_id));

drop policy if exists client_contacts_insert_owner_admin on public.client_contacts;
create policy client_contacts_insert_owner_admin
  on public.client_contacts
  for insert
  to authenticated
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists client_contacts_update_owner_admin on public.client_contacts;
create policy client_contacts_update_owner_admin
  on public.client_contacts
  for update
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]))
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists client_contacts_delete_owner_admin on public.client_contacts;
create policy client_contacts_delete_owner_admin
  on public.client_contacts
  for delete
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

-- products_services
drop policy if exists products_services_select_member on public.products_services;
create policy products_services_select_member
  on public.products_services
  for select
  to authenticated
  using (app_private.is_business_member(business_id));

drop policy if exists products_services_insert_owner_admin on public.products_services;
create policy products_services_insert_owner_admin
  on public.products_services
  for insert
  to authenticated
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists products_services_update_owner_admin on public.products_services;
create policy products_services_update_owner_admin
  on public.products_services
  for update
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]))
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists products_services_delete_owner_admin on public.products_services;
create policy products_services_delete_owner_admin
  on public.products_services
  for delete
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

-- document_templates
drop policy if exists document_templates_select_member on public.document_templates;
create policy document_templates_select_member
  on public.document_templates
  for select
  to authenticated
  using (app_private.is_business_member(business_id));

drop policy if exists document_templates_insert_owner_admin on public.document_templates;
create policy document_templates_insert_owner_admin
  on public.document_templates
  for insert
  to authenticated
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists document_templates_update_owner_admin on public.document_templates;
create policy document_templates_update_owner_admin
  on public.document_templates
  for update
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]))
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists document_templates_delete_owner_admin on public.document_templates;
create policy document_templates_delete_owner_admin
  on public.document_templates
  for delete
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

-- template_versions
drop policy if exists template_versions_select_member on public.template_versions;
create policy template_versions_select_member
  on public.template_versions
  for select
  to authenticated
  using (app_private.is_business_member(business_id));

drop policy if exists template_versions_insert_owner_admin on public.template_versions;
create policy template_versions_insert_owner_admin
  on public.template_versions
  for insert
  to authenticated
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists template_versions_update_owner_admin on public.template_versions;
create policy template_versions_update_owner_admin
  on public.template_versions
  for update
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]))
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists template_versions_delete_owner_admin on public.template_versions;
create policy template_versions_delete_owner_admin
  on public.template_versions
  for delete
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

-- logo_assets
drop policy if exists logo_assets_select_member on public.logo_assets;
create policy logo_assets_select_member
  on public.logo_assets
  for select
  to authenticated
  using (app_private.is_business_member(business_id));

drop policy if exists logo_assets_insert_owner_admin on public.logo_assets;
create policy logo_assets_insert_owner_admin
  on public.logo_assets
  for insert
  to authenticated
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists logo_assets_update_owner_admin on public.logo_assets;
create policy logo_assets_update_owner_admin
  on public.logo_assets
  for update
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]))
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists logo_assets_delete_owner_admin on public.logo_assets;
create policy logo_assets_delete_owner_admin
  on public.logo_assets
  for delete
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

-- quotes
drop policy if exists quotes_select_member on public.quotes;
create policy quotes_select_member
  on public.quotes
  for select
  to authenticated
  using (app_private.is_business_member(business_id));

drop policy if exists quotes_insert_owner_admin on public.quotes;
create policy quotes_insert_owner_admin
  on public.quotes
  for insert
  to authenticated
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists quotes_update_owner_admin on public.quotes;
create policy quotes_update_owner_admin
  on public.quotes
  for update
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]))
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists quotes_delete_owner_admin on public.quotes;
create policy quotes_delete_owner_admin
  on public.quotes
  for delete
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

-- quote_items
drop policy if exists quote_items_select_member on public.quote_items;
create policy quote_items_select_member
  on public.quote_items
  for select
  to authenticated
  using (app_private.is_business_member(business_id));

drop policy if exists quote_items_insert_owner_admin on public.quote_items;
create policy quote_items_insert_owner_admin
  on public.quote_items
  for insert
  to authenticated
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists quote_items_update_owner_admin on public.quote_items;
create policy quote_items_update_owner_admin
  on public.quote_items
  for update
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]))
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists quote_items_delete_owner_admin on public.quote_items;
create policy quote_items_delete_owner_admin
  on public.quote_items
  for delete
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

-- invoices
drop policy if exists invoices_select_member on public.invoices;
create policy invoices_select_member
  on public.invoices
  for select
  to authenticated
  using (app_private.is_business_member(business_id));

drop policy if exists invoices_insert_owner_admin on public.invoices;
create policy invoices_insert_owner_admin
  on public.invoices
  for insert
  to authenticated
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists invoices_update_owner_admin on public.invoices;
create policy invoices_update_owner_admin
  on public.invoices
  for update
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]))
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists invoices_delete_owner_admin on public.invoices;
create policy invoices_delete_owner_admin
  on public.invoices
  for delete
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

-- invoice_items
drop policy if exists invoice_items_select_member on public.invoice_items;
create policy invoice_items_select_member
  on public.invoice_items
  for select
  to authenticated
  using (app_private.is_business_member(business_id));

drop policy if exists invoice_items_insert_owner_admin on public.invoice_items;
create policy invoice_items_insert_owner_admin
  on public.invoice_items
  for insert
  to authenticated
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists invoice_items_update_owner_admin on public.invoice_items;
create policy invoice_items_update_owner_admin
  on public.invoice_items
  for update
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]))
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists invoice_items_delete_owner_admin on public.invoice_items;
create policy invoice_items_delete_owner_admin
  on public.invoice_items
  for delete
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

-- payments
drop policy if exists payments_select_member on public.payments;
create policy payments_select_member
  on public.payments
  for select
  to authenticated
  using (app_private.is_business_member(business_id));

drop policy if exists payments_insert_owner_admin on public.payments;
create policy payments_insert_owner_admin
  on public.payments
  for insert
  to authenticated
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists payments_update_owner_admin on public.payments;
create policy payments_update_owner_admin
  on public.payments
  for update
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]))
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists payments_delete_owner_admin on public.payments;
create policy payments_delete_owner_admin
  on public.payments
  for delete
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

-- pdf_archives
drop policy if exists pdf_archives_select_member on public.pdf_archives;
create policy pdf_archives_select_member
  on public.pdf_archives
  for select
  to authenticated
  using (app_private.is_business_member(business_id));

drop policy if exists pdf_archives_insert_owner_admin on public.pdf_archives;
create policy pdf_archives_insert_owner_admin
  on public.pdf_archives
  for insert
  to authenticated
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists pdf_archives_update_owner_admin on public.pdf_archives;
create policy pdf_archives_update_owner_admin
  on public.pdf_archives
  for update
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]))
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists pdf_archives_delete_owner_admin on public.pdf_archives;
create policy pdf_archives_delete_owner_admin
  on public.pdf_archives
  for delete
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

-- email_logs
drop policy if exists email_logs_select_member on public.email_logs;
create policy email_logs_select_member
  on public.email_logs
  for select
  to authenticated
  using (app_private.is_business_member(business_id));

drop policy if exists email_logs_insert_owner_admin on public.email_logs;
create policy email_logs_insert_owner_admin
  on public.email_logs
  for insert
  to authenticated
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists email_logs_update_owner_admin on public.email_logs;
create policy email_logs_update_owner_admin
  on public.email_logs
  for update
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]))
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

drop policy if exists email_logs_delete_owner_admin on public.email_logs;
create policy email_logs_delete_owner_admin
  on public.email_logs
  for delete
  to authenticated
  using (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));

-- activity_logs (read for all members, write for owner/admin; updates/deletes blocked by omission)
drop policy if exists activity_logs_select_member on public.activity_logs;
create policy activity_logs_select_member
  on public.activity_logs
  for select
  to authenticated
  using (app_private.is_business_member(business_id));

drop policy if exists activity_logs_insert_owner_admin on public.activity_logs;
create policy activity_logs_insert_owner_admin
  on public.activity_logs
  for insert
  to authenticated
  with check (app_private.has_business_role(business_id, array['owner', 'admin']::public.user_role[]));
