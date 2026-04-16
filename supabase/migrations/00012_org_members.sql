-- org_members: tracks pending + accepted invitations into an organization.
-- Accepted members are mirrored into `profiles` by the invite-member Edge Function.

create table if not exists public.org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  role text not null check (role in ('admin', 'doctor', 'nurse', 'user')),
  invited_email text not null,
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists org_members_org_email_idx
  on public.org_members (org_id, lower(invited_email));

create index if not exists org_members_user_idx on public.org_members (user_id);

alter table public.org_members enable row level security;

-- Only admins of the same org can see or modify invitations.
create policy "org_members_admin_select"
  on public.org_members
  for select
  to authenticated
  using (
    org_id = coalesce(
      (auth.jwt() ->> 'org_id')::uuid,
      (select p.org_id from public.profiles p where p.id = auth.uid())
    )
    and (
      (auth.jwt() ->> 'role') = 'admin'
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'admin' and p.org_id = org_members.org_id
      )
    )
  );

create policy "org_members_admin_insert"
  on public.org_members
  for insert
  to authenticated
  with check (
    org_id = coalesce(
      (auth.jwt() ->> 'org_id')::uuid,
      (select p.org_id from public.profiles p where p.id = auth.uid())
    )
    and (
      (auth.jwt() ->> 'role') = 'admin'
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'admin' and p.org_id = org_members.org_id
      )
    )
  );

create policy "org_members_admin_update"
  on public.org_members
  for update
  to authenticated
  using (
    (auth.jwt() ->> 'role') = 'admin'
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.org_id = org_members.org_id
    )
  )
  with check (
    (auth.jwt() ->> 'role') = 'admin'
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.org_id = org_members.org_id
    )
  );

create policy "org_members_admin_delete"
  on public.org_members
  for delete
  to authenticated
  using (
    (auth.jwt() ->> 'role') = 'admin'
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.org_id = org_members.org_id
    )
  );

-- Self-select: a user can see their own pending invite by email match.
create policy "org_members_self_select"
  on public.org_members
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or lower(invited_email) = lower((auth.jwt() ->> 'email'))
  );

grant select, insert, update, delete on public.org_members to authenticated;
