-- 202604100001_runtime_app_states.sql
-- Generic per-user runtime state persistence for frontend modules.

create table if not exists public.runtime_app_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  state_key text not null check (char_length(state_key) > 0 and char_length(state_key) <= 120),
  state_json jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint runtime_app_states_user_key_unique unique (user_id, state_key)
);

create index if not exists idx_runtime_app_states_user on public.runtime_app_states(user_id);

alter table public.runtime_app_states enable row level security;

drop policy if exists runtime_states_select_own on public.runtime_app_states;
create policy runtime_states_select_own
  on public.runtime_app_states
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists runtime_states_insert_own on public.runtime_app_states;
create policy runtime_states_insert_own
  on public.runtime_app_states
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists runtime_states_update_own on public.runtime_app_states;
create policy runtime_states_update_own
  on public.runtime_app_states
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists runtime_states_delete_own on public.runtime_app_states;
create policy runtime_states_delete_own
  on public.runtime_app_states
  for delete
  to authenticated
  using (user_id = auth.uid());

create or replace function app_private.runtime_states_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_runtime_app_states_set_updated_at on public.runtime_app_states;
create trigger trg_runtime_app_states_set_updated_at
before update on public.runtime_app_states
for each row
execute function app_private.runtime_states_set_updated_at();
