-- HospitalRun 3 — Row Level Security
-- Run this AFTER 00001_initial_schema.sql

-- ============================================================
-- Helper: extract org_id from the JWT
-- ============================================================
-- Supabase blocks creating functions in the auth schema from the SQL Editor.
-- This function lives in public instead; behaviour is identical.
create or replace function public.org_id()
returns uuid as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid,
    (select org_id from profiles where id = auth.uid())
  );
$$ language sql stable security definer;

-- ============================================================
-- Enable RLS on every table
-- ============================================================
alter table organizations    enable row level security;
alter table profiles         enable row level security;
alter table patients         enable row level security;
alter table visits           enable row level security;
alter table appointments     enable row level security;
alter table labs             enable row level security;
alter table medications      enable row level security;
alter table incidents        enable row level security;
alter table imaging          enable row level security;
alter table diagnoses        enable row level security;
alter table allergies        enable row level security;
alter table notes            enable row level security;
alter table related_persons  enable row level security;
alter table care_goals       enable row level security;
alter table care_plans       enable row level security;
alter table patient_history  enable row level security;

-- ============================================================
-- Organizations — users can only see their own org
-- ============================================================
create policy "Users can view own org"
  on organizations for select
  using (id = public.org_id());

-- ============================================================
-- Profiles — users in the same org can see each other
-- ============================================================
create policy "Users can view org profiles"
  on profiles for select
  using (org_id = public.org_id());

create policy "Users can update own profile"
  on profiles for update
  using (id = auth.uid());

-- ============================================================
-- Org-scoped tables: same policy pattern for all
-- Users can SELECT, INSERT, UPDATE rows in their org.
-- Deletes are soft (set deleted_at), no hard delete via client.
-- ============================================================

-- Macro: apply org-scoped policies to a table
-- (Postgres doesn't have macros, so we repeat the pattern)

-- Patients
create policy "Org isolation select" on patients for select using (org_id = public.org_id());
create policy "Org isolation insert" on patients for insert with check (org_id = public.org_id());
create policy "Org isolation update" on patients for update using (org_id = public.org_id());

-- Visits
create policy "Org isolation select" on visits for select using (org_id = public.org_id());
create policy "Org isolation insert" on visits for insert with check (org_id = public.org_id());
create policy "Org isolation update" on visits for update using (org_id = public.org_id());

-- Appointments
create policy "Org isolation select" on appointments for select using (org_id = public.org_id());
create policy "Org isolation insert" on appointments for insert with check (org_id = public.org_id());
create policy "Org isolation update" on appointments for update using (org_id = public.org_id());

-- Labs
create policy "Org isolation select" on labs for select using (org_id = public.org_id());
create policy "Org isolation insert" on labs for insert with check (org_id = public.org_id());
create policy "Org isolation update" on labs for update using (org_id = public.org_id());

-- Medications
create policy "Org isolation select" on medications for select using (org_id = public.org_id());
create policy "Org isolation insert" on medications for insert with check (org_id = public.org_id());
create policy "Org isolation update" on medications for update using (org_id = public.org_id());

-- Incidents
create policy "Org isolation select" on incidents for select using (org_id = public.org_id());
create policy "Org isolation insert" on incidents for insert with check (org_id = public.org_id());
create policy "Org isolation update" on incidents for update using (org_id = public.org_id());

-- Imaging
create policy "Org isolation select" on imaging for select using (org_id = public.org_id());
create policy "Org isolation insert" on imaging for insert with check (org_id = public.org_id());
create policy "Org isolation update" on imaging for update using (org_id = public.org_id());

-- Diagnoses
create policy "Org isolation select" on diagnoses for select using (org_id = public.org_id());
create policy "Org isolation insert" on diagnoses for insert with check (org_id = public.org_id());
create policy "Org isolation update" on diagnoses for update using (org_id = public.org_id());

-- Allergies
create policy "Org isolation select" on allergies for select using (org_id = public.org_id());
create policy "Org isolation insert" on allergies for insert with check (org_id = public.org_id());
create policy "Org isolation update" on allergies for update using (org_id = public.org_id());

-- Notes
create policy "Org isolation select" on notes for select using (org_id = public.org_id());
create policy "Org isolation insert" on notes for insert with check (org_id = public.org_id());
create policy "Org isolation update" on notes for update using (org_id = public.org_id());

-- Related Persons
create policy "Org isolation select" on related_persons for select using (org_id = public.org_id());
create policy "Org isolation insert" on related_persons for insert with check (org_id = public.org_id());
create policy "Org isolation update" on related_persons for update using (org_id = public.org_id());

-- Care Goals
create policy "Org isolation select" on care_goals for select using (org_id = public.org_id());
create policy "Org isolation insert" on care_goals for insert with check (org_id = public.org_id());
create policy "Org isolation update" on care_goals for update using (org_id = public.org_id());

-- Care Plans
create policy "Org isolation select" on care_plans for select using (org_id = public.org_id());
create policy "Org isolation insert" on care_plans for insert with check (org_id = public.org_id());
create policy "Org isolation update" on care_plans for update using (org_id = public.org_id());

-- Patient History (read-only for clients — inserts happen via trigger/server)
create policy "Org isolation select" on patient_history for select using (org_id = public.org_id());
create policy "Org isolation insert" on patient_history for insert with check (org_id = public.org_id());
