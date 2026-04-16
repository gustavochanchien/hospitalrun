-- Migration: v2 feature parity additions
-- Adds fields needed to close functional gaps between v2 and v3.

-- Patients: support for approximate/unknown date of birth
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS is_approximate_date_of_birth boolean DEFAULT false;

-- Care plans: link a care plan to a specific diagnosis
ALTER TABLE care_plans
  ADD COLUMN IF NOT EXISTS diagnosis_id uuid REFERENCES diagnoses(id) ON DELETE SET NULL;

-- Appointments: separate reason-for-visit field (distinct from clinical notes)
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS reason text;
