-- HospitalRun 3 — Custom JWT Claims
-- Injects org_id and role into the JWT via app_metadata so RLS can read them.

-- ============================================================
-- Hook: on every sign-in, copy org_id + role from profiles → JWT
-- This uses Supabase's custom access token hook pattern.
-- ============================================================

-- Function that Supabase calls to customize the JWT
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  claims jsonb;
  user_org_id uuid;
  user_role text;
begin
  -- Get org_id and role from the profiles table
  select org_id, role into user_org_id, user_role
    from profiles
    where id = (event ->> 'user_id')::uuid;

  -- Get existing claims
  claims := event -> 'claims';

  -- If the user has a profile, inject org_id and role
  if user_org_id is not null then
    claims := jsonb_set(claims, '{app_metadata}',
      coalesce(claims -> 'app_metadata', '{}'::jsonb) ||
      jsonb_build_object('org_id', user_org_id, 'role', user_role)
    );
    event := jsonb_set(event, '{claims}', claims);
  end if;

  return event;
end;
$$;

-- Grant execute to supabase_auth_admin so the hook can be called
grant execute on function public.custom_access_token_hook to supabase_auth_admin;

-- Revoke from public
revoke execute on function public.custom_access_token_hook from public;
revoke execute on function public.custom_access_token_hook from anon;
revoke execute on function public.custom_access_token_hook from authenticated;

-- ============================================================
-- Helper: seed a test org + user profile after sign-up
-- Auto-creates an org and profile when a new user signs up,
-- if they don't already have one.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
begin
  -- Check if user already has a profile
  if exists (select 1 from profiles where id = new.id) then
    return new;
  end if;

  -- Create a default organization for the user
  insert into organizations (name, slug)
    values (
      coalesce(new.raw_user_meta_data ->> 'org_name', 'My Hospital'),
      coalesce(new.raw_user_meta_data ->> 'org_slug', 'org-' || substr(new.id::text, 1, 8))
    )
    returning id into new_org_id;

  -- Create the user's profile
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

-- Trigger on auth.users
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
