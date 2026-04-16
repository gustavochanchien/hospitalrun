-- Allow any authenticated user to always read their own profile row,
-- even when their org_id is not yet populated. The existing
-- "Users can view org profiles" policy requires the caller's own
-- org_id to match, which is a chicken-and-egg problem for users who
-- don't have a profile yet.

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles
  for select
  using (id = auth.uid());
