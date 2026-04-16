-- HospitalRun 3 — Database Reset
-- Drops all custom tables, functions, and triggers created by our migrations.
-- Safe to run multiple times (IF EXISTS throughout).

-- Triggers on auth.users
drop trigger if exists on_auth_user_created on auth.users;

-- Functions
drop function if exists public.handle_new_user() cascade;
drop function if exists public.custom_access_token_hook(jsonb) cascade;
drop function if exists public.org_id() cascade;
drop function if exists public.update_updated_at() cascade;

-- Tables — CASCADE handles all foreign key dependencies
drop table if exists public.patient_history  cascade;
drop table if exists public.care_plans        cascade;
drop table if exists public.care_goals        cascade;
drop table if exists public.related_persons   cascade;
drop table if exists public.notes             cascade;
drop table if exists public.allergies         cascade;
drop table if exists public.diagnoses         cascade;
drop table if exists public.imaging           cascade;
drop table if exists public.incidents         cascade;
drop table if exists public.medications       cascade;
drop table if exists public.labs              cascade;
drop table if exists public.appointments      cascade;
drop table if exists public.visits            cascade;
drop table if exists public.patients          cascade;
drop table if exists public.profiles          cascade;
drop table if exists public.organizations     cascade;
