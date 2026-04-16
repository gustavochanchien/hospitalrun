-- Migration 00004: Schema enhancements for v2 feature parity
-- Adds fields to diagnoses, care_goals, visits, and care_plans

-- Diagnosis: add status, onset_date, abatement_date
ALTER TABLE diagnoses ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE diagnoses ADD COLUMN IF NOT EXISTS onset_date date;
ALTER TABLE diagnoses ADD COLUMN IF NOT EXISTS abatement_date date;

-- Care Goal: add status field
ALTER TABLE care_goals ADD COLUMN IF NOT EXISTS status text;

-- Visit: add location field
ALTER TABLE visits ADD COLUMN IF NOT EXISTS location text;

-- Care Plan: add intent field
ALTER TABLE care_plans ADD COLUMN IF NOT EXISTS intent text;
