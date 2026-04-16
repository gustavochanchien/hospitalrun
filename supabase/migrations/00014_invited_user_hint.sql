-- HospitalRun 3 — Invited-user hint for handle_new_user
--
-- When an admin creates a user via the invite-member edge function
-- (mode: 'create'), we want the new auth.users row to be attached to
-- the admin's existing org — NOT to spawn a fresh one. Extend
-- handle_new_user() to honor `invited_org_id` + `invited_role` hints
-- placed in raw_user_meta_data.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
  invited_org uuid;
  invited_role text;
begin
  if exists (select 1 from profiles where id = new.id) then
    return new;
  end if;

  invited_org := nullif(new.raw_user_meta_data ->> 'invited_org_id', '')::uuid;
  invited_role := nullif(new.raw_user_meta_data ->> 'invited_role', '');

  if invited_org is not null and exists (select 1 from organizations where id = invited_org) then
    insert into profiles (id, org_id, role, full_name)
      values (
        new.id,
        invited_org,
        coalesce(invited_role, 'user'),
        coalesce(new.raw_user_meta_data ->> 'full_name', new.email)
      );
    return new;
  end if;

  -- Fallback: self-signup path — spawn a new org for this user.
  insert into organizations (name, slug)
    values (
      coalesce(new.raw_user_meta_data ->> 'org_name', 'My Hospital'),
      coalesce(new.raw_user_meta_data ->> 'org_slug', 'org-' || substr(new.id::text, 1, 8))
    )
    returning id into new_org_id;

  insert into profiles (id, org_id, role, full_name)
    values (
      new.id,
      new_org_id,
      'admin',
      coalesce(new.raw_user_meta_data ->> 'full_name', new.email)
    );

  return new;
end;
$$;
