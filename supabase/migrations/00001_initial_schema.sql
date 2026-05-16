-- HospitalRun 3 — Squashed Schema (v3)
--
-- Single-file schema covering all tables, RLS, JWT hook, storage, and
-- feature flags, billing & payments. Run this once against a fresh
-- Supabase project. Do not hand-edit once applied to any live database;
-- add new numbered migrations instead.

-- ============================================================
-- Tables
-- ============================================================

create table organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz not null default now()
);

create table profiles (
  id          uuid primary key references auth.users on delete cascade,
  org_id      uuid not null references organizations on delete cascade,
  role        text not null default 'user' check (role in ('admin', 'user', 'nurse', 'doctor')),
  full_name   text not null,
  created_at  timestamptz not null default now()
);

create index idx_profiles_org_id on profiles (org_id);

create table patients (
  id                            uuid primary key default gen_random_uuid(),
  org_id                        uuid not null references organizations on delete cascade,
  mrn                           text,
  prefix                        text,
  given_name                    text not null,
  family_name                   text not null,
  suffix                        text,
  date_of_birth                 date,
  is_approximate_date_of_birth  boolean default false,
  sex                           text check (sex in ('male', 'female', 'other', 'unknown')),
  blood_type                    text,
  occupation                    text,
  preferred_language            text,
  phone                         text,
  email                         text,
  address                       jsonb,
  status                        text not null default 'active' check (status in ('active', 'inactive', 'deceased')),
  deleted_at                    timestamptz,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);

create index idx_patients_org_id on patients (org_id);
create index idx_patients_mrn on patients (org_id, mrn);
create index idx_patients_name on patients (org_id, family_name, given_name);

create table visits (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations on delete cascade,
  patient_id      uuid not null references patients on delete cascade,
  type            text,
  status          text not null default 'planned' check (status in ('planned', 'in-progress', 'finished', 'cancelled')),
  reason          text,
  location        text,
  start_datetime  timestamptz,
  end_datetime    timestamptz,
  notes           text,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_visits_org_patient on visits (org_id, patient_id);

create table appointments (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations on delete cascade,
  patient_id      uuid not null references patients on delete cascade,
  type            text,
  start_time      timestamptz not null,
  end_time        timestamptz not null,
  location        text,
  reason          text,
  requested_by    uuid references profiles,
  status          text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled', 'no-show')),
  notes           text,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_appointments_org on appointments (org_id);
create index idx_appointments_patient on appointments (org_id, patient_id);
create index idx_appointments_time on appointments (org_id, start_time);

create table labs (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations on delete cascade,
  patient_id      uuid not null references patients on delete cascade,
  visit_id        uuid references visits,
  code            text,
  type            text not null,
  status          text not null default 'requested' check (status in ('requested', 'completed', 'canceled')),
  requested_by    uuid references profiles,
  requested_at    timestamptz not null default now(),
  completed_at    timestamptz,
  canceled_at     timestamptz,
  result          text,
  notes           text,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_labs_org on labs (org_id);
create index idx_labs_patient on labs (org_id, patient_id);

create table medications (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations on delete cascade,
  patient_id      uuid not null references patients on delete cascade,
  visit_id        uuid references visits,
  name            text not null,
  status          text not null default 'draft' check (status in ('draft', 'active', 'on hold', 'canceled', 'completed', 'entered in error', 'stopped', 'unknown')),
  intent          text,
  priority        text,
  quantity        text,
  requested_by    uuid references profiles,
  start_date      date,
  end_date        date,
  notes           text,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_medications_org on medications (org_id);
create index idx_medications_patient on medications (org_id, patient_id);

create table incidents (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations on delete cascade,
  reported_by     uuid references profiles,
  reported_on     timestamptz not null default now(),
  patient_id      uuid references patients on delete set null,
  department      text,
  category        text,
  category_item   text,
  description     text not null,
  status          text not null default 'reported' check (status in ('reported', 'resolved')),
  resolved_on     timestamptz,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_incidents_org on incidents (org_id);

create table imaging (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations on delete cascade,
  patient_id      uuid not null references patients on delete cascade,
  visit_id        uuid references visits,
  code            text,
  type            text not null,
  status          text not null default 'requested' check (status in ('requested', 'completed', 'canceled')),
  requested_by    uuid references profiles,
  requested_on    timestamptz not null default now(),
  completed_on    timestamptz,
  canceled_on     timestamptz,
  notes           text,
  storage_path    text,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_imaging_org on imaging (org_id);
create index idx_imaging_patient on imaging (org_id, patient_id);

create table diagnoses (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations on delete cascade,
  patient_id      uuid not null references patients on delete cascade,
  visit_id        uuid references visits on delete set null,
  icd_code        text,
  description     text not null,
  status          text,
  onset_date      date,
  abatement_date  date,
  diagnosed_at    timestamptz,
  diagnosed_by    uuid references profiles,
  notes           text,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_diagnoses_org_patient on diagnoses (org_id, patient_id);
create index diagnoses_visit_id_idx on diagnoses (visit_id);

create table allergies (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations on delete cascade,
  patient_id      uuid not null references patients on delete cascade,
  allergen        text not null,
  reaction        text,
  severity        text check (severity in ('mild', 'moderate', 'severe')),
  noted_at        timestamptz,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_allergies_org_patient on allergies (org_id, patient_id);

create table notes (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations on delete cascade,
  patient_id      uuid not null references patients on delete cascade,
  visit_id        uuid references visits on delete set null,
  content         text not null,
  author_id       uuid references profiles,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_notes_org_patient on notes (org_id, patient_id);
create index notes_visit_id_idx on notes (visit_id);

create table related_persons (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations on delete cascade,
  patient_id      uuid not null references patients on delete cascade,
  given_name      text not null,
  family_name     text not null,
  relationship    text,
  phone           text,
  email           text,
  address         jsonb,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_related_persons_org_patient on related_persons (org_id, patient_id);

create table care_goals (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references organizations on delete cascade,
  patient_id          uuid not null references patients on delete cascade,
  description         text not null,
  start_date          date,
  target_date         date,
  status              text,
  achievement_status  text default 'in-progress' check (achievement_status in ('in-progress', 'improving', 'not-achieving', 'sustaining', 'achieved', 'not-attainable')),
  priority            text check (priority in ('low', 'medium', 'high')),
  notes               text,
  deleted_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_care_goals_org_patient on care_goals (org_id, patient_id);

create table care_plans (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations on delete cascade,
  patient_id      uuid not null references patients on delete cascade,
  diagnosis_id    uuid references diagnoses(id) on delete set null,
  title           text not null,
  description     text,
  intent          text,
  start_date      date,
  end_date        date,
  status          text not null default 'draft' check (status in ('draft', 'active', 'on-hold', 'revoked', 'completed', 'entered-in-error', 'unknown')),
  notes           text,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_care_plans_org_patient on care_plans (org_id, patient_id);

create table patient_history (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations on delete cascade,
  patient_id  uuid not null references patients on delete cascade,
  changed_by  uuid references profiles,
  changed_at  timestamptz not null default now(),
  field_name  text not null,
  old_value   text,
  new_value   text
);

create index idx_patient_history_org_patient on patient_history (org_id, patient_id);
create index idx_patient_history_changed_at on patient_history (patient_id, changed_at desc);

create table org_members (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,
  role          text not null check (role in ('admin', 'doctor', 'nurse', 'user')),
  invited_email text not null,
  invited_by    uuid references auth.users(id) on delete set null,
  invited_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index org_members_org_email_idx on org_members (org_id, lower(invited_email));
create index org_members_user_idx on org_members (user_id);

-- Feature flags: per-org enable + per-user grant.
create table org_features (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,
  feature    text not null,
  enabled    boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, feature)
);

create index org_features_org_idx on org_features (org_id);

-- Per-member feature grant within the org. Absent row means not granted.
-- Admins are implicitly granted (enforced client-side in useFeatureEnabled).
create table user_features (
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

create index user_features_user_org_idx on user_features (user_id, org_id);
create index user_features_org_idx on user_features (org_id);

-- Billing: charge item catalog.
create table charge_items (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  code        text not null,
  name        text not null,
  description text,
  unit_amount numeric(12,2) not null default 0,
  currency    text not null default 'USD',
  active      boolean not null default true,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index charge_items_org_idx on charge_items (org_id);
create unique index charge_items_org_code_uidx on charge_items (org_id, code) where deleted_at is null;

-- Patient-scoped invoice header.
create table invoices (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id) on delete cascade,
  patient_id     uuid not null references patients(id) on delete cascade,
  visit_id       uuid references visits(id) on delete set null,
  invoice_number text not null,
  status         text not null default 'draft'
                   check (status in ('draft','issued','partial','paid','void')),
  issued_at      timestamptz,
  due_at         timestamptz,
  currency       text not null default 'USD',
  subtotal       numeric(14,2) not null default 0,
  tax            numeric(14,2) not null default 0,
  discount       numeric(14,2) not null default 0,
  total          numeric(14,2) not null default 0,
  amount_paid    numeric(14,2) not null default 0,
  notes          text,
  deleted_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index invoices_org_idx       on invoices (org_id);
create index invoices_patient_idx   on invoices (patient_id);
create index invoices_status_idx    on invoices (status);
create unique index invoices_org_number_uidx on invoices (org_id, invoice_number) where deleted_at is null;

-- Denormalised lines linked to an invoice.
create table invoice_line_items (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id) on delete cascade,
  invoice_id     uuid not null references invoices(id) on delete cascade,
  charge_item_id uuid references charge_items(id) on delete set null,
  description    text not null,
  quantity       numeric(12,2) not null default 1,
  unit_amount    numeric(12,2) not null default 0,
  amount         numeric(14,2) not null default 0,
  deleted_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index invoice_line_items_org_idx     on invoice_line_items (org_id);
create index invoice_line_items_invoice_idx on invoice_line_items (invoice_id);

-- Money received against an invoice.
create table payments (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  invoice_id  uuid not null references invoices(id) on delete cascade,
  patient_id  uuid not null references patients(id) on delete cascade,
  amount      numeric(14,2) not null,
  method      text not null
                check (method in ('cash','card','bank-transfer','insurance','other')),
  received_at timestamptz not null default now(),
  reference   text,
  notes       text,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index payments_org_idx     on payments (org_id);
create index payments_invoice_idx on payments (invoice_id);
create index payments_patient_idx on payments (patient_id);

create table schema_meta (
  version    int primary key,
  applied_at timestamptz not null default now()
);

-- ============================================================
-- updated_at trigger
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_patients_updated_at            before update on patients            for each row execute function update_updated_at();
create trigger trg_visits_updated_at              before update on visits              for each row execute function update_updated_at();
create trigger trg_appointments_updated_at        before update on appointments        for each row execute function update_updated_at();
create trigger trg_labs_updated_at                before update on labs                for each row execute function update_updated_at();
create trigger trg_medications_updated_at         before update on medications         for each row execute function update_updated_at();
create trigger trg_incidents_updated_at           before update on incidents           for each row execute function update_updated_at();
create trigger trg_imaging_updated_at             before update on imaging             for each row execute function update_updated_at();
create trigger trg_diagnoses_updated_at           before update on diagnoses           for each row execute function update_updated_at();
create trigger trg_allergies_updated_at           before update on allergies           for each row execute function update_updated_at();
create trigger trg_notes_updated_at               before update on notes               for each row execute function update_updated_at();
create trigger trg_related_persons_updated_at     before update on related_persons     for each row execute function update_updated_at();
create trigger trg_care_goals_updated_at          before update on care_goals          for each row execute function update_updated_at();
create trigger trg_care_plans_updated_at          before update on care_plans          for each row execute function update_updated_at();
create trigger trg_org_features_updated_at        before update on org_features        for each row execute function update_updated_at();
create trigger trg_user_features_updated_at       before update on user_features       for each row execute function update_updated_at();
create trigger trg_charge_items_updated_at        before update on charge_items        for each row execute function update_updated_at();
create trigger trg_invoices_updated_at            before update on invoices            for each row execute function update_updated_at();
create trigger trg_invoice_line_items_updated_at  before update on invoice_line_items  for each row execute function update_updated_at();
create trigger trg_payments_updated_at            before update on payments            for each row execute function update_updated_at();

-- ============================================================
-- Helpers + JWT hook + auth bootstrap
-- ============================================================

-- Reads org_id from the JWT's app_metadata, falling back to profiles.
create or replace function public.org_id()
returns uuid as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid,
    (select org_id from profiles where id = auth.uid())
  );
$$ language sql stable security definer;

-- Custom Access Token hook: copy org_id + role from profiles into JWT
-- app_metadata. Wire up in the dashboard (Auth → Hooks).
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

-- Auto-create org + profile on signup. Honors invited_org_id /
-- invited_role hints from the invite-member edge function so admin-
-- created users join the inviter's org instead of spawning a new one.
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

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Client-callable bootstrap for users without a profile yet (used when the
-- handle_new_user trigger is bypassed, e.g. invite flows missing hints).
create or replace function public.bootstrap_current_user(org_name text default 'My Hospital')
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
    values (org_name, 'org-' || substr(uid::text, 1, 8))
    returning id into new_org_id;

  insert into profiles (id, org_id, role, full_name)
    values (uid, new_org_id, 'admin', coalesce(user_email, 'Admin'));

  return new_org_id;
end;
$$;

-- Frontend reads this via supabase.rpc('current_schema_version') for the
-- stale-DB upgrade banner.
create or replace function public.current_schema_version()
returns int
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(max(version), 0) from public.schema_meta;
$$;

-- ============================================================
-- Grants
-- ============================================================
grant usage on schema public to authenticated;

grant select, insert, update, delete on
  organizations,
  profiles,
  patients,
  visits,
  appointments,
  labs,
  medications,
  incidents,
  imaging,
  diagnoses,
  allergies,
  notes,
  related_persons,
  care_goals,
  care_plans,
  patient_history,
  org_members,
  org_features,
  user_features,
  charge_items,
  invoices,
  invoice_line_items,
  payments
to authenticated;

grant usage, select on all sequences in schema public to authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema public
  grant usage, select on sequences to authenticated;

-- The JWT hook runs as supabase_auth_admin and needs to read profiles.
grant usage on schema public to supabase_auth_admin;
grant select on public.profiles to supabase_auth_admin;

-- The hook is invoked by Supabase Auth; nobody else should call it.
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from public;
revoke execute on function public.custom_access_token_hook from anon;
revoke execute on function public.custom_access_token_hook from authenticated;

grant execute on function public.bootstrap_current_user(text) to authenticated;
grant execute on function public.current_schema_version() to authenticated;

-- ============================================================
-- RLS
-- ============================================================
alter table organizations       enable row level security;
alter table profiles            enable row level security;
alter table patients            enable row level security;
alter table visits              enable row level security;
alter table appointments        enable row level security;
alter table labs                enable row level security;
alter table medications         enable row level security;
alter table incidents           enable row level security;
alter table imaging             enable row level security;
alter table diagnoses           enable row level security;
alter table allergies           enable row level security;
alter table notes               enable row level security;
alter table related_persons     enable row level security;
alter table care_goals          enable row level security;
alter table care_plans          enable row level security;
alter table patient_history     enable row level security;
alter table org_members         enable row level security;
alter table schema_meta         enable row level security;
alter table org_features        enable row level security;
alter table user_features       enable row level security;
alter table charge_items        enable row level security;
alter table invoices            enable row level security;
alter table invoice_line_items  enable row level security;
alter table payments            enable row level security;

-- Organizations: members read; admins update.
create policy "Users can view own org"
  on organizations for select
  using (id = public.org_id());

create policy "Admins can update own org"
  on organizations for update
  using (
    id = public.org_id()
    and exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  )
  with check (id = public.org_id());

-- Profiles: org-mates read each other; users read+update self; the JWT
-- hook (running as supabase_auth_admin) reads any profile.
create policy "Users can view org profiles"
  on profiles for select
  using (org_id = public.org_id());

create policy "Users can view own profile"
  on profiles for select
  using (id = auth.uid());

create policy "Users can update own profile"
  on profiles for update
  using (id = auth.uid());

create policy "auth_admin_read_profiles"
  on profiles
  as permissive
  for select
  to supabase_auth_admin
  using (true);

-- Org-scoped tables: select/insert/update gated on org_id().
-- Deletes are soft (deleted_at); no delete policy is intentional.
create policy "Org isolation select" on patients        for select using (org_id = public.org_id());
create policy "Org isolation insert" on patients        for insert with check (org_id = public.org_id());
create policy "Org isolation update" on patients        for update using (org_id = public.org_id());

create policy "Org isolation select" on visits          for select using (org_id = public.org_id());
create policy "Org isolation insert" on visits          for insert with check (org_id = public.org_id());
create policy "Org isolation update" on visits          for update using (org_id = public.org_id());

create policy "Org isolation select" on appointments    for select using (org_id = public.org_id());
create policy "Org isolation insert" on appointments    for insert with check (org_id = public.org_id());
create policy "Org isolation update" on appointments    for update using (org_id = public.org_id());

create policy "Org isolation select" on labs            for select using (org_id = public.org_id());
create policy "Org isolation insert" on labs            for insert with check (org_id = public.org_id());
create policy "Org isolation update" on labs            for update using (org_id = public.org_id());

create policy "Org isolation select" on medications     for select using (org_id = public.org_id());
create policy "Org isolation insert" on medications     for insert with check (org_id = public.org_id());
create policy "Org isolation update" on medications     for update using (org_id = public.org_id());

create policy "Org isolation select" on incidents       for select using (org_id = public.org_id());
create policy "Org isolation insert" on incidents       for insert with check (org_id = public.org_id());
create policy "Org isolation update" on incidents       for update using (org_id = public.org_id());

create policy "Org isolation select" on imaging         for select using (org_id = public.org_id());
create policy "Org isolation insert" on imaging         for insert with check (org_id = public.org_id());
create policy "Org isolation update" on imaging         for update using (org_id = public.org_id());

create policy "Org isolation select" on diagnoses       for select using (org_id = public.org_id());
create policy "Org isolation insert" on diagnoses       for insert with check (org_id = public.org_id());
create policy "Org isolation update" on diagnoses       for update using (org_id = public.org_id());

create policy "Org isolation select" on allergies       for select using (org_id = public.org_id());
create policy "Org isolation insert" on allergies       for insert with check (org_id = public.org_id());
create policy "Org isolation update" on allergies       for update using (org_id = public.org_id());

create policy "Org isolation select" on notes           for select using (org_id = public.org_id());
create policy "Org isolation insert" on notes           for insert with check (org_id = public.org_id());
create policy "Org isolation update" on notes           for update using (org_id = public.org_id());

create policy "Org isolation select" on related_persons for select using (org_id = public.org_id());
create policy "Org isolation insert" on related_persons for insert with check (org_id = public.org_id());
create policy "Org isolation update" on related_persons for update using (org_id = public.org_id());

create policy "Org isolation select" on care_goals      for select using (org_id = public.org_id());
create policy "Org isolation insert" on care_goals      for insert with check (org_id = public.org_id());
create policy "Org isolation update" on care_goals      for update using (org_id = public.org_id());

create policy "Org isolation select" on care_plans      for select using (org_id = public.org_id());
create policy "Org isolation insert" on care_plans      for insert with check (org_id = public.org_id());
create policy "Org isolation update" on care_plans      for update using (org_id = public.org_id());

-- patient_history is read+insert only (immutable audit log).
create policy "Org isolation select" on patient_history for select using (org_id = public.org_id());
create policy "Org isolation insert" on patient_history for insert with check (org_id = public.org_id());

-- org_members: only org admins can read/write. Self-select lets a
-- newly-signed-up user find their pending invite by email.
create policy "org_members_admin_select"
  on org_members for select to authenticated
  using (
    org_id = public.org_id()
    and exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.org_id = org_members.org_id
    )
  );

create policy "org_members_admin_insert"
  on org_members for insert to authenticated
  with check (
    org_id = public.org_id()
    and exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.org_id = org_members.org_id
    )
  );

create policy "org_members_admin_update"
  on org_members for update to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.org_id = org_members.org_id
    )
  )
  with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.org_id = org_members.org_id
    )
  );

create policy "org_members_admin_delete"
  on org_members for delete to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.org_id = org_members.org_id
    )
  );

create policy "org_members_self_select"
  on org_members for select to authenticated
  using (
    user_id = auth.uid()
    or lower(invited_email) = lower((auth.jwt() ->> 'email'))
  );

-- schema_meta: any signed-in user can read the version. Writes are
-- service-role only (deny by default — no insert/update/delete policy).
create policy schema_meta_select on schema_meta
  for select to authenticated using (true);

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

-- charge_items
create policy "Org members read charge_items"
  on charge_items for select
  using (org_id = public.org_id());

create policy "Org members insert charge_items"
  on charge_items for insert
  with check (org_id = public.org_id());

create policy "Org members update charge_items"
  on charge_items for update
  using (org_id = public.org_id())
  with check (org_id = public.org_id());

create policy "Org members delete charge_items"
  on charge_items for delete
  using (org_id = public.org_id());

-- invoices
create policy "Org members read invoices"
  on invoices for select
  using (org_id = public.org_id());

create policy "Org members insert invoices"
  on invoices for insert
  with check (org_id = public.org_id());

create policy "Org members update invoices"
  on invoices for update
  using (org_id = public.org_id())
  with check (org_id = public.org_id());

create policy "Org members delete invoices"
  on invoices for delete
  using (org_id = public.org_id());

-- invoice_line_items
create policy "Org members read invoice_line_items"
  on invoice_line_items for select
  using (org_id = public.org_id());

create policy "Org members insert invoice_line_items"
  on invoice_line_items for insert
  with check (org_id = public.org_id());

create policy "Org members update invoice_line_items"
  on invoice_line_items for update
  using (org_id = public.org_id())
  with check (org_id = public.org_id());

create policy "Org members delete invoice_line_items"
  on invoice_line_items for delete
  using (org_id = public.org_id());

-- payments
create policy "Org members read payments"
  on payments for select
  using (org_id = public.org_id());

create policy "Org members insert payments"
  on payments for insert
  with check (org_id = public.org_id());

create policy "Org members update payments"
  on payments for update
  using (org_id = public.org_id())
  with check (org_id = public.org_id());

create policy "Org members delete payments"
  on payments for delete
  using (org_id = public.org_id());

-- ============================================================
-- Storage: imaging bucket (private, org-scoped path prefix)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('imaging', 'imaging', false)
on conflict (id) do nothing;

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

-- ============================================================
-- Schema version marker — must be last.
-- ============================================================
insert into schema_meta (version) values (3)
  on conflict (version) do nothing;
