-- Allow admins of an org to UPDATE that org's row (rename, etc).
-- Existing policy only covered SELECT, so admin renames silently fail.

drop policy if exists "Admins can update own org" on public.organizations;
create policy "Admins can update own org"
  on public.organizations
  for update
  using (
    id = public.org_id()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    id = public.org_id()
  );
