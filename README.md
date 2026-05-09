<div align="center">

<img src="https://raw.githubusercontent.com/HospitalRun/design/master/logo/horizontal/logo-on-transparent.png" alt="HospitalRun logo"/>

![Version](https://img.shields.io/badge/version-3.0.0--alpha-blue) ![Status](https://img.shields.io/badge/status-in%20development-brightgreen) ![React](https://img.shields.io/badge/react-19-61dafb) ![TypeScript](https://img.shields.io/badge/typescript-6-3178c6) ![Vite](https://img.shields.io/badge/vite-8-646cff) ![Supabase](https://img.shields.io/badge/supabase-2-3ecf8e) ![PWA](https://img.shields.io/badge/PWA-offline%20first-5a0fc8) ![License](https://img.shields.io/badge/license-MIT-green)

<hr />
</div>

**HospitalRun 3** is a modern rewrite of the [HospitalRun](https://github.com/HospitalRun/hospitalrun) hospital information system. Built with React 19, Vite, Supabase and Dexie.js, it follows an offline-first design that runs fully from the browser's IndexedDB and syncs to Postgres in the background.

We're working to deliver an HIS that makes usability the #1 requirement, is built specifically for developing-world environments where connectivity is unreliable, and seeks to give back time to patient care.

> ## ⚠️ About this fork
>
> **This is a brand-new community fork started to revive the HospitalRun project.** It is **not** affiliated with — and has **no connection to** — the original HospitalRun maintainers, the OpenJS Foundation, or any of the v1/v2 contributors **yet**. The original project has been inactive for some time, and this effort is an independent attempt to carry the mission forward on a modern stack.
>
> We would love to reconnect with the original maintainers and community in the future. If you are one of them, please reach out via a GitHub issue.

**<h3>‼️ Version 3 is currently under active development. APIs and schema may change. ‼️</h3>**

# FAQs

| Question                            | Answer                                                                                          |
| ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| "I want to help"                    | [Find out how](#contributing)                                                                   |
| "I have a question"                 | [Join the community](#community)                                                                |
| "I found a bug"                     | Open an issue on this repository                                                                |
| "How is this different from v2?"    | See [Project Structure](#project-structure) and [Application Infrastructure](#application-infrastructure) |
| "How do I run it locally?"          | [Quick Start](#quick-start)                                                                     |
| "How do I deploy it for my clinic?" | [Deploy](#deploy)                                                                               |

# Table of Contents

- [About this fork](#%EF%B8%8F-about-this-fork)
- [Deploy](#deploy)
- [Quick Start](#quick-start)
- [Scripts](#scripts)
- [Contributing](#contributing)
- [Community](#community)
- [Project Structure](#project-structure)
- [Application Infrastructure](#application-infrastructure)
- [Data Model](#data-model)
- [Security](#security)
- [Behind HospitalRun](#behind-hospitalrun)
- [License](#license)

# Deploy

**You don't need to install anything to deploy HospitalRun 3 for your clinic.** The full walkthrough — database, frontend, first admin account — is in [DEPLOY.md](DEPLOY.md) and takes about 15 minutes from a browser.

The short version:

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste [`supabase/deploy.sql`](supabase/deploy.sql), click Run.
3. Open **Authentication → Hooks**, enable *Custom Access Token* → `public.custom_access_token_hook`.
4. Copy your Project URL and anon key from **Settings → API**.
5. Click one of the deploy buttons below (or run the Docker image):

   [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FHospitalRun%2Fhospitalrun-3&env=VITE_SUPABASE_URL,VITE_SUPABASE_ANON_KEY&envDescription=Paste%20the%20Project%20URL%20and%20anon%20key%20from%20your%20Supabase%20project%20(Settings%20%E2%86%92%20API).&envLink=https%3A%2F%2Fgithub.com%2FHospitalRun%2Fhospitalrun-3%2Fblob%2Fmain%2FDEPLOY.md&project-name=hospitalrun&repository-name=hospitalrun)
   [![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https%3A%2F%2Fgithub.com%2FHospitalRun%2Fhospitalrun-3)

   Or self-host behind your own reverse proxy:

   ```bash
   docker run -p 80:80 \
     -e SUPABASE_URL=https://your-project.supabase.co \
     -e SUPABASE_ANON_KEY=your-anon-key \
     ghcr.io/hospitalrun/hospitalrun-3:latest
   ```

6. Open the deployed URL, sign up the first admin, then **disable public signups** in Supabase Auth settings.

See [DEPLOY.md](DEPLOY.md) for screenshots, hardening recommendations, and the optional member-invite Edge Function.

# Quick Start

```bash
cp .env.example .env          # add your Supabase URL + anon key
npm install
npm run dev                   # http://localhost:5173
```

Required environment variables (only these two are bundled to the client):

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

# Scripts

| Command             | Description                                    |
| ------------------- | ---------------------------------------------- |
| `npm run dev`       | Start Vite dev server with HMR                 |
| `npm run build`     | TypeScript check + production build to `dist/` |
| `npm run preview`   | Serve `dist/` locally to verify the prod build |
| `npm test`          | Run Vitest in watch mode                       |
| `npm run test:run`  | Single Vitest run (CI)                         |
| `npm run lint`      | ESLint check                                   |
| `npm run lint:fix`  | ESLint with auto-fix                           |
| `npm run setup:db`  | Bootstrap the local Supabase database (developer path) |
| `npm run build:deploy-sql` | Regenerate `supabase/deploy.sql` from migrations |

# Contributing

Interested in contributing to HospitalRun 3? There are many ways to get involved:

- Try the application locally (see [Quick Start](#quick-start))
- Request new features and report bugs
- Improve project documentation
- Contribute to the source code
- Translate text in the application (locales live in `src/lib/i18n/locales`)

# Community

Community channels for HospitalRun 3 are TBD. In the meantime, discussion happens through GitHub issues on this repository, and the upstream HospitalRun community continues at the [original Slack workspace](https://hospitalrun-slack.herokuapp.com).

# Project Structure

Unlike v2 (a monorepo of frontend / server / components / core / cli), HospitalRun 3 collapses everything into a single Vite app backed by Supabase — the server tier is replaced by Postgres + Auth + Realtime + Edge Functions, and the component library is replaced by shadcn/ui generated into the app.

| Layer        | Library / Tool                                | Where it lives                                  |
| ------------ | --------------------------------------------- | ----------------------------------------------- |
| Build        | Vite 8, `vite-plugin-pwa` (Workbox)           | `vite.config.ts`                                |
| Framework    | React 19 + TypeScript 6 (strict)              | `src/`                                          |
| Routing      | TanStack Router v1 (file-based)               | `src/routes/` (generated tree: `routeTree.gen.ts`) |
| UI           | shadcn/ui + Tailwind CSS v4 + Radix + lucide  | `src/components/ui/`, `src/components/layout/`  |
| Forms        | React Hook Form + Zod v4                      | per-feature `*.schema.ts`                       |
| Local DB     | Dexie.js v4 (+ `dexie-react-hooks`)           | `src/lib/db/`                                   |
| Cloud        | Supabase (Postgres + Auth + Realtime)         | `src/lib/supabase/`, `supabase/migrations/`     |
| Sync engine  | Custom (queue → flush → realtime fan-in)      | `src/lib/sync/`                                 |
| Server state | TanStack Query v5                             | per-feature hooks                               |
| Client state | Zustand v5                                    | `src/features/auth/auth.store.ts`               |
| Dates        | date-fns v4                                   | (no `moment`/`dayjs`)                           |
| Rich text    | Tiptap v3 + DOMPurify                         | `src/components/rich-text-editor.tsx`           |
| Calendar     | FullCalendar v6                               | appointments feature                            |
| Charts       | Recharts v3                                   | incidents visualize page                        |
| i18n         | i18next + react-i18next                       | `src/lib/i18n/`                                 |
| Testing      | Vitest v4 + RTL + `fake-indexeddb`            | colocated `*.test.ts(x)`                        |

Top-level layout:

```
hospitalrun-3/
├── public/                     # static assets, offline.html, PWA icons
├── scripts/                    # setup-db.sh and SQL helpers
├── supabase/
│   ├── config.toml
│   ├── migrations/             # 00001_initial_schema.sql (squashed)
│   └── functions/invite-member # Edge Function (server-side only)
└── src/
    ├── components/             # layout/, ui/ (shadcn), shared widgets
    ├── features/               # one folder per domain (auth, patients, …)
    ├── hooks/                  # online status, sync, PWA update, permissions
    ├── lib/                    # db/, supabase/, sync/, demo/, i18n/, theme/
    ├── routes/                 # TanStack Router file-based routes
    ├── test/                   # Vitest setup + helpers
    └── routeTree.gen.ts        # GENERATED — do not hand-edit
```

# Application Infrastructure

A visual representation of how the v3 modules interact:

```
                ┌─────────────────────────┐
                │     React UI (Vite)     │
                │  shadcn/ui + Tailwind   │
                └───────────┬─────────────┘
                            │ useLiveQuery (reactive reads)
                            ▼
   ┌────────────────────────────────────────────────┐
   │            Dexie (IndexedDB)  ◄─── source of   │
   │         15 tables + syncQueue       truth      │
   └───────┬───────────────────────────────▲────────┘
           │ flush queue                   │ upsert from realtime
           ▼                               │
   ┌────────────────┐               ┌──────┴───────┐
   │ sync engine    │──── HTTPS ───▶│   Supabase   │
   │ (write helper) │◀── Realtime ──│  Postgres +  │
   └────────────────┘   websocket   │  Auth + RLS  │
                                    └──────────────┘
```

Rules:

1. **Reads always come from Dexie** via `useLiveQuery` — never read from Supabase in components.
2. **Writes go through `src/lib/db/write.ts`** which puts the row in Dexie and the syncQueue in one transaction.
3. **Inbound sync** is owned by `src/lib/sync/realtime.ts` + `src/lib/sync/hydrate.ts`. Features never subscribe to Realtime themselves.
4. **Never block the UI on network.** If Supabase is unreachable the app still works fully from Dexie.
5. **Conflict resolution** is last-write-wins on `updatedAt`.

# Data Model

15 Dexie tables mirror the Supabase schema. Every syncable record carries `_synced` (pending upload) and `_deleted` (soft delete).

| Table           | Purpose                                              |
| --------------- | ---------------------------------------------------- |
| organizations   | Tenant org records                                   |
| profiles        | Per-user profile + role within an org                |
| patients        | Demographics, contact info, status                   |
| visits          | Patient encounters (planned / in-progress / finished)|
| appointments    | Scheduled events with start/end times                |
| labs            | Lab orders and results                               |
| medications     | Medication orders with 8-status lifecycle            |
| imaging         | Imaging requests and results                         |
| incidents       | Safety / quality incident reports                    |
| diagnoses       | ICD codes linked to patients                         |
| allergies       | Allergen, reaction, severity                         |
| notes           | Clinical notes per patient                           |
| relatedPersons  | Emergency contacts and family                        |
| careGoals       | Patient care goals with achievement tracking         |
| carePlans       | Care plan documents                                  |
| patientHistory  | Audit trail of patient record changes                |
| syncQueue       | Outbound write queue for Supabase sync               |

Snake_case ↔ camelCase mapping lives in `src/lib/db/columns.ts`.

# Security

HospitalRun 3 handles medical records. All patient data is treated as sensitive.

- Supabase **Row Level Security** enforces org-level isolation on every table.
- A **custom JWT access-token hook** (`public.custom_access_token_hook`) injects `org_id` and `role` claims.
- All routes that display patient data live under the `_auth` layout guard.
- Form input is validated with **Zod** before any database write.
- **No patient data is logged** — only user IDs and operation types.
- `.env` is gitignored — only `.env.example` is committed. The Supabase service-role key never appears in `src/`; it lives only in Edge Functions.
- Rich text output is sanitized with **DOMPurify**.

# Behind HospitalRun

HospitalRun 3 is an unaffiliated rewrite of the original [HospitalRun project](https://github.com/HospitalRun/hospitalrun), which was hosted by the [OpenJS Foundation](https://openjsf.org/projects/#atlarge) and built by a community of contributors over many years. Credit for the project's vision, design and clinical guidance belongs to the original founders, maintainers and contributors listed in the [upstream README](https://github.com/HospitalRun/hospitalrun#behind-hospitalrun).

# License

Released under the [MIT license](LICENSE).
