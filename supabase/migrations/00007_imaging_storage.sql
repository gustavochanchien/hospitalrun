-- HospitalRun 3 — Imaging Storage bucket + org-scoped RLS
-- Run AFTER 00006_grant_authenticated.sql

-- ============================================================
-- Private bucket for imaging files
-- ============================================================
insert into storage.buckets (id, name, public)
values ('imaging', 'imaging', false)
on conflict (id) do nothing;

-- ============================================================
-- RLS on storage.objects for the imaging bucket.
-- Path convention: {org_id}/{imaging_id}/{filename}
-- Users can only touch files whose first path segment matches their org_id.
-- ============================================================
create policy "imaging: read own org files"
  on storage.objects for select
  using (
    bucket_id = 'imaging'
    and (storage.foldername(name))[1] = public.org_id()::text
  );

create policy "imaging: insert own org files"
  on storage.objects for insert
  with check (
    bucket_id = 'imaging'
    and (storage.foldername(name))[1] = public.org_id()::text
    and auth.uid() = owner
  );

create policy "imaging: update own org files"
  on storage.objects for update
  using (
    bucket_id = 'imaging'
    and (storage.foldername(name))[1] = public.org_id()::text
  )
  with check (
    bucket_id = 'imaging'
    and (storage.foldername(name))[1] = public.org_id()::text
  );

create policy "imaging: delete own org files"
  on storage.objects for delete
  using (
    bucket_id = 'imaging'
    and (storage.foldername(name))[1] = public.org_id()::text
  );
