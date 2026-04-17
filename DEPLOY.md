# Deploying HospitalRun 3

This guide is for a clinic IT person who wants to run HospitalRun 3 for their organization. **You do not need Node, the Supabase CLI, Docker, or any other tooling** — everything below is click-through in your web browser. The whole flow typically takes 10–15 minutes.

If you want to host the frontend on your own servers instead of a cloud provider, we also ship a Docker image — see [Self-hosting with Docker](#self-hosting-with-docker) below.

> **Before you start**, have these ready: a Supabase.com account, a Vercel or Netlify account (free tiers are fine), and a name and email for your first admin user.

---

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**.
2. Pick an organization, a project name (e.g. `hospitalrun`), a strong database password (save it somewhere — Supabase will not show it again), and the region closest to your users.
3. Wait ~2 minutes for the project to provision.

## 2. Apply the database schema

1. In the Supabase Dashboard, open **SQL Editor** → **New query**.
2. In a separate tab, open [`supabase/deploy.sql`](supabase/deploy.sql) from the HospitalRun repository. Click the raw-file / download button and copy the entire file.
3. Paste it into the Supabase SQL Editor and click **Run**.
4. You should see "Success. No rows returned." If you see `HospitalRun schema is already at version N`, that's expected — the deploy script is idempotent and skips reapplying an already-installed schema.

> **If the paste seems truncated** (very large files sometimes cut off in the SQL Editor on certain browsers), check that the very last line reads `-- end of deploy.sql`. If not, reload the page and try in a different browser.

## 3. Enable the JWT custom access token hook

This is the **one manual step** that can't be done via SQL. The app works without it (it falls back to a database lookup), but enabling it is much faster and is considered the correct production setup.

1. Dashboard → **Authentication** → **Hooks**.
2. Under *Custom Access Token hook*, click **Enable**.
3. Select `public.custom_access_token_hook` from the function dropdown.
4. Click **Save**.

## 4. Configure authentication

1. Dashboard → **Authentication** → **Sign In / Providers** → **Email**.
2. *Either* disable **Confirm email** (fine for internal clinic users), *or* configure SMTP first (Dashboard → Settings → Auth → SMTP) so invite emails actually get delivered. On hosted Supabase, email confirmations are **on by default** — if you skip this step, your first admin will never receive their confirmation email and can't log in.
3. If you plan to lock signups to your clinic only (recommended), set **Allowed email domains** to your clinic's domain under **Authentication → URL Configuration → Additional Redirect URLs** and rules.

## 5. Copy your API credentials

1. Dashboard → **Settings** → **API**.
2. Copy the **Project URL** (e.g. `https://abcxyz.supabase.co`).
3. Copy the **anon public** key — this is safe to expose to the browser. **Do NOT copy the `service_role` key** — that one is a server-only secret and should never leave the Supabase dashboard.

## 6. Deploy the frontend

Pick one of the two paths below.

### 6a. One-click cloud deploy (Vercel or Netlify)

Click one of the deploy buttons in the project [README](README.md) on GitHub.

Vercel or Netlify will prompt you to paste two environment variables:

- `VITE_SUPABASE_URL` — the Project URL from step 5.
- `VITE_SUPABASE_ANON_KEY` — the anon key from step 5.

Click **Deploy**. Your site will be live in 1–2 minutes at something like `hospitalrun-<your-name>.vercel.app` or `hospitalrun-<your-name>.netlify.app`.

### 6b. Self-hosting with Docker

Replace the env values with the ones from step 5 and run:

```bash
docker run -d --name hospitalrun -p 80:80 \
  -e SUPABASE_URL=https://abcxyz.supabase.co \
  -e SUPABASE_ANON_KEY=eyJ... \
  ghcr.io/hospitalrun/hospitalrun-3:latest
```

Put this behind your own reverse proxy (nginx, Caddy, Traefik, etc.) with TLS. The container writes `/config.json` at start so every browser on that origin gets the same config automatically.

> **If you omit the env vars**, the container still starts — the app routes every visitor to an in-browser `/setup` page where they can paste credentials. This is useful for a single-kiosk install but not recommended for multi-device clinics.

## 7. Create the first admin account

1. Open your deployed URL.
2. Click **Create an account**. Enter your name, email, and a strong password.
3. Check email confirmation inbox if you left confirmations enabled (step 4).
4. Log in. You should land on the dashboard and see your name in the sidebar.

Behind the scenes, the database trigger `handle_new_user` auto-creates an organization for your first admin and attaches you to it with `role = admin`.

## 8. Lock down public signups

**Do this as soon as your first admin is logged in.** Otherwise, every new signup at `/login` will create its *own* organization and become an admin of that org — a phantom-org accumulation problem.

1. Dashboard → **Authentication** → **Sign In / Providers** → **Email**.
2. Disable **Enable signups**.
3. From now on, add teammates through the in-app **Settings → Team → Invite** flow (requires the optional Edge Function — see below).

---

## Optional: enable member invites

The "Invite teammate by email" button in Settings → Team requires an Edge Function. Without it, the rest of the app works fine — admins just can't onboard new users by email.

To enable it:

1. Open [`supabase/functions/invite-member/index.ts`](supabase/functions/invite-member/index.ts) on GitHub and copy the file contents.
2. Dashboard → **Edge Functions** → **Deploy a new function**. Name it exactly `invite-member`, paste the code, click **Deploy**.
3. Open the function's **Secrets** tab → add `SITE_URL` = your deployed frontend URL (e.g. `https://hospitalrun.example-clinic.org`).

See [`supabase/functions/invite-member/README.md`](supabase/functions/invite-member/README.md) for details.

---

## Verifying it worked

- Sign up, log in, create a patient, create a visit, create a lab order.
- Open the same URL in a second browser tab, log in as the same user — watch a new patient appear live in the second tab (confirms Supabase Realtime is reaching the app).
- Turn off your network. The app should keep working from the local IndexedDB cache. Turn the network back on — pending writes should flush automatically.

---

## Production hardening checklist (recommended)

Not required to go live, but strongly recommended before putting real patient data in:

- [ ] **Point-in-time recovery** — Supabase → Settings → Database → enable PITR (paid feature).
- [ ] **Automated backups** — verify the default daily backups are running and test a restore.
- [ ] **SMTP** — configure a real email provider so password resets and invites work reliably.
- [ ] **Auth rate limits** — Supabase → Authentication → Rate Limits → tighten login, signup, and password-reset rate limits.
- [ ] **Storage backups** — plan for backing up the `imaging` storage bucket. Supabase doesn't back these up by default on free/pro tiers; use `supabase storage cp` or an S3-compatible sync.
- [ ] **Error monitoring** — add Sentry (or similar) using a client-side integration in the deployed frontend.
- [ ] **Custom domain** — point your own domain at the Vercel / Netlify / Docker host and enable TLS.
- [ ] **Second admin** — always have at least two admins so one lockout doesn't brick the whole org.
- [ ] **Access review** — set a quarterly reminder to review the Settings → Team member list and remove anyone who's left the clinic.
- [ ] **RLS sanity check** — in the SQL Editor, run `select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r';` — every table should show `relrowsecurity = t`.

---

## Upgrading

When a new HospitalRun 3 release comes out:

1. Open **SQL Editor** → **New query** → paste the latest [`supabase/deploy.sql`](supabase/deploy.sql). Already-applied migrations skip automatically; new ones apply in one transaction.
2. Redeploy the frontend — Vercel and Netlify do this on every git push if you linked a repository. For Docker, pull the new image (`docker pull ghcr.io/hospitalrun/hospitalrun-3:latest`) and restart.
3. The first time users open the app, a toast will prompt them to reload for the latest version (PWA service worker update flow).

If you see an **"Upgrade required"** screen after signing in, it means the database schema is older than what the frontend expects — re-run step 1.

---

## Security warnings

- **Never paste the `service_role` key** into `/config.json`, Vercel environment variables, Docker `-e` flags, a `.env` file, or anywhere else on the frontend. It lives only inside the Supabase dashboard as an Edge Function secret.
- **Never disable Row Level Security** on any table. Org isolation depends on it.
- **Never commit `.env`** — only `.env.example` goes in git.
- **Keep the Supabase project in a region with appropriate data-residency laws** for the patients whose data you'll store.
