-- RPC that lets a signed-in user create an org + profile for themselves
-- on demand. Runs as SECURITY DEFINER so it bypasses the INSERT-less RLS
-- on organizations and profiles. Idempotent: if the caller already has a
-- profile, returns the existing org_id without changes.

create or replace function public.bootstrap_current_user(
  org_name text default 'My Hospital'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  existing_org uuid;
  new_org_id uuid;
  user_email text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select org_id into existing_org from profiles where id = uid;
  if existing_org is not null then
    return existing_org;
  end if;

  select email into user_email from auth.users where id = uid;

  insert into organizations (name, slug)
    values (
      org_name,
      'org-' || substr(uid::text, 1, 8)
    )
    returning id into new_org_id;

  insert into profiles (id, org_id, role, full_name)
    values (
      uid,
      new_org_id,
      'admin',
      coalesce(user_email, 'Admin')
    );

  return new_org_id;
end;
$$;

grant execute on function public.bootstrap_current_user(text) to authenticated;
