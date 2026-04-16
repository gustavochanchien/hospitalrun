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
  select org_id, role into user_org_id, user_role
    from profiles
    where id = (event ->> 'user_id')::uuid;

  claims := event -> 'claims';

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
