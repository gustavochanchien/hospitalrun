# PLAN.md — HospitalRun v3 Feature-Parity Roadmap

This is the execution plan for closing the gap between `hospitalrun-3/` and the v1/v2 feature set. Each stage is self-contained and should ship as its own PR. Check items off as they land.

Ordering rationale: foundational UX → admin → clinical depth → polish. Earlier stages unblock later ones (e.g. Stage 2 i18n keys get added as Stage 3+ introduces new UI).

**Custom agents for the remaining stages** (defined in [.claude/agents/](.claude/agents/)):
- **`i18n-translator`** — fills the 11 non-English locales for a new namespace once the English source exists. Used in Stages 13, 14, 15.
- **`supabase-dexie-table-wiring`** — adds a new syncable table end-to-end (migration + RLS, schema, Dexie store, columns map, hydrate list). Used in Stages 14 (4 tables), 15 (2 tables).
- **`pdf-document-author`** — writes a `@react-pdf/renderer` document on top of the shared `src/lib/pdf/` infra. Used in Stage 13 (3 docs) and Stage 14 (`InvoicePdf`).
- **`feature-slice-scaffolder`** — wires a flagged feature into Stage 12's gating infra (route folder, sidebar entry, permissions, settings card, English i18n stub). Used in Stages 14, 15. Delegates to the table-wiring and translator agents.

Per-stage agent guidance is inline below where it applies.

---

## Stage 1 — Global UX Foundations ✅

- [x] Network status banner (offline detection)
- [x] CSV export button wired into all list pages
- [x] Tests

---

## Stage 2 — Internationalization Rollout

Match v2's locale coverage.

- [ ] Audit `hospitalrun-3/src/features/*` for hardcoded strings; move any survivors into the appropriate i18next namespace.
- [ ] Add locales under `src/i18n/locales/` for: `ar`, `de`, `es`, `fr`, `id`, `it`, `ja`, `pt-BR`, `ru`, `tr`, `zh-CN` (12 languages, 9 namespaces each).
- [ ] Language selector in Settings; persist selection in Zustand + `localStorage`; RTL flip for `ar`.
- [ ] Update `<html lang>` + `dir` on language change.
- [ ] Tests: switching language re-renders a sampled component; RTL class applied for `ar`.

**Critical files:** [hospitalrun-3/src/i18n/](hospitalrun-3/src/i18n/), [hospitalrun-3/src/features/settings/](hospitalrun-3/src/features/settings/).

---

## Stage 3 — User & Team Management ✅

- [x] Supabase `org_members` table + RLS
- [x] Edge Function `invite-member`
- [x] Settings → Team UI (list / invite / create / remove)
- [x] Permission guards

---

## Stage 4 — Audit Log UI ✅

- [x] `patientHistory` emitted on every patient-scoped write
- [x] History sub-feature list with filters + deep-link

---

## Stage 5 — Rich-Text Clinical Content ✅

- [x] Tiptap editor component + DOMPurify sanitization
- [x] Wired into notes, care plans, care goals

---

## Stage 6 — Visits as Episodes of Care ✅

- [x] `visitId` added to labs, meds, diagnoses, notes (Dexie + Supabase)
- [x] Visit detail view with nested clinical sub-lists
- [x] "Add from visit" entry points auto-inject `visitId`

---

## Stage 7 — Polish & Verification ✅ → v3.1.0 tagged

- [x] Accessibility pass
- [x] Full regression sweep (lint + test + build)
- [x] v3.1.0 milestone tagged

---

## Stage 8 — Supabase-Optional / LAN-First Hub ✅ (current)

Makes Supabase entirely optional. The Electron hub runs on the LAN with no cloud dependency; Supabase becomes an add-on for cloud backup.

- [x] `electron/auth-cache.ts` — `getAnyOrgId()` returns the shared org for all cached users
- [x] `electron/auth-local.ts` — `POST /auth/local/user`: unauthenticated on empty cache (first-user bootstrap); admin JWT required for subsequent users
- [x] `electron/server.ts` — `/config.json` returns `{ mode: 'local-hub' }` when no Supabase config; `{ ...cfg, mode: 'cloud' }` when configured
- [x] `src/lib/supabase/client.ts` — detects `local-hub` sentinel; `isHubLocalMode()` exported; `getSupabase()` throws clearly in local mode
- [x] `src/hooks/useSchemaGuard.ts` — initializes to `'ok'` in local mode (skips schema RPC)
- [x] `src/lib/sync/sync.ts` — `pushEntryViaTransports` routes directly to LAN in local mode
- [x] `src/lib/sync/realtime.ts` — `subscribeToRealtime` is a no-op in local mode
- [x] `src/hooks/useSync.ts` — creates a `LanTransport` (onRecord: `applyLanRecord`) for local mode; handles both replay hydration and live updates; cursor persisted to localStorage
- [x] `src/features/auth/auth.store.ts` — `signIn` and `initialize` skip Supabase in local mode
- [x] `src/features/setup/HubSetupFlow.tsx` — reordered: Start hub → Create admin account → Optional Supabase (skip-able) → Ready
- [x] `src/features/settings/TeamCard.tsx` — `CreateUserForm` calls `/auth/local/user` in local mode; invite/revoke are no-ops

**Manual smoke (local-only path):**
1. `npm run electron:dev` → hub setup wizard → click "Start hub" (no Supabase needed).
2. Create admin account → lands in app.
3. Create a patient → appears in Dexie.
4. Open `http://<hub-ip>:5174` in a second browser → sign in → patient appears via relay replay.
5. Edit on device 2 → change appears on device 1 via relay broadcast.
6. Settings → Team → Create user → second user can log in.
7. Supabase never mentioned or required.

---

## Stage 8.5 — Hosted Demo Deployment ✅

Public, read-only-feeling demo of HospitalRun under a subpath (e.g. `example.com/demo/`) with seeded data and no login screen. Lets prospective NGOs and contributors try the app without standing up Supabase or installing Electron.

- [x] `vite.config.ts` — `VITE_BASE_PATH` threads through Vite `base`, PWA `start_url`, `scope`, `navigateFallback`, and icon srcs so the bundle works under any subpath.
- [x] `src/routes/_auth.tsx` — bypass `hasBackendConfig` redirect in demo mode; wait briefly for `applyDemoAuth()` to populate the session before redirecting to `/login`.
- [x] `src/routes/login.tsx` / `src/routes/setup.tsx` — redirect to `/` in demo mode.
- [x] `.env.demo` — demo-build env (public Supabase anon key only).

The remaining CI / hosting pipeline (build with `VITE_BASE_PATH=/demo/` and deploy `dist/` somewhere public) is a deployment task, tracked under [Stage 28 — Production Readiness & Release](#stage-28--production-readiness--release).

---

## Stage 9 — Desktop App Polish & Distribution

Now that the hub runs standalone, the Electron packaging and distribution story needs work.

- [x] **Auto-update**: `electron/updater.ts` forwards `update-downloaded` to the renderer via `desktop:update-downloaded`; `UpdateAvailableBanner` mounts in `_auth.tsx` and calls `desktop:installUpdate` to trigger `quitAndInstall()`.
- [ ] **Backup/restore UX**: `HubCard` in Settings shows "Backup hub data now" and last-backup timestamp — confirm it's actually calling `electron/backup.ts` correctly and that the restore flow (file picker → `ipc.restoreBackup`) is accessible.
- [x] **mDNS discovery on LAN clients**: hub serves `/_discover` returning `{ app, version, url, hostname }`; `CloudConnectForm` accepts a `showFindHub` prop and probes `http://hospitalrun.local:5174/_discover` to offer "Open hub" navigation. Wired into `SetupPage`'s `cloud-only-web` screen.
- [x] **First-launch onboarding**: `HubSetupFlow` writes `{ url }` to `localStorage['hr_hub_just_started']` before reload; `useHubReadyToast` (mounted in `_auth.tsx`) reads + clears the flag on first dashboard render and fires a one-shot sonner toast with the LAN URL.
- [x] **GitHub Actions desktop release**: audited `.github/workflows/desktop-release.yml`. Workflow structure is sound (Node 20, native rebuild, matrix per OS, signing env vars, `--publish never` + artifact upload, tag-gated release job). Fixed `package.json` `publish` block to point at `gustavochanchien/hospitalrun` so `electron-updater` checks the right repo. Signing/notarization assets and Apple secrets are deployment work tracked under [Stage 28](#stage-28--production-readiness--release).
- [x] Tests: auto-update banner has 5 cases in `update-available-banner.test.tsx`; backup status refresh + restore flow covered in `HubCard.test.tsx`.

---

## Stage 10 — Internationalization Rollout (deferred Stage 2) ✅

Same scope as Stage 2 — deferred because Stage 8 added new UI strings that need to go in first.

- [x] **Translation fill (Stage 10b):** all 11 non-English locales × 9 namespaces (99 files) translated. Previously only `ar/common.json` and `es/common.json` had real content; the other 97 files were English copies. Now fully populated for `ar`, `de`, `es`, `fr`, `id`, `it`, `ja`, `pt-BR`, `ru`, `tr`, `zh-CN`.
- [x] Language selector in Settings; RTL flip for `ar` — already wired in `language.store.ts`.
- [x] Tests — `language.store.test.ts` covers default, switch+persist+`<html lang>`, RTL for Arabic, and translation re-render (asserts `actions.save → 'Guardar'` in Spanish).
- [x] **Audit (Stage 10a):** add `useTranslation` calls across features. Complete — commit `02c6087`:
  - [x] Layout chrome (`AppSidebar`, network banner, update banner host) — commit `42cb0a8`
  - [x] `Dashboard`, `LoginPage`, `SettingsPage`, `ThemeCard`, `LanguageCard`, `SwitchServerCard` — commit `4a024ba`
  - [x] `HubCard`, `CloudBackupCard`, `TeamCard` — commit `5f10224` (73 new `settings.{hub,cloud,team}` keys across 12 locales)
  - [x] Setup-flow surfaces: `HubSetupFlow`, `HubFirstUserForm`, `CloudConnectForm` (new `setup` namespace, 12 locales). `UpdateAvailableBanner` was already wired in `42cb0a8`.
  - [x] Patient features: `PatientListPage`, `PatientForm`, `PatientDetailPage`, `DuplicatePatientDialog` (commit `48ca27c`) + all 12 sub-feature tabs (B1 `547c263`, B2 `db8ef76`, B3 `6814a54`).
  - [x] Domain features: `appointments`, `labs`, `medications`, `imaging`, `incidents`, `visits` — forms, lists, detail pages — commit `02c6087`. Typed key maps (`TYPE_KEY`, `STATUS_KEY`, `INTENT_KEY`, `PRIORITY_KEY`) for all enum-valued selects.
  - [x] Form validation messages: Zod schemas return stable key strings (e.g. `'validation.patientRequired'`); forms translate at render with `t()` — commit `02c6087`.

---

## Stage 11 — Cloud Backup Connect (Settings) ✅

Make it easy to wire up Supabase *after* the hub is already running locally.

- [x] `CloudBackupCard` (new, beside `HubCard` in `SettingsPage`) reflects cloud status via `isHubLocalMode()` and `getBackendConfig()`.
- [x] "Connect Supabase" opens a Dialog containing `CloudConnectForm`. On save → form already calls `saveBackendConfig` + `ipc.setBackendConfig`; the card reloads via `window.location.assign('/')` so the supabase client and `isHubLocalMode` flip cleanly.
- [x] "Disconnect" → `ConfirmDialog` → `ipc.setBackendConfig(null)` + `clearBackendConfig()` + reload.
- [x] "Sync now" calls `flushSyncQueue()` and refreshes the last-synced timestamp; `sync.ts` exports `getLastCloudSyncAt()` (persisted in `localStorage['hr_last_cloud_sync']`) bumped on every successful cloud push and on empty-queue flushes while online.
- [x] Tests: 7 cases in `CloudBackupCard.test.tsx` (browser no-op, local vs connected states, Sync now refreshes timestamp, disconnect confirm + reload, connect dialog opens). 3 new cases in `sync.test.ts` for timestamp tracking.

---

## Stage 12 — Feature Toggle Infrastructure & Guided Setup ✅

Two-tier gating (org enables → admin assigns to members) plus a setup-flow step that lets the first admin pick which features to turn on. Prerequisite for Stages 13–15.

- [x] Supabase migration [00002_feature_flags.sql](supabase/migrations/00002_feature_flags.sql): `org_features` and `user_features`, RLS via `public.org_id()`, admin-only write policies. **Not yet applied to any DB — run `supabase db push` when ready.**
- [x] Dexie v3: `orgFeatures` and `userFeatures` tables; column mappings in [columns.ts](src/lib/db/columns.ts); both added to `syncableTables` in [hydrate.ts](src/lib/sync/hydrate.ts).
- [x] [features.ts](src/lib/features.ts): `FEATURES = ['pdf-export', 'billing', 'inventory']`, `FEATURE_METADATA`, all `defaultOn: false`.
- [x] [useFeatureEnabled.ts](src/hooks/useFeatureEnabled.ts) — true only when org-enabled AND user-granted (admins bypass user-level); `useEnabledFeatures()` for sidebar.
- [x] [feature-gate.tsx](src/components/ui/feature-gate.tsx) mirroring `<PermissionGuard>`.
- [x] [AppSidebar.tsx](src/components/layout/AppSidebar.tsx) nav items get optional `feature?: Feature`; filter via `useEnabledFeatures()`.
- [x] [FeaturesCard.tsx](src/features/settings/FeaturesCard.tsx) (admin only, org-wide toggles) inserted into [SettingsPage.tsx](src/features/settings/SettingsPage.tsx) after `OrgSettingsCard`.
- [x] Per-user feature assignment via [UserFeaturesPopover.tsx](src/features/settings/UserFeaturesPopover.tsx) added as a column in the team-members table.
- [x] [HubSetupFlow.tsx](src/features/setup/HubSetupFlow.tsx) new `choose-features` step + [ChooseFeaturesForm.tsx](src/features/setup/ChooseFeaturesForm.tsx) between `first-user` and `cloud-prompt`; skip path leaves all off.
- [x] i18n: `features` namespace added to [i18n/index.ts](src/lib/i18n/index.ts) + 12 locale files; `chooseFeatures.*` keys added to all 12 `setup.json` files.
- [x] Tests: 11 cases in [useFeatureEnabled.test.tsx](src/hooks/useFeatureEnabled.test.tsx), 3 in [FeaturesCard.test.tsx](src/features/settings/FeaturesCard.test.tsx), extended [HubSetupFlow.test.tsx](src/features/setup/HubSetupFlow.test.tsx) for the new step. Verified `npm run lint` (0 errors), `npm run test:run` (304/305 — the one failure is a pre-existing `_auth.test.tsx` flake on `main`), and `npm run build` clean.

---

## Stage 13 — PDF Export & Printing ✅

Reusable PDF stack via `@react-pdf/renderer` (lazy-loaded). Gated by `pdf-export` feature flag.

- [x] `npm install @react-pdf/renderer`.
- [x] [src/lib/pdf/](src/lib/pdf/): `index.ts` (`generatePdfBlob`, `fetchImageAsDataUrl`), `theme.ts` (`pdfTheme` + `pdfStyles`), shared `Header.tsx`/`Footer.tsx`. `org.ts` resolves the clinic name from Supabase with a localStorage cache.
- [x] [pdf-export-button.tsx](src/components/pdf-export-button.tsx) takes a `buildDocument` async callback so each PDF document is dynamically imported on click; wrapped in `<FeatureGate feature="pdf-export">`. [print-button.tsx](src/components/print-button.tsx) follows the same gate and calls `window.print()`.
- [x] PDF documents (all named-export, typed, use `i18next.getFixedT(locale, 'pdf')` since they render outside the React tree):
  - [x] [PatientSummaryPdf](src/features/patients/pdf/PatientSummaryPdf.tsx) — demographics + active diagnoses/medications + allergies + recent visits
  - [x] [LabReportPdf](src/features/labs/pdf/LabReportPdf.tsx)
  - [x] [ImagingReportPdf](src/features/imaging/pdf/ImagingReportPdf.tsx) — image embedded as base64 (caller fetches via `fetchImageAsDataUrl`)
- [x] Export + print buttons wired into patient detail, lab detail, imaging detail; print-only on medication detail (no `MedicationPdf`).
- [x] Print CSS: `@media print` in [src/index.css](src/index.css) forces light theme on every theme variant, hides sidebar/sidebar-trigger/toaster/`data-print-actions` rows, and stretches main content to full width.
- [x] i18n: `'pdf'` namespace registered in [i18n/index.ts](src/lib/i18n/index.ts); English source written by hand, then `i18n-translator` filled all 11 non-English locales.
- [x] Tests: 35 new tests — `pdf-export-button.test.tsx` (4 cases: gate hides, gate shows, click downloads blob, error re-enables), `print-button.test.tsx` (2 cases), `lib/pdf/index.test.ts` (3 cases for `fetchImageAsDataUrl`), and 1 smoke render per document (3 cases each for the 3 PDF components). Pre-existing `_auth.test.tsx` flake unchanged. Build splits each PDF document into its own lazy chunk (~3–5 kB each); `@react-pdf/renderer` itself lands in a separate ~1.5 MB chunk only fetched on first export.

---

## Stage 14 — Billing & Invoicing ✅

Patient-scoped invoices with line items and payment tracking. Gated by `billing` feature flag. Invoice PDF reuses Stage 13. Landed in commit `2ed775c`; the staged migration was later squashed into `00001_initial_schema.sql` by `bff2fc8` per the pre-deploy strategy (so the originally-planned `00003_billing.sql` was never created).

- [x] Tables `charge_items` ([00001_initial_schema.sql:488](supabase/migrations/00001_initial_schema.sql#L488)), `invoices` (status CHECK in draft/issued/partial/paid/void, [:506](supabase/migrations/00001_initial_schema.sql#L506)), `invoice_line_items` ([:534](supabase/migrations/00001_initial_schema.sql#L534)), `payments` (method CHECK in cash/card/bank-transfer/insurance/other, [:552](supabase/migrations/00001_initial_schema.sql#L552)) — all with `org_id` cascade + `deleted_at` soft-delete, `updated_at` triggers at [:658-661](supabase/migrations/00001_initial_schema.sql#L658-L661), RLS via `public.org_id()` at [:1337-1406](supabase/migrations/00001_initial_schema.sql#L1337-L1406). **Not yet applied to any DB — run `supabase db push` when ready.**
- [x] Dexie v4 wiring in [src/lib/db/index.ts:111-117](src/lib/db/index.ts#L111-L117); types in [src/lib/db/schema.ts:478-548](src/lib/db/schema.ts#L478-L548); column maps in [src/lib/db/columns.ts:314-376](src/lib/db/columns.ts#L314-L376) and registered in `columnMap` at [:448-451](src/lib/db/columns.ts#L448-L451); all four tables added to `syncableTables` in [src/lib/sync/hydrate.ts:27-30](src/lib/sync/hydrate.ts#L27-L30) and reachable via realtime.
- [x] [permissions.ts:33-37](src/lib/permissions.ts#L33-L37): `read:billing | write:billing | void:invoice | record:payment | manage:charge_items`; role maps updated at lines 105, 127, 141 (clinical roles get read/write/record:payment; admin gets all five).
- [x] Routes [src/routes/_auth/billing/](src/routes/_auth/billing/): `index.tsx`, `$invoiceId.tsx`, `new.tsx` — all wrapped in `<FeatureGate feature="billing">`.
- [x] Components in [src/features/billing/](src/features/billing/): [InvoiceListPage.tsx](src/features/billing/InvoiceListPage.tsx), [InvoiceForm.tsx](src/features/billing/InvoiceForm.tsx), [InvoiceDetailPage.tsx](src/features/billing/InvoiceDetailPage.tsx), [PaymentDialog.tsx](src/features/billing/PaymentDialog.tsx) (status auto-flips draft→issued→partial→paid on amount paid), [invoice.schema.ts](src/features/billing/invoice.schema.ts) Zod, [invoice-totals.ts](src/features/billing/invoice-totals.ts) (subtotal/tax/discount math), and [pdf/InvoicePdf.tsx](src/features/billing/pdf/InvoicePdf.tsx) on the shared Stage 13 PDF infra.
- [x] Patient sub-feature: [PatientBilling.tsx](src/features/patients/sub-features/PatientBilling.tsx) — `<FeatureGate feature="billing">`-wrapped invoice table; tab trigger at [PatientDetailPage.tsx:329](src/features/patients/PatientDetailPage.tsx#L329) and content at [:381](src/features/patients/PatientDetailPage.tsx#L381).
- [x] Catalog: [ChargeItemsCard.tsx](src/features/settings/ChargeItemsCard.tsx) — admin CRUD with `<PermissionGuard permission="manage:charge_items">`, gated; mounted in [SettingsPage.tsx:63](src/features/settings/SettingsPage.tsx#L63).
- [x] Sidebar entry `{ key: 'billing', to: '/billing', icon: Receipt, feature: 'billing' as const }` at [AppSidebar.tsx:77](src/components/layout/AppSidebar.tsx#L77).
- [x] `generateInvoiceNumber(orgId)` at [code-generator.ts:51](src/lib/db/code-generator.ts#L51) — scans all invoices (including soft-deleted) for the org, increments past the max `INV-NNNNN` suffix so reused numbers can't collide.
- [x] `billing` i18n namespace registered in [src/lib/i18n/index.ts:17](src/lib/i18n/index.ts#L17); English authored, the other 11 locales (`ar`, `de`, `es`, `fr`, `id`, `it`, `ja`, `pt-BR`, `ru`, `tr`, `zh-CN`) filled by `i18n-translator`. Currency formatted via `Intl.NumberFormat`.
- [x] Tests: [invoice.schema.test.ts](src/features/billing/invoice.schema.test.ts), [invoice-totals.test.ts](src/features/billing/invoice-totals.test.ts), [PaymentDialog.test.tsx](src/features/billing/PaymentDialog.test.tsx) (status flip), [billing.test.tsx](src/routes/_auth/billing/billing.test.tsx) (FeatureGate). All 5 PLAN-listed categories covered. `npx vitest run src/features/billing src/routes/_auth/billing`: **28/28 passing**.

---

## Stage 15 — Inventory Management ✅

Track stock for consumables; optional linkage from medications. Gated by `inventory` feature flag. Landed in commit `54eda29` bundled with the HIPAA audit-log + custom roles work.

- [x] Tables `inventory_items` (sku, on_hand, reorder_level, unit_cost) + `inventory_transactions` (kind CHECK in receive/dispense/adjust/transfer/waste) merged into [00001_initial_schema.sql:506](supabase/migrations/00001_initial_schema.sql#L506) with `trg_inventory_transactions_apply` trigger that applies signed-delta math to `on_hand` on insert/update/delete. RLS via `public.org_id()` at lines 1321–1352. **Not yet applied to any DB — run `supabase db push` when ready.**
- [x] Dexie v5 wiring in [src/lib/db/index.ts:53](src/lib/db/index.ts#L53); column maps in [src/lib/db/columns.ts:395](src/lib/db/columns.ts#L395); `inventoryItems`/`inventoryTransactions` added to `syncableTables` in [src/lib/sync/hydrate.ts:29](src/lib/sync/hydrate.ts#L29) and reachable via [src/lib/sync/realtime.ts:14](src/lib/sync/realtime.ts#L14).
- [x] `recordStockMovement()` in [src/features/inventory/stock-write.ts](src/features/inventory/stock-write.ts) precomputes `on_hand` for offline UI consistency before queuing the transaction.
- [x] Nullable `medications.inventoryItemId` (Dexie v5 + column in migration). [MedicationInventoryCard.tsx:74](src/features/inventory/MedicationInventoryCard.tsx#L74) calls `recordStockMovement({ kind: 'dispense', patientId, medicationId, ... })`; mounted on [MedicationDetailPage.tsx:197](src/features/medications/MedicationDetailPage.tsx#L197).
- [x] [permissions.ts:38](src/lib/permissions.ts#L38): `read:inventory | write:inventory | adjust:stock | receive:stock`; new `PHARMACIST_PERMISSIONS` role gets all four.
- [x] Routes [src/routes/_auth/inventory/](src/routes/_auth/inventory/): `index.tsx`, `$itemId.tsx`, `new.tsx` — all wrapped in `<FeatureGate feature="inventory">`.
- [x] Components: `InventoryListPage`, `InventoryItemForm`, `InventoryItemDetail`, and one polymorphic [StockMovementDialog.tsx](src/features/inventory/StockMovementDialog.tsx) with `mode: 'receive' | 'adjust' | 'waste' | 'transfer'` (chosen over four near-duplicate dialogs).
- [x] [LowStockWidget.tsx](src/features/dashboard/LowStockWidget.tsx) surfaces items where `on_hand <= reorder_level`; gated; mounted at [_auth/index.tsx:185](src/routes/_auth/index.tsx#L185).
- [x] Sidebar entry `{ key: 'inventory', to: '/inventory', icon: Package, feature: 'inventory' as const }` at [AppSidebar.tsx:78](src/components/layout/AppSidebar.tsx#L78).
- [x] `inventory` i18n namespace registered in [src/lib/i18n/index.ts:18](src/lib/i18n/index.ts#L18); `nav.inventory` in `common.json` × 12 locales; full namespace × 12 locales (English authored; the other 11 filled by `i18n-translator`).
- [x] Tests: [inventory.schema.test.ts](src/features/inventory/inventory.schema.test.ts) (SKU uniqueness + negative-cost validation), [stock-write.test.ts](src/features/inventory/stock-write.test.ts) (signed-delta math + syncQueue side-effects per kind), [inventory.test.tsx](src/routes/_auth/inventory/inventory.test.tsx) (FeatureGate). All 5 PLAN-listed categories covered. Suite: 432/433 (only the pre-existing `_auth.test.tsx` flake fails). Lint 0 errors, build clean.

---

## Stage 16 — Patient demographics depth & family linking ✅

Scope shifted at planning time: dropped OpenEMR's employer block (over-fit to US private-practice intake; `occupation` covers what matters for low-resource clinics) in favor of demographics + family-linking that fit the LAN-first / non-US target user base. No new tables, no new feature flag. No Dexie version bump (all new fields unindexed).

- [x] **Migration** — merged into [00001_initial_schema.sql:46](supabase/migrations/00001_initial_schema.sql#L46) per the pre-deploy strategy. `patients` got 7 columns: `marital_status` (CHECK enum), `education_level` (CHECK enum), `national_id`, `national_id_type`, `number_of_children` (CHECK ≥0), `number_of_household_members` (CHECK ≥0), `is_head_of_household boolean not null default false`. `related_persons` got 2: `linked_patient_id uuid references patients on delete set null` and `is_primary_contact boolean not null default false`, plus partial index `idx_related_persons_linked_patient`.
- [x] **Dexie + columns** — [schema.ts](src/lib/db/schema.ts) Patient + RelatedPerson interfaces extended; [columns.ts](src/lib/db/columns.ts) snake↔camel mappings extended for both tables. **No Dexie version bump** — all new fields are unindexed nullable scalars.
- [x] **Zod schema** — [patient.schema.ts](src/features/patients/patient.schema.ts) extended with the 7 new fields; exported `MARITAL_STATUSES` and `EDUCATION_LEVELS` tuples. Numeric fields are validated as string-typed (regex + max-value refine) because react-hook-form's number-input registers return strings; conversion to `number | null` happens in `formToPatientFields()`.
- [x] **PatientForm restructured** — sections are now Personal / Contact / **Identification** / **Background** / **Household**. Marital-status select sits beside `sex`/`bloodType` in Personal. `nationalIdType` uses a native `<datalist>` for combobox UX with curated suggestions (national_id, voter_id, refugee_card, passport, community_card). Household section includes a `<Checkbox>` for `isHeadOfHousehold`.
- [x] **Patient routes** — [new.tsx](src/routes/_auth/patients/new.tsx) + [$patientId.tsx](src/routes/_auth/patients/$patientId.tsx) plumb the 7 new fields via shared [patient-payload.ts](src/features/patients/patient-payload.ts) helper (`formToPatientFields` + `diffPatientFields`). The edit route now also calls `recordPatientHistory()` with field-level diffs, **fixing a Stage 4 gap** where the helper existed but was never invoked from any feature code.
- [x] **PatientDetailPage** — marital-status text added to the header chip row; "Head of household" badge in the badge row; new conditional rows for education / national ID / children / household members. **Per-field "Updated X ago" subtext** beneath every demographic value, sourced from a live `patientHistory` query (the same wiring also makes the History tab populate for the first time).
- [x] **Family linking — PatientRelatedPersons** — new patient-picker (extracted to [src/components/patient-picker.tsx](src/components/patient-picker.tsx); [AppointmentForm](src/features/appointments/AppointmentForm.tsx) refactored to use the shared component) lets a relationship link to an existing patient. When linked, the picker auto-fills `givenName`/`familyName` (without overwriting manual edits), and the list row renders a clickable `<Link>` with a small lucide `Link2` icon. Curated relationship `<datalist>` (spouse, partner, parent, child, sibling, guardian, grandparent, grandchild, head-of-household, friend, emergency-contact, other) — DB stays free text. `isPrimaryContact` checkbox; on save, any previously-primary row for the same patient is demoted to ensure single-primary.
- [x] **i18n** — 30 new English keys in `patient` namespace (`fields.*`, `form.*`, `detail.*`, top-level `maritalStatus.*` + `educationLevel.*` enums, `subFeatures.relatedPersons.{fields,placeholders,badges,relationship}`). Filled across all 11 non-English locales by the `i18n-translator` agent.
- [x] **Tests** — extended [patient.schema.test.ts](src/features/patients/patient.schema.test.ts) (15 cases), extended [PatientForm.test.tsx](src/features/patients/PatientForm.test.tsx) with new-field submission, extended [PatientRelatedPersons.test.tsx](src/features/patients/sub-features/PatientRelatedPersons.test.tsx) (4 new cases: linked link rendering, plain text fallback, primary badge, primary-demote behavior, self-exclude in picker — required mocking `@tanstack/react-router` Link to avoid router-context plumbing), new [patient-payload.test.ts](src/features/patients/patient-payload.test.ts) (form→record mapping + diff including JSON-stringified `address` change detection). All pre-existing fixtures (seed.ts, seed-org.ts, sync.test.ts, write.test.ts, code-generator.test.ts, the four PDF doc tests) updated to include the new Patient/RelatedPerson fields. Suite: 454/455 (the one failure is the documented pre-existing `_auth.test.tsx` flake). Lint 0 errors; build clean.

**Notes for downstream consumers:**
- `recordPatientHistory()` now fires on every patient update via the edit route; treat the `patientHistory` table as authoritative for "when did field X last change". `diffPatientFields()` JSON-stringifies the `address` object so nested changes are detected (the generic `diffFields()` would otherwise reduce both sides to `[object Object]`).
- Numeric form fields (`numberOfChildren`, `numberOfHouseholdMembers`) live as strings in `PatientFormValues` because react-hook-form returns strings from `<input type="number">`; convert to `number | null` via `formToPatientFields()` before writing to Dexie. Don't try to coerce in the Zod schema — `z.coerce.number()` on empty strings fails with NaN.
- The shared `<PatientPicker>` is the single sanctioned way to pick a patient. AppointmentForm has been refactored to use it; any new feature needing patient selection should reuse this component (props: `value`, `onChange(patient | null)`, `excludePatientId`, `placeholder`, `searchPlaceholder`, `noResultsLabel`, optional `clearable`).
- `RelatedPerson.linkedPatientId` is intentionally non-indexed in Dexie — v1 only renders outgoing links. If a future stage adds a "linked from" reverse-lookup panel, bump Dexie to v8 and add the `linkedPatientId` index.

---

## Stage 17 — ICD-10 / SNOMED code lookup + medication interaction warnings ✅

Replace free-text `diagnoses.icdCode` with a coded-value picker. No new server tables.

- [x] Bundle static reference data: `public/code-sets/icd10-who.json`, `public/code-sets/snomed-core.json`. Workbox runtime-caches on first fetch.
- [x] Dexie-only `codeSystems` table (v8) for indexed search after first load. Lazy-load on first picker open.
- [x] `CodeSearchCombobox` component (Popover + Input pattern) with `system: 'icd10' | 'snomed'`, 300 ms debounced search, "use as-is" free-text fallback.
- [x] Wire into [PatientDiagnoses.tsx](src/features/patients/sub-features/PatientDiagnoses.tsx) — replaced free-text `icdCode` input; auto-fills description from selected display.
- [x] No new feature flag — patient-safety infrastructure.
- [x] i18n: `codePicker.*` keys in the `patient` namespace; `drugInteraction.*` keys in the `medications` namespace. All 11 non-English locales translated.
- [x] Drug interaction warnings: bundled `public/code-sets/drug-interactions.json` (~150+ pairs, WHO / DDInter 2.0), `normalize` + `checker` + `openfda` (7-day localStorage cache). `DrugInteractionAlert` wired into `PatientMedications` and `MedicationDetailPage`.
- [x] Tests: 26 new tests across 8 test files, all passing.

---

## Stage 18 — Vitals + growth charts ✅

New clinical table, surfaced as the 14th patient sub-tab. Gated by `vitals` feature flag.

**Agents:** `supabase-dexie-table-wiring` for `vitals`; `feature-slice-scaffolder` is over-kill (no top-level route) — wire the sub-tab and feature flag by hand; `i18n-translator` for 11 non-English locales.

- [x] Supabase schema merged into [00001_initial_schema.sql](supabase/migrations/00001_initial_schema.sql) (pre-deploy policy: no new migration files). Fields: `patientId`, `visitId`, `recordedAt`, `recordedBy`, `heightCm`, `weightKg`, `temperatureC`, `heartRate`, `respiratoryRate`, `systolic`, `diastolic`, `oxygenSat`, `painScale`, `headCircumferenceCm`, `notes`. Dexie v9 (`vitals` store), `vitalColumns` in [columns.ts](src/lib/db/columns.ts), hydrate list updated.
- [x] Added `vitals` to `PHI_TABLES` and `'vital'` to `ACCESS_RESOURCE_TYPES` + `PHI_TABLE_TO_RESOURCE`.
- [x] [features.ts](src/lib/features.ts): added `'vitals'` to `FEATURES` and `FEATURE_METADATA`.
- [x] [permissions.ts](src/lib/permissions.ts): added `read:vitals` + `write:vitals`. Doctor/Nurse/Admin get write; Viewer/Check-In/Pharmacist get read; mirrored in SQL `bootstrap_current_user` seed.
- [x] New patient sub-tab [PatientVitals.tsx](src/features/patients/sub-features/PatientVitals.tsx) wired into [PatientDetailPage.tsx](src/features/patients/PatientDetailPage.tsx) as the 14th tab. Tab + "All" section wrapped in `<FeatureGate feature="vitals">`. Form is dialog-based with per-field numeric inputs, server-side JS validation (out-of-range, partial BP, diastolic >= systolic), `noValidate` on the form so JS validation owns errors.
- [x] Growth chart card at [vitals/GrowthChartCard.tsx](src/features/patients/sub-features/vitals/GrowthChartCard.tsx) — Recharts `LineChart` overlaying P3/P15/P50/P85/P97 reference curves + patient series. Bundled reference data at `public/growth-charts/who-{0-2,2-5,5-19}-{boys,girls}.json` (smoothed approximation of WHO Child Growth Standards — see `_notice` field; production swap requires only data updates, no code changes). Renders only for patients ≤ 19 with `sex` ∈ {male, female}.
- [x] i18n: new `vitals` namespace registered in [i18n/index.ts](src/lib/i18n/index.ts). English by hand; `i18n-translator` agent populated the other 11 locales (also added `patient.tabs.vitals` and a `features.vitals` section).
- [x] Tests: 8 cases in [PatientVitals.test.tsx](src/features/patients/sub-features/PatientVitals.test.tsx) (empty state, empty-submit rejection, save round-trip, partial-BP rejection, out-of-range oxygen rejection, growth chart hidden for adult, growth chart shown for pediatric, permission guard) + 10 cases in [vitals/growth-data.test.ts](src/features/patients/sub-features/vitals/growth-data.test.ts) (age-range selection, age computation, reference + patient series merge, interpolation, missing-metric guard).

---

## Stage 19 — Longitudinal graphical charting ✅

Multi-series trend plots over vitals (Stage 18) + labs. Gated by `trends` feature flag.

- [x] Schema additions: optional `numericValue: number | null` + `unit: string | null` on `labs`. Merged directly into [00001_initial_schema.sql](supabase/migrations/00001_initial_schema.sql) per pre-deploy policy (no new migration file). Both fields unindexed so no Dexie version bump. Column map updated in [columns.ts](src/lib/db/columns.ts).
- [x] [features.ts](src/lib/features.ts): added `'trends'` to `FEATURES` and `FEATURE_METADATA`.
- [x] [`<TrendChart series={...} />`](src/components/trend-chart.tsx) — Recharts `LineChart` wrapper, multi-series, time-scale x-axis, units in tooltip, supports `sparkline` mode (no axes/legend, compact). Exports `TREND_PALETTE` for shared colour selection.
- [x] New patient sub-tab [PatientTrends.tsx](src/features/patients/sub-features/PatientTrends.tsx) — checkbox picker (capped at 3 series) over all numeric vital fields plus any lab `code`/`type` with a `numericValue`, plus `From`/`To` date-range inputs. Wired as the 15th tab in [PatientDetailPage.tsx](src/features/patients/PatientDetailPage.tsx), `<FeatureGate feature="trends">`-wrapped on the trigger and "All" section. Shared helpers in [trends/trend-data.ts](src/features/patients/sub-features/trends/trend-data.ts) (`buildSeriesOptions`, `buildSeriesFromSelection`, `VITAL_FIELD_KEYS`, `VITAL_FIELD_LABEL_KEY`, `VITAL_FIELD_UNIT`).
- [x] "View as chart" toggle on [PatientVitals.tsx](src/features/patients/sub-features/PatientVitals.tsx) — Table/Chart buttons + metric `<Select>`; reuses the trend-data helpers and the shared `<TrendChart>`. Hidden until at least one numeric reading exists.
- [x] Sparkline on [LabDetailPage.tsx](src/features/labs/LabDetailPage.tsx) — renders a "Trend over time" card with a multi-point `<TrendChart>` when there are ≥2 prior labs of the same `code` with a `numericValue`. Save flow (both inline + complete dialog) now also captures optional `numericValue` + `unit`.
- [x] No new permissions (reads existing data; sub-tab visibility is controlled by the `trends` feature flag only).
- [x] i18n: new `trends` namespace registered in [i18n/index.ts](src/lib/i18n/index.ts). English by hand; `i18n-translator` agent populated the other 11 locales — 44 file writes (11× new `trends.json` + 11× `patient.json` (`tabs.trends`) + 11× `features.json` (`trends` block) + 11× `vitals.json` (`view` block) + 11× `labs.json` (5 keys under `detail`)).
- [x] Tests: 4 cases in [PatientTrends.test.tsx](src/features/patients/sub-features/PatientTrends.test.tsx) (empty state, pick vital → chart renders, 3-series cap disables a 4th, lab numericValue option appears) + 7 cases in [trends/trend-data.test.ts](src/features/patients/sub-features/trends/trend-data.test.ts) (vital-field filtering, lab grouping by code/type, no-numericValue exclusion, multi-series sort + distinct palette, empty selection, completedAt → requestedAt fallback). 536/537 tests pass (lone failure is the pre-existing `_auth.test.tsx` redirect flake).

---

## Stage 20 — Immunization registry ✅

Dedicated table separate from medications. Gated by `immunizations` feature flag.

- [x] Supabase schema + Dexie + columns + hydrate. Per pre-deploy policy, the `immunizations` table was merged directly into [00001_initial_schema.sql](supabase/migrations/00001_initial_schema.sql) (no new migration file): table + triggers + RLS + grants + built-in role seeds for `read:immunizations` / `write:immunizations`. Dexie v10 store registered in [index.ts](src/lib/db/index.ts) with indexes on `patientId`, `visitId`, `administeredAt`, `nextDueAt`, and `[patientId+administeredAt]`. Snake_case map added in [columns.ts](src/lib/db/columns.ts). Hydrate list updated in [hydrate.ts](src/lib/sync/hydrate.ts). Fields: `patientId`, `visitId`, `vaccineCode`, `vaccineName`, `doseNumber`, `lotNumber`, `manufacturer`, `administeredAt`, `administeredBy`, `site`, `route`, `nextDueAt`, `notes`.
- [x] [schema.ts](src/lib/db/schema.ts): `immunizations` added to `PHI_TABLES`; `'immunization'` added to `ACCESS_RESOURCE_TYPES`. [access-log.ts](src/lib/db/access-log.ts): `immunizations: 'immunization'` mapping added to `PHI_TABLE_TO_RESOURCE`.
- [x] [features.ts](src/lib/features.ts): added `'immunizations'` to `FEATURES` + `FEATURE_METADATA`.
- [x] [permissions.ts](src/lib/permissions.ts): added `read:immunizations` + `write:immunizations` to `PERMISSIONS`, `CLINICAL_PERMISSIONS`, and `READ_PERMISSIONS`. SQL bootstrap role seeds in [00001_initial_schema.sql](supabase/migrations/00001_initial_schema.sql) updated to match.
- [x] New patient sub-tab [PatientImmunizations.tsx](src/features/patients/sub-features/PatientImmunizations.tsx) — list + "Record immunization" dialog with vaccine code, dose #, lot, manufacturer, site, route, administered date, and next-due date. Vaccine picker reuses Stage 17 [CodeSearchCombobox](src/components/code-search-combobox.tsx) — the `system` union now includes `'vaccine'`; [loader.ts](src/lib/code-systems/loader.ts) + [search.ts](src/lib/code-systems/search.ts) extended in lockstep. Bundled WHO EPI vaccine list at [public/code-sets/who-epi-vaccines.json](public/code-sets/who-epi-vaccines.json) (46 entries; CVX/EPI-aligned codes). Wired as the 16th tab in [PatientDetailPage.tsx](src/features/patients/PatientDetailPage.tsx), `<FeatureGate feature="immunizations">`-wrapped on the trigger and "All" section.
- [x] `nextDueAt` persisted on save (when supplied); Stage 24 recall board will read directly from this column.
- [x] i18n: new `immunizations` namespace registered in [i18n/index.ts](src/lib/i18n/index.ts). English by hand; `i18n-translator` agent populated the other 11 locales — 33 file writes (11× new `immunizations.json` + 11× `patient.json` (`tabs.immunizations`) + 11× `features.json` (`immunizations` block)).
- [x] Tests: 8 cases in [PatientImmunizations.test.tsx](src/features/patients/sub-features/PatientImmunizations.test.tsx) (empty state, missing vaccine name, save round-trip + UI, next-due before administered rejection, `nextDueAt` persistence for recall, read permission denial, `FeatureGate` hide/show, write permission hides button). 545/545 tests pass — the previously-noted `_auth.test.tsx` redirect flake is stabilized in this commit by mocking `isDemoMode`.

---

## Stage 21 — Generic patient document repository

Parallels imaging for arbitrary documents (consents, scans, faxes). Gated by `documents` feature flag.

**Agents:** `supabase-dexie-table-wiring` for `patient_documents` (Storage bucket + RLS is custom — flag it in the invocation); sub-tab + storage helper by hand; `i18n-translator` for 11 locales.

- [ ] Supabase migration `00009_patient_documents.sql` — table + RLS via `public.org_id()`, plus new Storage bucket `patient-documents` with org-prefix policies mirroring the `imaging` bucket policies in `00001_initial_schema.sql`. Fields: `patientId`, `visitId`, `category` (`consent | referral | scan | other`), `title`, `description`, `storagePath`, `mimeType`, `sizeBytes`, `uploadedBy`, `uploadedAt`.
- [ ] Add `patientDocuments` to `PHI_TABLES` + `PHI_TABLE_TO_RESOURCE`.
- [ ] [features.ts](src/lib/features.ts): add `'documents'`.
- [ ] [permissions.ts](src/lib/permissions.ts): `read:documents`, `write:documents`, `delete:document`.
- [ ] New `src/lib/supabase/documents.ts` — `uploadDocumentFile`, `getDocumentSignedUrl`, `removeDocumentFile`. Mirror of [src/lib/supabase/storage.ts](src/lib/supabase/storage.ts).
- [ ] **Local-hub mode** — hide the upload button when `isHubLocalMode()` returns true (CloudBackupCard pattern). Listing existing documents still works if rows hydrated previously.
- [ ] New patient sub-tab `PatientDocuments.tsx` (gated) — upload, list, preview by mime type (PDF + image inline; others "Download"), category dropdown, delete with confirmation.
- [ ] i18n: new `documents` namespace; English by hand, `i18n-translator` for the rest.
- [ ] Tests: upload, list, signed-URL fetch (mock), local-hub graceful degrade, delete confirmation, gate.

---

## Stage 22 — In-house pharmacy dispensary

Pharmacy POS UX on top of inventory (Stage 15) + medications. Gated by `pharmacy` feature flag.

**Agents:** `feature-slice-scaffolder` for the new top-level route + sidebar + settings card stub; `pdf-document-author` for `PharmacyReceiptPdf`; `i18n-translator` for 11 locales. Schema additions to existing `medications` table are by hand.

- [ ] Migration `00010_pharmacy.sql`: add optional `dosage_instructions text`, `route text`, `frequency text` to `medications`. Mirror in [schema.ts](src/lib/db/schema.ts) `Medication` interface + [columns.ts](src/lib/db/columns.ts).
- [ ] [features.ts](src/lib/features.ts): add `'pharmacy'`.
- [ ] [permissions.ts](src/lib/permissions.ts): `dispense:medication`, `read:pharmacy_queue`.
- [ ] Routes under [src/routes/_auth/pharmacy/](src/routes/_auth/pharmacy/): `index.tsx` (dispense queue + walk-in tabs). Both gated. `feature-slice-scaffolder` scaffolds; fill internals after.
- [ ] Components (by hand): `PharmacyQueue.tsx` (active `medications` with linked `inventoryItemId`, click to dispense), `WalkInDispenseForm.tsx` (patient + inventory item + qty → `recordStockMovement({ kind: 'dispense', ... })` from [stock-write.ts:40](src/features/inventory/stock-write.ts#L40)), `DispenseDialog.tsx` (captures dosage instructions, prints receipt).
- [ ] Extend [MedicationInventoryCard.tsx](src/features/inventory/MedicationInventoryCard.tsx) dispense flow to surface dosage instructions input.
- [ ] `PharmacyReceiptPdf` via Stage 13 infra — `pdf-document-author`.
- [ ] Sidebar entry `{ key: 'pharmacy', feature: 'pharmacy', icon: Pill }` — `feature-slice-scaffolder`.
- [ ] i18n: new `pharmacy` namespace; English by hand, `i18n-translator` for the rest.
- [ ] Tests: queue lists eligible meds, dispense decrements `onHand`, walk-in flow, receipt PDF, permission guard, feature gate.

---

## Stage 23 — Notifications transport (SMS + email)

Infrastructure: edge function + settings card for Twilio/Resend credentials. **No feature flag — credential presence is the gate.** Used by Stages 24 (recalls) and optionally appointment confirmations.

- [ ] Supabase migration `00011_notifications.sql`: `notification_log` (id, orgId, channel `'sms' | 'email'`, to, kind `'appointment_reminder' | 'recall' | 'custom'`, sentAt, status `'sent' | 'failed'`, error, createdBy) + `notification_config` (orgId PK, smsConfigured boolean, emailConfigured boolean). RLS via `public.org_id()`.
- [ ] New edge function `supabase/functions/send-notification/` mirroring [invite-member](supabase/functions/invite-member/index.ts) shape. Body: `{ channel, to, subject?, body, kind }`. Reads `TWILIO_*` / `RESEND_*` from Edge Function secrets, calls the matching API, writes a `notification_log` row, returns `{ ok }` or `{ error }`.
- [ ] Admin RPC `set_notification_channel(channel, configured boolean)` — flips the boolean in `notification_config`. The card never sees raw credentials; secrets are set via `supabase secrets set` (documented in the card).
- [ ] [permissions.ts](src/lib/permissions.ts): `manage:notifications` (set credentials), `read:notification_log`.
- [ ] New `NotificationsCard.tsx` in [SettingsPage.tsx](src/features/settings/SettingsPage.tsx) — admin only, shows which channels are configured, instructions for `supabase secrets set`, "Disable channel" button.
- [ ] Client helper `src/lib/notifications/send.ts` — `sendNotification({ channel, to, ... })` invokes the edge function. Returns `{ ok: true }` or `{ error: 'not_available' | 'not_configured' | 'send_failed' }`.
- [ ] **Local-hub mode** — `sendNotification` resolves `{ error: 'not_available' }`; consumers render "Configure cloud sync to enable notifications" inline.
- [ ] i18n: extend `settings` namespace for `notifications.*` keys; `i18n-translator` for the rest.
- [ ] Tests: card shows configured channels, send helper success/failure paths, log row created, local-hub degrade, permission guard.

---

## Stage 24 — Recall / reminders board

Patient-follow-up workbench: dashboard widget + standalone route + per-patient tab. Gated by `recalls` feature flag.

**Agents:** `supabase-dexie-table-wiring` for `recalls`; `feature-slice-scaffolder` for route/sidebar/permissions/settings; `i18n-translator` for 11 locales.

- [ ] Supabase migration `00012_recalls.sql` + Dexie + columns + hydrate — `supabase-dexie-table-wiring`. Fields: `patientId`, `reason`, `dueAt`, `status` (`pending | sent | completed | cancelled`), `createdBy`, `sentAt`, `completedAt`, `sourceKind` (`manual | immunization | care_goal | appointment`), `sourceId`, `notes`.
- [ ] Add `recalls` to `PHI_TABLES` + `PHI_TABLE_TO_RESOURCE`.
- [ ] [features.ts](src/lib/features.ts): add `'recalls'`. [permissions.ts](src/lib/permissions.ts): `read:recalls`, `write:recalls`, `send:recall`.
- [ ] Auto-generation: nightly client-side reconcile (runs when dashboard mounts) seeds pending recalls from immunization `nextDueAt` (Stage 20) and care-goal `targetDate`. Skips if a matching `(sourceKind, sourceId)` recall already exists.
- [ ] `RecallBoardWidget.tsx` on dashboard (full-width card under `LowStockWidget`, pattern from [LowStockWidget.tsx](src/features/dashboard/LowStockWidget.tsx)) — up to 5 overdue/upcoming, gated.
- [ ] Route `/recalls` (`src/routes/_auth/recalls/index.tsx`) — full board with filters by status and due date. Per-row actions: "Send reminder" (Stage 23 `sendNotification`; disabled with tooltip if channel not configured), "Mark completed", "Snooze".
- [ ] Patient sub-tab `PatientRecalls.tsx` — per-patient view + manual add. Gated.
- [ ] Sidebar entry `{ key: 'recalls', feature: 'recalls', icon: BellRing }` — `feature-slice-scaffolder`.
- [ ] i18n: new `recalls` namespace; English by hand, `i18n-translator` for the rest.
- [ ] Tests: widget shows overdue rows, auto-seed from immunization, send-reminder calls helper, status transitions, snooze updates `dueAt`, gate, permission guard.

---

## Stage 25 — Clinical decision support rules

Rule engine evaluated client-side against patient state. Gated by `cds` feature flag.

**Agents:** `supabase-dexie-table-wiring` for `cds_rules`; admin card + engine by hand; `i18n-translator` for 11 locales.

- [ ] Supabase migration `00013_cds.sql` + Dexie + columns + hydrate — `supabase-dexie-table-wiring`. Fields: `id`, `orgId`, `name`, `description`, `active`, `trigger` (`on_open_patient | on_save_vitals | on_save_diagnosis | nightly`), `conditionJson`, `actionJson`, `createdBy`.
- [ ] [features.ts](src/lib/features.ts): add `'cds'`. [permissions.ts](src/lib/permissions.ts): `read:cds`, `write:cds`, `manage:cds_rules`.
- [ ] Engine: `src/lib/cds/engine.ts` — pure function `evaluate(rules, context)` returning fired actions. Condition DSL: `{ "all" | "any": [ { field, op, value } ] }` over `patient.*`, `vitals.latest.*`, `diagnoses.*`, `allergies.*`, `medications.*`, `immunizations.*`. Actions: `{ kind: 'show_reminder', severity, message }` or `{ kind: 'create_recall', reason, dueInDays }`.
- [ ] Hook `useCdsAlerts(patientId)` — recomputes reactively from Dexie; alerts render as a banner area above tabs in [PatientDetailPage.tsx](src/features/patients/PatientDetailPage.tsx).
- [ ] Admin UI `CdsRulesCard.tsx` in Settings — list + edit form with field/op/value builder (not raw JSON). Test-rule button shows what would fire for a sample patient.
- [ ] Optional starter rules in `src/lib/cds/seed-rules.ts`: BP follow-up (systolic ≥ 140 → recall), missed childhood immunization (age in months > N and no record of vaccine X → reminder), allergy/medication conflict (active medication whose name matches an active allergen → warn).
- [ ] i18n: new `cds` namespace + alert severity labels; `i18n-translator` for the rest.
- [ ] Tests: engine evaluation across condition combinations (lots of pure-function cases), alert rendering, rule CRUD, create-recall action writes a `recalls` row, gate, permission guard.

---

## Stage 26 — Admin custom form builder (additive)

Net-new admin-defined forms rendered in their own patient sub-tab. The existing 13 sub-features stay code-defined — no migration of allergies/diagnoses/notes/etc. Gated by `custom-forms` feature flag.

**Agents:** `supabase-dexie-table-wiring` for `form_templates` and `form_submissions`; builder UI + dynamic renderer by hand; `i18n-translator` for 11 locales.

- [ ] Supabase migration `00014_custom_forms.sql` + Dexie + columns + hydrate — `supabase-dexie-table-wiring`. Two tables:
  - `form_templates` (id, orgId, name, description, schemaJson, version, active, scope `'patient' | 'visit'`).
  - `form_submissions` (id, orgId, templateId, templateVersion, patientId, visitId, dataJson, submittedBy, submittedAt).
- [ ] Add `formSubmissions` to `PHI_TABLES` + `PHI_TABLE_TO_RESOURCE` (resource type `'form_submission'`).
- [ ] [features.ts](src/lib/features.ts): add `'custom-forms'`. [permissions.ts](src/lib/permissions.ts): `read:custom_forms`, `write:custom_forms`, `manage:form_templates`.
- [ ] `schemaJson` spec: array of fields `{ key, label, kind: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox' | 'rich-text', required, options? }`. Templates are versioned on edit; submissions pin their `templateVersion` for stable historical rendering.
- [ ] Renderer `<DynamicForm template={...} initialValues={...} onSubmit={...} />` — react-hook-form + Zod schema derived from template at runtime.
- [ ] Admin builder UI: `CustomFormsCard.tsx` in [SettingsPage.tsx](src/features/settings/SettingsPage.tsx) lists templates + new edit route `/settings/forms/$templateId` with add-field, reorder, preview.
- [ ] Dynamic patient sub-tab `PatientCustomForms.tsx` — lists every active patient-scope template the user has access to; expanding one shows submissions + "New entry". Gated.
- [ ] i18n: new `customForms` namespace; English by hand, `i18n-translator` for the rest.
- [ ] Tests: builder add/edit/reorder, template versioning preserves historical submission view (edit template adds a field, old submission still renders against its pinned version), dynamic form validation, submission round-trip, gate, permission guard.

---

## Stage 27 — Security & Privacy Hardening (ONC §170.315(d) readiness)

A pre-shipping security pass. The project will **not** pursue formal ONC Health IT certification — that's a paid process with accredited testing labs and is out of scope for the reasons listed in "Out of Scope". But the ONC (d)-series privacy & security criteria are an excellent checklist for "is this app actually safe to hand to a real clinic," so this stage works through them and implements the controls. Pair them with HIPAA Security Rule §164.308/§164.312 alignment and a general supply-chain pass.

Many controls already exist in partial form from earlier stages: `access_logs_seal()` trigger (Stage 15), `org_roles` custom roles (Stage 15), `<PermissionGuard>` + `usePermission` (Stage 3), Supabase RLS via `public.org_id()` (Stage 1+), `dompurify` rich-text sanitization (Stage 5), `PHI_TABLES` allow-list (Stage 15). This stage audits each, fills gaps, and adds what's missing. **No new feature flag** — security is on for everyone.

Each substage maps to one or more ONC criteria where applicable; cite them in the substage header so it's clear what box is being ticked.

### 27.1 — Authentication, MFA, session management (§170.315(d)(1), (d)(5), (d)(6), (d)(12), (d)(13))

- [ ] **Password policy** enforced at the Supabase Auth dashboard (min length 12, complexity) AND mirrored in the client-side Zod schema on `LoginPage` / first-user setup. Document the chosen policy in `src/features/auth/password-policy.ts` so both surfaces read the same constants.
- [ ] **MFA (TOTP)** via Supabase `supabase.auth.mfa.enroll()` — new `MfaSetupCard.tsx` in [SettingsPage.tsx](src/features/settings/SettingsPage.tsx) walks the user through QR enrollment, verify, and store. Admin can require MFA org-wide via new `org_settings.require_mfa` boolean (Supabase migration into `00001_initial_schema.sql` per the pre-deploy strategy). Login flow gains an MFA challenge step when the user has factors. Local-hub mode: TOTP is optional (Supabase Auth isn't running) — note this limitation in the card.
- [ ] **Account lockout** (§170.315(d)(1)): new `auth_attempts` table tracks failed sign-ins per email; after 5 in 15 minutes, lock the account for 15 minutes. Cleanup job purges entries older than 24h. Edge function `auth-attempts-record` writes failures from the LoginPage error handler. Lockout state surfaces as a generic "too many attempts" message — never confirm whether the email exists.
- [ ] **Automatic logoff** (§170.315(d)(5)): new `useIdleLogout(timeoutMinutes)` hook listens for mousemove/keydown/touchstart, signs the user out after configurable idle (default 15 minutes). Settings card `SessionTimeoutCard.tsx` lets admin set the org-wide value (5–60 min, stored on `org_settings`). Activity tracking is per-tab via `BroadcastChannel` so a busy tab keeps the others alive.
- [ ] **Re-auth for sensitive operations** (§170.315(d)(1)): wrap destructive admin actions (delete user, change role, export bulk PHI, disconnect cloud sync) in a `<ReauthGate>` that prompts for password before proceeding. New helper `requireRecentAuth(maxAgeSeconds)` checks `auth.user().updated_at`-derived freshness; prompts via dialog if stale.
- [ ] **Emergency access** (§170.315(d)(6)): "break-the-glass" mechanism for after-hours admin recovery. Admin can pre-designate up to 2 break-glass users in `OrgSettingsCard`. Break-glass sign-in path uses a one-time code (TOTP from a sealed offline backup), elevates the user to admin for 4 hours, and fires a `patientHistory`-style audit row tagged `event: 'emergency_access'`. Out of session: deactivate revoked break-glass keys via admin RPC.
- [ ] **Credential encryption** (§170.315(d)(12)): Supabase Auth already bcrypts passwords server-side; verify the client never stores raw credentials. Audit `electron/auth-cache.ts` and `electron/auth-local.ts` for any plaintext password retention — should be hashed-only.
- [ ] **i18n**: extend `settings` namespace for `mfa.*`, `sessionTimeout.*`, `reauth.*`, `emergencyAccess.*` keys; `i18n-translator` for the other 11 locales.
- [ ] **Tests**: lockout after N failed attempts, lockout window expires correctly, idle logout fires, multi-tab activity keeps session alive, MFA enrollment flow, MFA challenge on login, re-auth gate blocks unauthenticated action, emergency-access elevation + audit row.

### 27.2 — Audit log completeness & tamper-resistance (§170.315(d)(2), (d)(3), (d)(10))

- [ ] **Required audited events** — verify `access_logs` captures the full ONC §170.315(d)(2) event list: user authentication (success + failure), elevation of privilege, PHI access (view), PHI modification (create/update/delete), audit log access, system configuration changes (RLS toggles, role changes, feature flag toggles), export of PHI (CSV, PDF). Grep for `recordAccessLog(` / `access_logs` writes across `src/lib/db/access-log.ts`, every `PHI_TABLES` write path, and the CSV/PDF export buttons. Add missing call sites.
- [ ] **Audit log integrity** (§170.315(d)(2) tamper-resistance): augment `access_logs_seal()` BEFORE INSERT trigger with a hash chain — each row records `prev_hash` (sha256 of the previous row's `entry_hash` for the same `org_id`) and `entry_hash` (sha256 over the canonical row contents). Verification RPC `verify_access_log_chain(orgId, sinceTs)` walks the chain and returns the first index where the hash mismatches. Admin-only.
- [ ] **Audit log UI** — admin-only route `/settings/audit-log` (currently scattered across `patientHistory` per-patient view; this is the org-wide read-everything view). Filters: actor, resource type, action, date range. Reuses the verified-chain RPC to show a "log integrity: ✓ verified at <ts>" badge.
- [ ] **Audit log export** (§170.315(d)(3)): CSV + signed-PDF export of any filtered range. PDF embeds the hash chain head + verification timestamp so a regulator can detect post-hoc tampering.
- [ ] **Retention**: minimum 6-year retention per HIPAA. Document in `OrgSettingsCard` and add a "purge older than" admin action that requires re-auth (out of scope to ship a scheduled purge; just make the manual action available and audited).
- [ ] **Permissions**: `read:audit_log` permission already exists from Stage 15 — verify it's admin-only by default and is the only path that can SELECT from `access_logs`. RLS should reject SELECT for non-admins entirely.
- [ ] **Tests**: hash chain holds across N inserts, verification RPC catches a synthetic tamper, every `PHI_TABLES` write produces an `access_logs` row, audit-log RLS rejects non-admin SELECT, CSV/PDF export round-trip.

### 27.3 — Encryption at rest & in transit (§170.315(d)(7), (d)(9))

- [ ] **Trusted connection** (§170.315(d)(9)): force HTTPS in production. Vite build emits `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` via a `_headers` file for the static host (Cloudflare Pages / Netlify) or via a deployment-time middleware. Document HSTS preload submission in Stage 28.2.
- [ ] **End-user device encryption** (§170.315(d)(7)): IndexedDB / Dexie data is not application-level encrypted (browser-level OS encryption is the expected control). Document this in `docs/security.md` — operators must use FileVault (macOS) / BitLocker (Windows) / dm-crypt (Linux) on any device running the desktop hub or browsing the app. Add a check in the desktop hub setup wizard that detects an unencrypted volume on macOS/Windows and shows a warning step (best-effort; informational).
- [ ] **Backup encryption**: audit `electron/backup.ts` — verify backup `.tar.gz` outputs are encrypted with a user-supplied passphrase (AES-256-GCM via Node `crypto`). If not, add it. Restore prompts for the same passphrase. Update `HubCard` to capture the passphrase at backup-creation time. Lost-passphrase = lost-backup; document explicitly.
- [ ] **Storage bucket encryption** (`imaging`, `patient-documents` from Stage 21): Supabase Storage encrypts at rest by default — confirm and document. No additional client-side layer needed for v1.
- [ ] **CSP headers**: ship a strict Content-Security-Policy that allows only `'self'` + the configured Supabase URL + `https://fonts.gstatic.com` (Geist font). No inline scripts (Vite supports nonces; verify). No `'unsafe-eval'`. Test with a CSP-report-only header for one release before enforcing.
- [ ] **Subresource integrity** for any CDN-loaded assets (none currently — verify with `grep -rn "https://" public/ src/`).
- [ ] **Tests**: backup round-trip with passphrase, wrong passphrase rejected, CSP headers present in production build output, HSTS header in `_headers`.

### 27.4 — Data integrity verification (§170.315(d)(8))

- [ ] **PHI row hashing**: every `PHI_TABLES` row gains a server-computed `content_hash text` column (sha256 of canonical-JSON of all non-meta fields). Trigger recomputes on INSERT / UPDATE. Migration into `00001_initial_schema.sql` per pre-deploy strategy.
- [ ] **Verification RPC** `verify_record_integrity(table, id)` recomputes the hash from current row state and compares to the stored `content_hash`. Discrepancy = tampering (or a missed-migration bug). Admin-only.
- [ ] **Audit-log linkage**: when a PHI row is modified, the `access_logs` row records the `content_hash` before+after, so the audit log itself becomes a tamper-evident change log of the data.
- [ ] **No optimistic UI hack to circumvent**: writes go through `src/lib/db/write.ts` — verify the path doesn't allow a client to write a row to Dexie that, when synced, would land a row Supabase rejected. Sync queue must surface server-side trigger errors back to the user.
- [ ] **Tests**: hash recomputes correctly on update, integrity RPC catches simulated tampering, sync queue surfaces trigger rejections.

### 27.5 — Patient rights (HIPAA §164.524, §164.526, §164.528)

- [ ] **Right of access (§164.524)**: per-patient "Export all my data" action on `PatientDetailPage`. Produces a ZIP containing JSON dumps of every `PHI_TABLES` row scoped to that patient + all `patient-documents` and `imaging` files + the per-patient `patientHistory` rows + a manifest with hashes. Gated by `export:patient` permission; logged.
- [ ] **Right to amend (§164.526)**: existing edit flow already updates records and writes `patientHistory`. Add explicit "Request amendment" flow for cases where the clinician disagrees with a correction: stores both the original assertion and the amendment, with reason. Surfaces in the History tab as a paired entry.
- [ ] **Accounting of disclosures (§164.528)**: new `disclosures` table tracks PHI disclosed outside the org (insurance, public health reporting, etc.). Manual entry only — automated disclosure tracking is out of scope. Per-patient view in `PatientHistory` sub-tab as a separate section.
- [ ] **Notice of Privacy Practices**: stored as a configurable text field on `org_settings`. Surfaced to staff at first login (one-time acknowledgement, logged).
- [ ] `i18n`: extend `patient` namespace for `export.*`, `amendment.*`, `disclosure.*`; `i18n-translator` for the rest.
- [ ] **Tests**: export bundle contains all PHI for one patient and nothing for others, amendment preserves both versions, disclosure entry logged.

### 27.6 — Anomaly detection & incident response

- [ ] **Anomaly heuristics** in a nightly client-side reconcile (similar pattern to Stage 24 auto-generation): flag patterns in `access_logs` that suggest abuse:
  - N+ patient views by a single user in a 1-hour window (default N=50).
  - Off-hours access (user accesses PHI outside 06:00–22:00 local time).
  - Bulk export action (CSV/PDF of >10 patients in one session).
  - Failed-login burst against a single account.
- [ ] **Alert sink**: anomalies write to a new `security_alerts` table; admins see them in a dashboard widget `SecurityAlertsWidget.tsx` (admin-only, gated). Status: `new | acknowledged | dismissed`.
- [ ] **Breach notification workflow**: admin can mark an alert as a confirmed breach. Triggers a guided form capturing what data, how many records, when discovered, when contained — produces a printable PDF (HIPAA §164.404 notice template) via Stage 13 PDF infra.
- [ ] **Incident response runbook**: `docs/incident-response.md` — who to contact, how to revoke a leaked session token (force-sign-out all org members RPC), how to lock the org out of cloud sync, how to take a forensic snapshot.
- [ ] **Force-revoke RPC**: `revoke_org_sessions(orgId)` invalidates all active Supabase Auth sessions for the org. Admin only. Logged.
- [ ] **Tests**: heuristics fire correctly on synthetic data, breach PDF renders, force-revoke RPC drops sessions.

### 27.7 — Code & supply chain security

- [ ] `npm audit` → 0 high/critical findings. Fix or document any remaining moderate.
- [ ] **Dependabot or Renovate** wired in `.github/dependabot.yml` — weekly security updates auto-PR'd. Auto-merge minor security patches that pass CI; manual review for major.
- [ ] **Secret scanning** in CI: GitHub native secret scanning is on by default for public repos; add `gitleaks` to the CI workflow (`.github/workflows/test.yml`) to also catch in PRs to private deployments. Pre-commit hook in `.husky/pre-commit` runs `gitleaks protect --staged`.
- [ ] **XSS audit**: re-grep for `dangerouslySetInnerHTML` across `src/` — every occurrence must be downstream of `dompurify`. Audit Tiptap output rendering, PDF text fields, custom-form rich-text outputs (Stage 26).
- [ ] **SQL injection**: Supabase JS client parameterizes everything; grep for any `.from(...).select(\`...\${var}...\`)`-style string interpolation (should be zero). RPCs that take text input must use `quote_literal` or parameterized SECURITY DEFINER functions; audit each `00001_initial_schema.sql` function.
- [ ] **Dependency provenance**: pin `package-lock.json` (already pinned). Enable `npm ci` in CI (verify). Verify no `postinstall` scripts in dependencies that we haven't reviewed (`npm ls --all | grep -i install`).
- [ ] **Open redirect / CSRF**: TanStack Router is hash-free; no server-rendered forms. Supabase Auth uses session cookies + JWT — verify no manual `<form action>` posts to Supabase URLs. Edge functions verify the JWT.
- [ ] **License audit**: `license-checker --production --onlyAllow 'MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC;CC0-1.0;CC-BY-4.0;Unlicense;0BSD'`. Document any exceptions.
- [ ] **Tests**: CSP smoke test (load app under prod CSP, ensure no console violations), `gitleaks` exits clean on the current tree.

### 27.8 — Documentation, policy templates, BAA

These are written-document deliverables in `docs/` — not code. They exist so a small clinic actually has the paperwork to be compliant.

- [ ] `docs/security/risk-assessment.md` — HIPAA Security Risk Assessment template, pre-filled with the controls implemented above and identified residual risks (e.g. no DICOM viewer, no e-Rx transport, no SSO — each documented as accepted limitation).
- [ ] `docs/security/baa-template.md` — Business Associate Agreement template (legal review required; ships as a starting point, not legal advice).
- [ ] `docs/security/privacy-policy.md` + `docs/security/notice-of-privacy-practices.md` — generic templates the clinic can adapt.
- [ ] `docs/security/policies/` — access control policy, password policy, incident response policy, audit policy, retention policy, breach notification policy, sanctions policy, training policy. One short markdown per policy.
- [ ] `docs/security/training/` — HIPAA-awareness training outline for staff onboarding (~30 min reading + a short quiz the org admin tracks manually).
- [ ] `docs/security/onc-d-checklist.md` — explicit mapping of each ONC §170.315(d)(1–13) criterion to the code path that satisfies it (or marked "N/A — feature not present"). This is the "tick the boxes" artifact.
- [ ] **README link**: add a "Security & Compliance" section to README.md pointing at `docs/security/` and stating clearly: "HospitalRun 3 implements the technical controls of the ONC HIT Certification (d)-series and HIPAA Security Rule, but is NOT formally certified. Operators are responsible for administrative and physical safeguards."

### 27.9 — Backup, recovery, and disaster-recovery verification

- [ ] **Restore drill** of `electron/backup.ts` output on a clean machine — confirm passphrase prompt, confirm Dexie + Supabase config restore, confirm no data loss.
- [ ] **Supabase point-in-time recovery (PITR)** — verify the production project has PITR enabled (paid tier feature). Document the lookback window in `docs/security/onc-d-checklist.md`.
- [ ] **Document RPO/RTO**: with PITR (cloud) = RPO ~2 minutes / RTO ~1 hour; with hub backups only (local-hub) = RPO = since last manual backup / RTO ≈ time to restore + re-sync. Make this explicit so the operator's risk-assessment is accurate.
- [ ] **Failover smoke**: simulate cloud-Supabase outage with the hub running — verify the app keeps working offline-first, verify sync queue persists, verify on reconnect everything flushes.
- [ ] **Tests**: backup → restore round-trip in a Vitest integration test (using a temp directory and fake-indexeddb).

### 27.10 — External security review

- [ ] **Internal review pass**: invoke the `security-review` skill on the merged Stage 27 branch. Address every High and Medium finding; document any Low explicitly accepted in `docs/security/risk-assessment.md`.
- [ ] **External pentest** (out of scope to perform here, but tracked): when funding allows, contract a third-party HIPAA-experienced penetration tester for a one-week assessment. Findings folded back into a Stage 27 follow-up.
- [ ] **Bug bounty / responsible disclosure**: publish `.well-known/security.txt` per RFC 9116 + `SECURITY.md` at the repo root with disclosure contact. Acknowledge reports within 72h; coordinated disclosure within 90 days.

---

## Stage 28 — Production Readiness & Release

Final-phase tasks that aren't development work — they only matter once feature development is finishing up and we're ready to push to real users. None of these block earlier stages; they're collected here so they don't get lost in scattered "open items" inside finished stages. Tackle in the order below when the rest of the roadmap is complete (or when you specifically need one of these capabilities).

### 28.1 — First Supabase deploy

Several stages chose to edit `00001_initial_schema.sql` in place rather than add new migration files, because the schema has never been pushed to a real Supabase project. Once it ships somewhere, that strategy flips and every new schema change becomes its own `00002+`/`00003+` migration.

- [ ] Decide the production Supabase project (new project? promote staging?).
- [ ] Run the `supabase-cli` skill: `supabase db push` against the chosen project to apply the squashed `00001_initial_schema.sql`. Tables landing in this first push: everything in [src/lib/db/schema.ts](src/lib/db/schema.ts) — `organizations`, `profiles`, `patients`, `visits`, `appointments`, `labs`, `medications`, `imaging`, `incidents`, `diagnoses`, `allergies`, `notes`, `relatedPersons`, `careGoals`, `carePlans`, `patientHistory`, `org_features`, `user_features`, `org_roles`, `charge_items`, `invoices`, `invoice_line_items`, `payments`, `access_logs`, `inventory_items`, `inventory_transactions` — plus all custom Stages 16+ tables added between now and then.
- [ ] Verify the `access_logs_seal()` BEFORE INSERT trigger fires correctly against a real `auth.uid()` (it overwrites client-supplied identity fields).
- [ ] Verify the `trg_inventory_transactions_apply` trigger keeps `on_hand` in sync with the signed-delta rules.
- [ ] Verify the JWT access-token hook from `00003_jwt_claims.sql` + `00008_jwt_hook_grants.sql` (still inside the squashed file) injects `org_id` and `role` claims.
- [ ] Regenerate types: `supabase gen types typescript --project-id <id> > src/types/supabase.ts` (or whatever path the project ends up using).
- [ ] Update memory `project_supabase_migration_strategy.md` to mark the pre-deploy era done — from this point on, **never edit `00001_initial_schema.sql`**; add `00002_*.sql` files for every change.

### 28.2 — Hosted demo deployment

Stage 8.5 wired everything in the bundle (Vite `base`, PWA `start_url`/`scope`/`navigateFallback`, `.env.demo`, demo-mode route guards). The only thing left is picking a host and giving CI somewhere to push.

- [ ] **Decision:** pick a host. Candidates (cheapest/easiest first): Cloudflare Pages, GitHub Pages, Netlify, Vercel, S3+CloudFront. The build is fully static — any static host works.
- [ ] Add a GitHub Actions workflow (`.github/workflows/demo-deploy.yml`) that runs on `main` push: `npm ci` → `VITE_BASE_PATH=/demo/ npm run build` → upload `dist/` to the chosen host.
- [ ] Configure the host to serve `/demo/*` with SPA fallback (`index.html` for unknown routes). PWA precaches the shell so the service worker handles offline reload once cached.
- [ ] Verify the deployed bundle: anonymous landing redirects to a seeded patient list, no login screen, no Supabase config required.
- [ ] Add the live URL to the README and (optionally) to the GitHub repo's "Website" field.

### 28.3 — Desktop signing & first signed release

The GitHub Actions workflow at `.github/workflows/desktop-release.yml` is structurally complete (Node 20, native rebuild, per-OS matrix, signing env vars, `--publish never` + artifact upload, tag-gated release job). It needs assets and secrets before it can produce a usable signed binary.

- [ ] Add `build/icon.icns` (macOS, 1024×1024 base), `build/icon.ico` (Windows, multi-resolution), `build/icon.png` (Linux, 512×512). Use the same source artwork.
- [ ] Add `build/entitlements.mac.plist` for hardened-runtime notarization. Standard Electron template is fine — needs `com.apple.security.cs.allow-jit` and friends for the V8 runtime.
- [ ] Populate macOS signing secrets on the GitHub repo: `APPLE_ID`, `APPLE_PASSWORD` (app-specific password), `APPLE_TEAM_ID`, `CSC_LINK` (base64-encoded Developer ID Application .p12), `CSC_KEY_PASSWORD`. For Windows code-signing, add `WIN_CSC_LINK` + `WIN_CSC_KEY_PASSWORD` if a cert is available; otherwise the workflow ships unsigned Windows builds (users will see SmartScreen warnings).
- [ ] Tag `v3.2.0` (or whichever version is current) and verify the workflow produces `.dmg`, `.exe`, `.AppImage`, and `latest*.yml` files attached to the GitHub Release.
- [ ] Smoke test: install the signed .dmg on a fresh macOS box, confirm Gatekeeper accepts it, confirm `electron-updater` correctly checks `gustavochanchien/hospitalrun` for new versions.

### 28.4 — Pre-release verification sweep

Run before tagging the production-ready release.

- [ ] Full regression: `npm run lint && npm run test:run && npm run build && npm run preview`.
- [ ] Manual smoke of the LAN-first path (Stage 8 checklist: hub setup → admin → second device joins → bidirectional sync).
- [ ] Manual smoke of the cloud-connected path: hub setup → "Optional Supabase" → cloud connect → sync queue flushes → realtime updates land on second device.
- [ ] Audit `.env.example` covers every `VITE_*` variable the build expects.
- [ ] Confirm no `console.log` of patient data anywhere — `grep -rn "console\." src/` and read the surviving entries.
- [ ] Confirm the `access_logs_seal()` trigger is intact and audit-log RLS policies are admin-only SELECT.
- [ ] Confirm RLS is `ENABLE`d on every PHI table — there should be zero tables in [src/lib/db/schema.ts](src/lib/db/schema.ts) `PHI_TABLES` that lack a Supabase RLS policy.

---

## Out of Scope

Benchmarked against OpenEMR, scoped to what's plausibly relevant to small / under-resourced / often-offline / often-non-US clinics. US-regulatory items (formal **ONC HIT certification** process, C-CDA, US Core FHIR, Direct Trust, CMS CQM/AMC), US insurance billing (270/271, 837/835, UB-04, CMS-1500, EOBs, A/R, clearinghouses), and US-only integrations (USPS address verification, SureScripts e-Rx, DEA/NPI prescriber IDs, IIS immunization reporting) are excluded entirely — they don't fit the target user base.

(Note: the ONC §170.315(d)-series **technical privacy & security controls** themselves are implemented in [Stage 27](#stage-27--security--privacy-hardening-onc-170315d-readiness) — the project ticks the boxes but does not pursue the certification process.)

Each cluster below is roughly the size of one or more stages; pulling any of them back in would warrant its own roadmap section.

### Patient Portal
A separate patient-facing surface. Everything stays staff-facing in v3.
- Patient self-scheduling and recall reminders.
- Online bill payment.
- Secure patient ↔ provider messaging and chat.
- New-patient self-registration.
- Patient-facing views of labs, problems, medications, allergies, appointments.
- Public secure API for third-party patient-portal vendors.

### Clinical Depth
- **E-prescribing transport** — current Medication module is record-keeping only; no print/fax pipeline, no transmission to pharmacies, no formulary check.
- **DICOM viewer** — current Imaging stores PNG/JPEG previews via `storagePath`; no DICOM rendering, no series/slice/window-level navigation.
- **Review of Systems** — structured ROS template.
- **CAMOS (Computer-Aided Medical Ordering System)** — order-set library and order builder.
- **Specialty modules** — Ophthalmology/Optometry (Eye Module), Group Therapy notes, etc.
- **Voice recognition / dictation**.
- **Referrals module** — outbound/inbound referral tracking with status.
- **Paper chart tracking** — physical chart check-in/checkout for clinics transitioning from paper.

### Internal Communications
- **Clinic messaging** — staff-to-staff messages, task assignments, message inbox.

### Identity & Admin
- **SSO** — SAML / OIDC / LDAP. Auth is email/password via Supabase only.
- **Admin-configurable menu builder** — per-role menu composition UI (sidebar is currently code-defined; role→permission mapping already exists in `org_roles`).

### Internationalization Long Tail
- **Additional locales** beyond the 12 Stage 10 ships. OpenEMR carries ~30 (Albanian, Armenian, Czech, Danish, Dutch, Finnish, Greek, Hebrew, Hindi, Marathi, Persian, Polish, Romanian, Swedish, Tamil, Ukrainian, Vietnamese, etc.); add on demand from real deployments.

---

## Verification Per Stage

Run from inside `hospitalrun-3/` after each stage:

```bash
npm run lint
npm run test:run
npm run build
npm run preview   # smoke the prod bundle
```

Any Supabase schema change goes through the `supabase-cli` skill (`supabase db push` + `supabase gen types`) — never the dashboard SQL editor.
