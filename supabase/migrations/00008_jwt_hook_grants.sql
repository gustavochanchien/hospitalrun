-- Allow the custom_access_token_hook (run as supabase_auth_admin) to
-- read the profiles table. Without this, the hook raises a permission
-- error on every token issuance and the client's getSession()/refresh
-- call fails, leaving the app stuck in isLoading.

grant usage on schema public to supabase_auth_admin;
grant select on public.profiles to supabase_auth_admin;

-- RLS policy: permit supabase_auth_admin to read any profile (it only
-- runs server-side inside the Auth hook, never as an end user).
drop policy if exists "auth_admin_read_profiles" on public.profiles;
create policy "auth_admin_read_profiles"
  on public.profiles
  as permissive
  for select
  to supabase_auth_admin
  using (true);
