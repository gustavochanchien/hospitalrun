-- ============================================================
-- 00003_billing.sql
-- Billing & Invoicing: charge_items, invoices, invoice_line_items, payments.
-- ============================================================

-- charge_items: catalog of billable items maintained by admins.
create table if not exists charge_items (
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

create index if not exists charge_items_org_idx on charge_items (org_id);
create unique index if not exists charge_items_org_code_uidx on charge_items (org_id, code) where deleted_at is null;

-- invoices: patient-scoped invoice header.
create table if not exists invoices (
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

create index if not exists invoices_org_idx       on invoices (org_id);
create index if not exists invoices_patient_idx   on invoices (patient_id);
create index if not exists invoices_status_idx    on invoices (status);
create unique index if not exists invoices_org_number_uidx on invoices (org_id, invoice_number) where deleted_at is null;

-- invoice_line_items: denormalised lines linked to an invoice.
create table if not exists invoice_line_items (
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

create index if not exists invoice_line_items_org_idx     on invoice_line_items (org_id);
create index if not exists invoice_line_items_invoice_idx on invoice_line_items (invoice_id);

-- payments: money received against an invoice.
create table if not exists payments (
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

create index if not exists payments_org_idx     on payments (org_id);
create index if not exists payments_invoice_idx on payments (invoice_id);
create index if not exists payments_patient_idx on payments (patient_id);

-- Reuse the v1 updated_at trigger function.
create trigger trg_charge_items_updated_at       before update on charge_items       for each row execute function update_updated_at();
create trigger trg_invoices_updated_at           before update on invoices           for each row execute function update_updated_at();
create trigger trg_invoice_line_items_updated_at before update on invoice_line_items for each row execute function update_updated_at();
create trigger trg_payments_updated_at           before update on payments           for each row execute function update_updated_at();

-- ============================================================
-- RLS
-- ============================================================
alter table charge_items       enable row level security;
alter table invoices           enable row level security;
alter table invoice_line_items enable row level security;
alter table payments           enable row level security;

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
-- Grants
-- ============================================================
grant select, insert, update, delete on charge_items, invoices, invoice_line_items, payments to authenticated;

-- ============================================================
-- Schema version bump
-- ============================================================
insert into schema_meta (version) values (3)
  on conflict (version) do nothing;
