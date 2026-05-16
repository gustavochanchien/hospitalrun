-- ============================================================
-- 00002_feature_flags.sql
-- Two-tier feature gating: per-org enable + per-user grant.
-- ============================================================

-- org_features: which features are enabled for the org as a whole.
create table if not exists org_features (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,
  feature    text not null,
  enabled    boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, feature)
);

create index if not exists org_features_org_idx on org_features (org_id);

-- user_features: per-member grant within the org. Absent row ⇒ not granted.
-- Admins implicitly granted (enforced client-side in useFeatureEnabled).
create table if not exists user_features (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  org_id     uuid not null references organizations(id) on delete cascade,
  feature    text not null,
  granted    boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, org_id, feature)
);

create index if not exists user_features_user_org_idx on user_features (user_id, org_id);
create index if not exists user_features_org_idx on user_features (org_id);

-- Reuse the v1 updated_at trigger function.
create trigger trg_org_features_updated_at  before update on org_features  for each row execute function update_updated_at();
create trigger trg_user_features_updated_at before update on user_features for each row execute function update_updated_at();

-- ============================================================
-- RLS
-- ============================================================
alter table org_features  enable row level security;
alter table user_features enable row level security;

-- org_features: everyone in the org reads; only admins write.
create policy "Org members read org_features"
  on org_features for select
  using (org_id = public.org_id());

create policy "Admins insert org_features"
  on org_features for insert
  with check (
    org_id = public.org_id()
    and exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.org_id = org_features.org_id
    )
  );

create policy "Admins update org_features"
  on org_features for update
  using (
    org_id = public.org_id()
    and exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.org_id = org_features.org_id
    )
  )
  with check (org_id = public.org_id());

-- user_features: a user reads their own grants; admins read+write all in org.
create policy "Users read own feature grants"
  on user_features for select
  using (user_id = auth.uid() and org_id = public.org_id());

create policy "Admins read all user_features in org"
  on user_features for select
  using (
    org_id = public.org_id()
    and exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.org_id = user_features.org_id
    )
  );

create policy "Admins insert user_features"
  on user_features for insert
  with check (
    org_id = public.org_id()
    and exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.org_id = user_features.org_id
    )
  );

create policy "Admins update user_features"
  on user_features for update
  using (
    org_id = public.org_id()
    and exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.org_id = user_features.org_id
    )
  )
  with check (org_id = public.org_id());

-- ============================================================
-- Grants
-- ============================================================
grant select, insert, update, delete on org_features, user_features to authenticated;

-- ============================================================
-- Schema version bump
-- ============================================================
insert into schema_meta (version) values (2)
  on conflict (version) do nothing;
