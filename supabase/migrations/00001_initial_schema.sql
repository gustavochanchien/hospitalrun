-- HospitalRun 3 — Squashed Schema (v4)
--
-- Single-file schema covering all tables, RLS, JWT hook, storage,
-- feature flags, billing & payments, and inventory. Run this once
-- against a fresh Supabase project. Do not hand-edit once applied to
-- any live database; add new numbered migrations instead.

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
  role        text not null default 'user',
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
  marital_status                text check (marital_status in ('single', 'partnered', 'married', 'separated', 'divorced', 'widowed')),
  education_level               text check (education_level in ('none', 'primary', 'secondary', 'tertiary', 'unknown')),
  national_id                   text,
  national_id_type              text,
  number_of_children            integer check (number_of_children >= 0),
  number_of_household_members   integer check (number_of_household_members >= 0),
  is_head_of_household          boolean not null default false,
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
  numeric_value   numeric,
  unit            text,
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

-- Vitals — discrete clinical readings recorded against a patient (optionally
-- linked to a visit). Numeric columns are all `numeric` to keep small decimals
-- like 36.7 °C or 12.3 kg exact; bounds are intentionally permissive (real-world
-- pediatric/geriatric readings push past textbook ranges).
create table vitals (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references organizations on delete cascade,
  patient_id            uuid not null references patients on delete cascade,
  visit_id              uuid references visits on delete set null,
  recorded_at           timestamptz not null,
  recorded_by           uuid references profiles,
  height_cm             numeric(5,1),
  weight_kg             numeric(5,2),
  temperature_c         numeric(4,1),
  heart_rate            integer,
  respiratory_rate      integer,
  systolic              integer,
  diastolic             integer,
  oxygen_sat            integer check (oxygen_sat is null or (oxygen_sat between 0 and 100)),
  pain_scale            integer check (pain_scale is null or (pain_scale between 0 and 10)),
  head_circumference_cm numeric(4,1),
  notes                 text,
  deleted_at            timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_vitals_org_patient on vitals (org_id, patient_id);
create index idx_vitals_patient_recorded_at on vitals (patient_id, recorded_at desc);

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
  address             jsonb,
  linked_patient_id   uuid references patients on delete set null,
  is_primary_contact  boolean not null default false,
  deleted_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_related_persons_org_patient on related_persons (org_id, patient_id);
create index idx_related_persons_linked_patient on related_persons (org_id, linked_patient_id) where linked_patient_id is not null;

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

-- HIPAA §164.312(b) audit controls. Append-only: no UPDATE/DELETE policies
-- below means RLS denies both. Identity columns (user_id, user_role,
-- user_email, org_id) are sealed by a BEFORE INSERT trigger from auth.uid()
-- so a client cannot forge them.
create table access_logs (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete set null,
  user_email      text,
  user_role       text not null,
  action          text not null check (action in
                    ('view','list','search','export','print','create','update','delete')),
  resource_type   text not null,
  resource_id     uuid,
  patient_id      uuid,
  context         jsonb,
  client_id       text,
  occurred_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index idx_access_logs_org_patient on access_logs (org_id, patient_id, occurred_at desc);
create index idx_access_logs_org_user    on access_logs (org_id, user_id,    occurred_at desc);
create index idx_access_logs_org_time    on access_logs (org_id, occurred_at desc);

create table org_members (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,
  role          text not null,
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

-- Roles: per-org role definitions with editable permission sets.
-- The 6 built-in role rows (admin, doctor, nurse, user, check_in_desk,
-- pharmacist) are seeded by bootstrap_current_user at org creation.
-- `admin` has is_locked=true and cannot be edited or deleted — RLS checks
-- role = 'admin' elsewhere, so renaming/removing it would break auth.
-- `permissions` is an array of permission keys; the TS source of truth is
-- src/lib/permissions.ts (BUILTIN_ROLE_DEFAULTS). Admin's permissions
-- column is cosmetic — the client treats admin as "always true".
create table org_roles (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  role_key      text not null,
  label         text not null,
  permissions   text[] not null default '{}',
  is_builtin    boolean not null default false,
  is_locked     boolean not null default false,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (org_id, role_key)
);

create index org_roles_org_idx on org_roles (org_id);

-- Defense in depth: even an admin who bypasses the UI can't mutate
-- a locked row. Used to protect the admin role.
create or replace function public.org_roles_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' and old.is_locked then
    raise exception 'role % is locked and cannot be deleted', old.role_key;
  end if;
  if tg_op = 'UPDATE' and old.is_locked then
    if new.role_key <> old.role_key
       or new.is_locked = false
       or new.is_builtin <> old.is_builtin then
      raise exception 'role % is locked and cannot be modified', old.role_key;
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger org_roles_guard_trigger
  before update or delete on org_roles
  for each row execute function public.org_roles_guard();

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

-- Inventory catalog: one row per stockable consumable.
create table inventory_items (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id) on delete cascade,
  sku            text not null,
  name           text not null,
  description    text,
  unit           text not null default 'each',
  on_hand        numeric(14,2) not null default 0,
  reorder_level  numeric(14,2) not null default 0,
  unit_cost      numeric(12,2) not null default 0,
  currency       text not null default 'USD',
  active         boolean not null default true,
  deleted_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index inventory_items_org_idx on inventory_items (org_id);
create unique index inventory_items_org_sku_uidx on inventory_items (org_id, sku) where deleted_at is null;

-- Stock movements. `on_hand` on inventory_items is denormalised from the
-- sum of these transactions and kept fresh by the trigger below.
create table inventory_transactions (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references organizations(id) on delete cascade,
  inventory_item_id   uuid not null references inventory_items(id) on delete cascade,
  kind                text not null
                        check (kind in ('receive','dispense','adjust','transfer','waste')),
  quantity            numeric(14,2) not null,
  unit_cost           numeric(12,2),
  reference           text,
  patient_id          uuid references patients(id) on delete set null,
  medication_id       uuid references medications(id) on delete set null,
  occurred_at         timestamptz not null default now(),
  recorded_by         uuid references profiles(id) on delete set null,
  notes               text,
  deleted_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index inventory_transactions_org_idx     on inventory_transactions (org_id);
create index inventory_transactions_item_idx    on inventory_transactions (inventory_item_id, occurred_at desc);
create index inventory_transactions_patient_idx on inventory_transactions (org_id, patient_id);

-- Adds an optional link from a medication request to a stock item so a
-- dispense transaction can be auto-written when the inventory flag is on.
alter table medications
  add column inventory_item_id uuid references inventory_items(id) on delete set null;

create index medications_inventory_item_idx on medications (inventory_item_id) where inventory_item_id is not null;

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
create trigger trg_vitals_updated_at              before update on vitals              for each row execute function update_updated_at();
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
create trigger trg_inventory_items_updated_at     before update on inventory_items     for each row execute function update_updated_at();
create trigger trg_inventory_transactions_updated_at before update on inventory_transactions for each row execute function update_updated_at();

-- ============================================================
-- Inventory stock-level trigger
-- ============================================================
-- Keeps inventory_items.on_hand in sync with the net signed sum of
-- non-deleted inventory_transactions. `receive` adds; `adjust` is signed
-- as supplied by the client (positive adds, negative removes); every
-- other kind subtracts. Soft-delete of a transaction reverses its effect.
create or replace function public.apply_inventory_transaction()
returns trigger
language plpgsql
as $$
declare
  delta numeric(14,2) := 0;
  signed_old numeric(14,2) := 0;
  signed_new numeric(14,2) := 0;
begin
  if (tg_op = 'INSERT') then
    if new.deleted_at is null then
      delta := case when new.kind in ('receive','adjust') then new.quantity else -new.quantity end;
      update inventory_items
        set on_hand = on_hand + delta
        where id = new.inventory_item_id;
    end if;
    return new;
  elsif (tg_op = 'UPDATE') then
    if old.deleted_at is null then
      signed_old := case when old.kind in ('receive','adjust') then old.quantity else -old.quantity end;
    end if;
    if new.deleted_at is null then
      signed_new := case when new.kind in ('receive','adjust') then new.quantity else -new.quantity end;
    end if;
    if old.inventory_item_id = new.inventory_item_id then
      update inventory_items
        set on_hand = on_hand + (signed_new - signed_old)
        where id = new.inventory_item_id;
    else
      update inventory_items set on_hand = on_hand - signed_old where id = old.inventory_item_id;
      update inventory_items set on_hand = on_hand + signed_new where id = new.inventory_item_id;
    end if;
    return new;
  elsif (tg_op = 'DELETE') then
    if old.deleted_at is null then
      delta := case when old.kind in ('receive','adjust') then old.quantity else -old.quantity end;
      update inventory_items
        set on_hand = on_hand - delta
        where id = old.inventory_item_id;
    end if;
    return old;
  end if;
  return null;
end;
$$;

create trigger trg_inventory_transactions_apply
  after insert or update or delete on inventory_transactions
  for each row execute function public.apply_inventory_transaction();

-- ============================================================
-- Access-log sealer
-- ============================================================
-- BEFORE INSERT on access_logs: overwrite identity-bearing columns with
-- values derived from auth.uid() so a malicious client cannot forge who
-- they are in the audit trail. Combined with the absence of UPDATE/DELETE
-- policies, this makes access_logs append-only and tamper-resistant.
create or replace function public.access_logs_seal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prof_role  text;
  prof_email text;
  prof_org   uuid;
begin
  select p.role, u.email, p.org_id
    into prof_role, prof_email, prof_org
    from profiles p
    join auth.users u on u.id = p.id
    where p.id = auth.uid();

  new.user_id    := auth.uid();
  new.user_role  := coalesce(prof_role, 'unknown');
  new.user_email := prof_email;
  new.org_id     := coalesce(prof_org, new.org_id);
  return new;
end;
$$;

create trigger trg_access_logs_seal
  before insert on access_logs
  for each row execute function public.access_logs_seal();

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

  -- Seed the 6 built-in roles. Defaults mirror BUILTIN_ROLE_DEFAULTS
  -- in src/lib/permissions.ts — keep both in sync. Admin is locked and
  -- its permissions array is cosmetic (client always returns true).
  insert into org_roles (org_id, role_key, label, permissions, is_builtin, is_locked) values
    (new_org_id, 'admin', 'Admin', array[
      'read:patients','write:patients','read:appointments','write:appointments','delete:appointment',
      'write:allergy','write:diagnosis','read:labs','write:labs','complete:lab','cancel:lab',
      'read:medications','write:medications','complete:medication','cancel:medication',
      'read:imaging','write:imaging','read:incidents','write:incident','resolve:incident',
      'read:incident_widgets','write:care_plan','read:care_plan','write:care_goal','read:care_goal',
      'write:visit','read:visit','write:note','write:related_person','read:settings','write:settings',
      'read:billing','write:billing','void:invoice','record:payment','manage:charge_items',
      'read:inventory','write:inventory','adjust:stock','receive:stock',
      'read:vitals','write:vitals',
      'read:audit_log','export:audit_log','manage:roles'
    ], true, true),
    (new_org_id, 'doctor', 'Doctor', array[
      'read:patients','write:patients','read:appointments','write:appointments','delete:appointment',
      'write:allergy','write:diagnosis','read:labs','write:labs','complete:lab','cancel:lab',
      'read:medications','write:medications','complete:medication','cancel:medication',
      'read:imaging','write:imaging','read:incidents','write:incident','resolve:incident',
      'read:incident_widgets','write:care_plan','read:care_plan','write:care_goal','read:care_goal',
      'write:visit','read:visit','write:note','write:related_person',
      'read:billing','write:billing','record:payment',
      'read:inventory','write:inventory','receive:stock',
      'read:vitals','write:vitals'
    ], true, false),
    (new_org_id, 'nurse', 'Nurse', array[
      'read:patients','write:patients','read:appointments','write:appointments','delete:appointment',
      'write:allergy','write:diagnosis','read:labs','write:labs','complete:lab','cancel:lab',
      'read:medications','write:medications','complete:medication','cancel:medication',
      'read:imaging','write:imaging','read:incidents','write:incident','resolve:incident',
      'read:incident_widgets','write:care_plan','read:care_plan','write:care_goal','read:care_goal',
      'write:visit','read:visit','write:note','write:related_person',
      'read:billing','write:billing','record:payment',
      'read:inventory','write:inventory','receive:stock',
      'read:vitals','write:vitals'
    ], true, false),
    (new_org_id, 'user', 'Viewer', array[
      'read:patients','read:appointments','read:labs','read:medications','read:imaging',
      'read:incidents','read:care_plan','read:care_goal','read:visit','read:billing','read:inventory',
      'read:vitals'
    ], true, false),
    (new_org_id, 'check_in_desk', 'Check-In Desk', array[
      'read:patients','write:patients','read:appointments','write:appointments','delete:appointment',
      'write:related_person','read:visit','read:billing','read:vitals'
    ], true, false),
    (new_org_id, 'pharmacist', 'Pharmacist', array[
      'read:patients','read:medications','write:medications','complete:medication','cancel:medication',
      'read:inventory','write:inventory','adjust:stock','receive:stock','read:visit'
    ], true, false);

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
  vitals,
  notes,
  related_persons,
  care_goals,
  care_plans,
  patient_history,
  access_logs,
  org_members,
  org_features,
  user_features,
  org_roles,
  charge_items,
  invoices,
  invoice_line_items,
  payments,
  inventory_items,
  inventory_transactions
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
alter table vitals              enable row level security;
alter table notes               enable row level security;
alter table related_persons     enable row level security;
alter table care_goals          enable row level security;
alter table care_plans          enable row level security;
alter table patient_history     enable row level security;
alter table access_logs         enable row level security;
alter table org_members         enable row level security;
alter table schema_meta         enable row level security;
alter table org_features        enable row level security;
alter table user_features       enable row level security;
alter table charge_items        enable row level security;
alter table invoices            enable row level security;
alter table invoice_line_items  enable row level security;
alter table payments            enable row level security;
alter table inventory_items          enable row level security;
alter table inventory_transactions   enable row level security;

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

create policy "Org isolation select" on vitals          for select using (org_id = public.org_id());
create policy "Org isolation insert" on vitals          for insert with check (org_id = public.org_id());
create policy "Org isolation update" on vitals          for update using (org_id = public.org_id());

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

-- access_logs: admin-only SELECT, self-INSERT for any authenticated org
-- member. No UPDATE/DELETE policies → RLS denies → append-only.
create policy "access_logs_admin_select"
  on access_logs for select to authenticated
  using (
    org_id = public.org_id()
    and exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and p.org_id = access_logs.org_id
    )
  );

create policy "access_logs_self_insert"
  on access_logs for insert to authenticated
  with check (
    org_id = public.org_id()
    and user_id = auth.uid()
  );

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

-- org_roles: everyone in the org reads (so usePermission can resolve any
-- teammate's role); only admins write. The org_roles_guard trigger above
-- prevents anyone — admin included — from touching locked rows.
alter table org_roles enable row level security;

create policy "Org members read org_roles"
  on org_roles for select
  using (org_id = public.org_id());

create policy "Admins insert org_roles"
  on org_roles for insert
  with check (
    org_id = public.org_id()
    and exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.org_id = org_roles.org_id
    )
  );

create policy "Admins update org_roles"
  on org_roles for update
  using (
    org_id = public.org_id()
    and exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.org_id = org_roles.org_id
    )
  )
  with check (org_id = public.org_id());

create policy "Admins delete org_roles"
  on org_roles for delete
  using (
    org_id = public.org_id()
    and exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.org_id = org_roles.org_id
    )
  );

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

-- inventory_items
create policy "Org members read inventory_items"
  on inventory_items for select
  using (org_id = public.org_id());

create policy "Org members insert inventory_items"
  on inventory_items for insert
  with check (org_id = public.org_id());

create policy "Org members update inventory_items"
  on inventory_items for update
  using (org_id = public.org_id())
  with check (org_id = public.org_id());

create policy "Org members delete inventory_items"
  on inventory_items for delete
  using (org_id = public.org_id());

-- inventory_transactions
create policy "Org members read inventory_transactions"
  on inventory_transactions for select
  using (org_id = public.org_id());

create policy "Org members insert inventory_transactions"
  on inventory_transactions for insert
  with check (org_id = public.org_id());

create policy "Org members update inventory_transactions"
  on inventory_transactions for update
  using (org_id = public.org_id())
  with check (org_id = public.org_id());

create policy "Org members delete inventory_transactions"
  on inventory_transactions for delete
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
insert into schema_meta (version) values (6)
  on conflict (version) do nothing;
