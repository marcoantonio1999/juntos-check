create extension if not exists "pgcrypto";

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  text text not null check (char_length(text) between 1 and 500),
  done boolean not null default false,
  owner text not null check (owner in ('Tu', 'Ella')),
  created_at timestamptz not null default now()
);

create index if not exists tasks_created_at_idx on public.tasks (created_at desc);

alter table public.tasks enable row level security;

drop policy if exists "tasks_anon_select" on public.tasks;
drop policy if exists "tasks_anon_insert" on public.tasks;
drop policy if exists "tasks_anon_update" on public.tasks;
drop policy if exists "tasks_anon_delete" on public.tasks;

create policy "tasks_anon_select" on public.tasks for select to anon using (true);
create policy "tasks_anon_insert" on public.tasks for insert to anon with check (true);
create policy "tasks_anon_update" on public.tasks for update to anon using (true) with check (true);
create policy "tasks_anon_delete" on public.tasks for delete to anon using (true);

alter publication supabase_realtime add table public.tasks;
