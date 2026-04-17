-- HospitalRun 3 — Schema version RPC
--
-- Exposes the current schema version to authenticated clients so the
-- frontend can detect a stale-DB-vs-new-frontend mismatch and show
-- the "Upgrade required" screen with a pointer to DEPLOY.md.

create or replace function public.current_schema_version()
returns int
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(max(version), 0) from public.schema_meta;
$$;

grant execute on function public.current_schema_version() to authenticated;
