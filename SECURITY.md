# Security

HospitalRun 3 handles medical records. We take security seriously — both in the code we ship and in how we respond to reports.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security problems.** Instead:

- Email the maintainers (contact listed in the repository description / [README](README.md)), or
- Use GitHub's private vulnerability reporting: **Security** tab → **Report a vulnerability**.

Include:

1. A clear description of the issue and its impact.
2. Steps to reproduce, or a proof-of-concept.
3. The affected version (git SHA or release tag) and deployment configuration if relevant.
4. Whether you believe the issue is already being exploited.

We'll acknowledge receipt within 3 business days and aim to publish a fix within 30 days for high-severity issues. We ask that you do not publicly disclose details until a fix has shipped.

## Scope

**In scope:**

- The `hospitalrun-3` application source code.
- Supabase migrations and Row Level Security policies under `supabase/migrations/`.
- The `invite-member` Edge Function under `supabase/functions/`.
- The consolidated `deploy.sql` build script.

**Out of scope:**

- Supabase itself (report to Supabase directly).
- Clinic-side deployment configurations (each deployer is responsible for their own infrastructure, reverse proxy, TLS, and backup setup).
- Legacy v1/v2 code under `hospitalrun-frontend-master/`, `hospitalrun-server-master/`, `components-master/` — these are reference-only and not shipped.

## What we care about

- **PHI / patient data handling.** We do not log patient data anywhere — reports of logging, telemetry, or error messages containing patient names, DOBs, diagnoses, or free-text notes are always high priority.
- **Org isolation.** RLS must prevent any user from reading or writing data belonging to another organization. A policy misconfiguration that leaks across orgs is critical.
- **Auth bypass.** Any route that exposes patient data outside the `_auth` layout, or any way to forge a session with a different `org_id`, is critical.
- **XSS in rich-text / notes.** We sanitize HTML with DOMPurify. Bypasses of the sanitizer are in scope.
- **Dependency CVEs.** Dependabot is configured to auto-open security PRs — we review and merge these on a normal cadence.

## What is explicitly NOT a HIPAA / GDPR / third-party-audited product

HospitalRun 3 is open-source software. It gives you strong security building blocks (RLS, JWT claims, CSP, audit log) — but **shipping it to real patients is your responsibility**. We do not:

- Sign Business Associate Agreements (BAAs). Supabase offers a BAA on paid plans; you must enter into that directly with Supabase.
- Guarantee HIPAA or GDPR compliance. Compliance is a property of the *deployment*, not the software. Operator responsibilities include breach response, access logging review, user access removal, data retention policy, and TLS configuration.
- Provide a clinical safety case. HospitalRun is not a certified medical device and does not make any diagnostic or treatment claims.

If you need a certified, audited, BAA-covered HIS, HospitalRun 3 is probably not the right fit yet.
