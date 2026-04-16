-- HospitalRun 3 — Grant table privileges to the authenticated role
--
-- The initial schema migration created tables but did not grant any
-- table-level privileges to the `authenticated` role. PostgREST runs every
-- request as `authenticated` after JWT validation, so without these grants
-- every query returns 42501 "permission denied for table X" *before*
-- RLS policies are even evaluated.

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
  patient_history
to authenticated;

-- Sequences (none in current schema, but make defaults safe for the future)
grant usage, select on all sequences in schema public to authenticated;

-- Make sure tables created later in this schema also inherit the grants
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema public
  grant usage, select on sequences to authenticated;
