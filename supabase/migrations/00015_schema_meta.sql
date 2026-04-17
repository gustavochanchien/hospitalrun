-- HospitalRun 3 — Schema version tracking
--
-- One-row-per-version table used by both the developer flow
-- (supabase db push) and the browser-only deploy flow (pasting
-- supabase/deploy.sql into the SQL Editor) to detect whether the
-- schema has already been applied and to drive the in-app
-- "upgrade required" guard.

create table if not exists public.schema_meta (
  version int primary key,
  applied_at timestamptz not null default now()
);

alter table public.schema_meta enable row level security;

-- Everyone authenticated can read the current version — the frontend
-- uses it for the schema-version guard. Nothing sensitive here.
drop policy if exists schema_meta_select on public.schema_meta;
create policy schema_meta_select on public.schema_meta
  for select
  to authenticated
  using (true);

-- Writes are service-role only (via migrations or deploy.sql).
-- No insert/update/delete policy for authenticated = deny by default.

insert into public.schema_meta (version) values (1)
  on conflict (version) do nothing;
