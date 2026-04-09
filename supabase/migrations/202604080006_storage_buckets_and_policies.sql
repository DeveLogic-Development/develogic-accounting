-- 202604080006_storage_buckets_and_policies.sql
-- Storage buckets and RLS policies for logos, generated PDFs, and attachments.

create or replace function app_private.storage_business_id(object_name text)
returns uuid
language sql
immutable
as $$
  select app_private.try_uuid((storage.foldername(object_name))[1]);
$$;

grant execute on function app_private.storage_business_id(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'branding-assets',
    'branding-assets',
    false,
    10485760,
    array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']::text[]
  ),
  (
    'document-files',
    'document-files',
    false,
    52428800,
    array['application/pdf']::text[]
  ),
  (
    'email-attachments',
    'email-attachments',
    false,
    26214400,
    array[
      'application/pdf',
      'image/png',
      'image/jpeg',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]::text[]
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table storage.objects enable row level security;

-- Read access: any business member can read files in that business folder.
drop policy if exists storage_select_branding_assets on storage.objects;
create policy storage_select_branding_assets
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'branding-assets'
    and app_private.is_business_member(app_private.storage_business_id(name))
  );

drop policy if exists storage_select_document_files on storage.objects;
create policy storage_select_document_files
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'document-files'
    and app_private.is_business_member(app_private.storage_business_id(name))
  );

drop policy if exists storage_select_email_attachments on storage.objects;
create policy storage_select_email_attachments
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'email-attachments'
    and app_private.is_business_member(app_private.storage_business_id(name))
  );

-- Write access: owner/admin only.
drop policy if exists storage_insert_branding_assets on storage.objects;
create policy storage_insert_branding_assets
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'branding-assets'
    and app_private.has_business_role(
      app_private.storage_business_id(name),
      array['owner', 'admin']::public.user_role[]
    )
  );

drop policy if exists storage_insert_document_files on storage.objects;
create policy storage_insert_document_files
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'document-files'
    and app_private.has_business_role(
      app_private.storage_business_id(name),
      array['owner', 'admin']::public.user_role[]
    )
  );

drop policy if exists storage_insert_email_attachments on storage.objects;
create policy storage_insert_email_attachments
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'email-attachments'
    and app_private.has_business_role(
      app_private.storage_business_id(name),
      array['owner', 'admin']::public.user_role[]
    )
  );

drop policy if exists storage_update_branding_assets on storage.objects;
create policy storage_update_branding_assets
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'branding-assets'
    and app_private.has_business_role(
      app_private.storage_business_id(name),
      array['owner', 'admin']::public.user_role[]
    )
  )
  with check (
    bucket_id = 'branding-assets'
    and app_private.has_business_role(
      app_private.storage_business_id(name),
      array['owner', 'admin']::public.user_role[]
    )
  );

drop policy if exists storage_update_document_files on storage.objects;
create policy storage_update_document_files
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'document-files'
    and app_private.has_business_role(
      app_private.storage_business_id(name),
      array['owner', 'admin']::public.user_role[]
    )
  )
  with check (
    bucket_id = 'document-files'
    and app_private.has_business_role(
      app_private.storage_business_id(name),
      array['owner', 'admin']::public.user_role[]
    )
  );

drop policy if exists storage_update_email_attachments on storage.objects;
create policy storage_update_email_attachments
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'email-attachments'
    and app_private.has_business_role(
      app_private.storage_business_id(name),
      array['owner', 'admin']::public.user_role[]
    )
  )
  with check (
    bucket_id = 'email-attachments'
    and app_private.has_business_role(
      app_private.storage_business_id(name),
      array['owner', 'admin']::public.user_role[]
    )
  );

drop policy if exists storage_delete_branding_assets on storage.objects;
create policy storage_delete_branding_assets
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'branding-assets'
    and app_private.has_business_role(
      app_private.storage_business_id(name),
      array['owner', 'admin']::public.user_role[]
    )
  );

drop policy if exists storage_delete_document_files on storage.objects;
create policy storage_delete_document_files
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'document-files'
    and app_private.has_business_role(
      app_private.storage_business_id(name),
      array['owner', 'admin']::public.user_role[]
    )
  );

drop policy if exists storage_delete_email_attachments on storage.objects;
create policy storage_delete_email_attachments
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'email-attachments'
    and app_private.has_business_role(
      app_private.storage_business_id(name),
      array['owner', 'admin']::public.user_role[]
    )
  );
