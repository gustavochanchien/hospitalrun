-- Stage 6: scope diagnoses and notes to visits (episodes of care).
-- Labs, medications, imaging already have visit_id from earlier migrations.

alter table public.diagnoses
  add column if not exists visit_id uuid references public.visits(id) on delete set null;

alter table public.notes
  add column if not exists visit_id uuid references public.visits(id) on delete set null;

create index if not exists diagnoses_visit_id_idx on public.diagnoses (visit_id);
create index if not exists notes_visit_id_idx on public.notes (visit_id);
