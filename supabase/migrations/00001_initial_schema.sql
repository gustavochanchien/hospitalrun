-- HospitalRun 3 — Initial Database Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- ============================================================
-- Organizations
-- ============================================================
create table organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- Profiles (extends auth.users)
-- ============================================================
create table profiles (
  id          uuid primary key references auth.users on delete cascade,
  org_id      uuid not null references organizations on delete cascade,
  role        text not null default 'user' check (role in ('admin', 'user', 'nurse', 'doctor')),
  full_name   text not null,
  created_at  timestamptz not null default now()
);

create index idx_profiles_org_id on profiles (org_id);

-- ============================================================
-- Patients
-- ============================================================
create table patients (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references organizations on delete cascade,
  mrn                 text,
  prefix              text,
  given_name          text not null,
  family_name         text not null,
  suffix              text,
  date_of_birth       date,
  sex                 text check (sex in ('male', 'female', 'other', 'unknown')),
  blood_type          text,
  occupation          text,
  preferred_language  text,
  phone               text,
  email               text,
  address             jsonb,
  status              text not null default 'active' check (status in ('active', 'inactive', 'deceased')),
  deleted_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_patients_org_id on patients (org_id);
create index idx_patients_mrn on patients (org_id, mrn);
create index idx_patients_name on patients (org_id, family_name, given_name);

-- ============================================================
-- Visits
-- ============================================================
create table visits (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations on delete cascade,
  patient_id      uuid not null references patients on delete cascade,
  type            text,
  status          text not null default 'planned' check (status in ('planned', 'in-progress', 'finished', 'cancelled')),
  reason          text,
  start_datetime  timestamptz,
  end_datetime    timestamptz,
  notes           text,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_visits_org_patient on visits (org_id, patient_id);

-- ============================================================
-- Appointments
-- ============================================================
create table appointments (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations on delete cascade,
  patient_id      uuid not null references patients on delete cascade,
  type            text,
  start_time      timestamptz not null,
  end_time        timestamptz not null,
  location        text,
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

-- ============================================================
-- Labs
-- ============================================================
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

-- ============================================================
-- Medications
-- ============================================================
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

-- ============================================================
-- Incidents
-- ============================================================
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

-- ============================================================
-- Imaging
-- ============================================================
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

-- ============================================================
-- Diagnoses
-- ============================================================
create table diagnoses (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations on delete cascade,
  patient_id      uuid not null references patients on delete cascade,
  icd_code        text,
  description     text not null,
  diagnosed_at    timestamptz,
  diagnosed_by    uuid references profiles,
  notes           text,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_diagnoses_org_patient on diagnoses (org_id, patient_id);

-- ============================================================
-- Allergies
-- ============================================================
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

-- ============================================================
-- Notes (clinical)
-- ============================================================
create table notes (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations on delete cascade,
  patient_id      uuid not null references patients on delete cascade,
  content         text not null,
  author_id       uuid references profiles,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_notes_org_patient on notes (org_id, patient_id);

-- ============================================================
-- Related Persons (emergency contacts / family)
-- ============================================================
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

-- ============================================================
-- Care Goals
-- ============================================================
create table care_goals (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references organizations on delete cascade,
  patient_id          uuid not null references patients on delete cascade,
  description         text not null,
  start_date          date,
  target_date         date,
  achievement_status  text default 'in-progress' check (achievement_status in ('in-progress', 'improving', 'not-achieving', 'sustaining', 'achieved', 'not-attainable')),
  priority            text check (priority in ('low', 'medium', 'high')),
  notes               text,
  deleted_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_care_goals_org_patient on care_goals (org_id, patient_id);

-- ============================================================
-- Care Plans
-- ============================================================
create table care_plans (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations on delete cascade,
  patient_id      uuid not null references patients on delete cascade,
  title           text not null,
  description     text,
  start_date      date,
  end_date        date,
  status          text not null default 'draft' check (status in ('draft', 'active', 'on-hold', 'revoked', 'completed', 'entered-in-error', 'unknown')),
  notes           text,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_care_plans_org_patient on care_plans (org_id, patient_id);

-- ============================================================
-- Patient History (append-only audit log)
-- ============================================================
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

-- ============================================================
-- Updated_at trigger function
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply updated_at triggers
create trigger trg_patients_updated_at before update on patients for each row execute function update_updated_at();
create trigger trg_visits_updated_at before update on visits for each row execute function update_updated_at();
create trigger trg_appointments_updated_at before update on appointments for each row execute function update_updated_at();
create trigger trg_labs_updated_at before update on labs for each row execute function update_updated_at();
create trigger trg_medications_updated_at before update on medications for each row execute function update_updated_at();
create trigger trg_incidents_updated_at before update on incidents for each row execute function update_updated_at();
create trigger trg_imaging_updated_at before update on imaging for each row execute function update_updated_at();
create trigger trg_diagnoses_updated_at before update on diagnoses for each row execute function update_updated_at();
create trigger trg_allergies_updated_at before update on allergies for each row execute function update_updated_at();
create trigger trg_notes_updated_at before update on notes for each row execute function update_updated_at();
create trigger trg_related_persons_updated_at before update on related_persons for each row execute function update_updated_at();
create trigger trg_care_goals_updated_at before update on care_goals for each row execute function update_updated_at();
create trigger trg_care_plans_updated_at before update on care_plans for each row execute function update_updated_at();
