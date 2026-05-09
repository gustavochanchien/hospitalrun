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

---

## Desktop app (Electron) — for clinics

For rural clinics or any deployment where a single device hosts the app for the whole clinic, we ship a desktop installer that:

- Wraps the SPA in a native window (Mac / Windows).
- Hosts the SPA on the local network so tablets/laptops can connect from a browser without installing anything.
- Falls back to a peer-to-peer LAN sync relay when the cloud is unreachable, so doctor and nurse devices stay in sync during internet outages.
- Caches sign-in credentials on the hub for offline auth (must be online once for first-time setup).

### Install

1. Download the latest installer from the GitHub Releases page:
   - macOS: `HospitalRun-<version>.dmg` (universal, signed with Apple Developer ID once available)
   - Windows: `HospitalRun-Setup-<version>.exe` (NSIS; v1 ships unsigned — click through the SmartScreen warning the first time)
   - Linux: `HospitalRun-<version>.AppImage`
2. Open the installer and follow the prompts.

### First-run setup

On first launch the app shows a chooser:

- **Just this computer** — like the web app: connects to a Supabase project, runs only on this machine.
- **Run as a clinic hub** — this PC hosts HospitalRun for the clinic. Tablets and other laptops on the same wifi can use it via a browser.

For a clinic, pick **Run as a clinic hub**. Steps:

1. Connect to a Supabase project (create one at supabase.com, paste URL + anon key).
2. The app starts a local server on port 5174 and announces itself as `hospitalrun.local` on the network.
3. Note the LAN URL it shows you (e.g. `http://192.168.1.10:5174`). Bookmark it on each tablet.

### Day-to-day usage

- Tablets/laptops open the LAN URL in a browser. Auto-discovery via `hospitalrun.local` works on most networks; fall back to the IP if your router blocks mDNS.
- Each device has its own offline-capable copy of the data (Dexie + service worker). Reads work without internet; writes queue and flush.
- When the cloud is unreachable, devices sync to each other through the hub. When the cloud comes back, the hub flushes the queue.

### Offline auth

Users must sign in to cloud Supabase **at least once** to seed the hub's profile cache. After that, sign-in works even without internet — credentials are checked against the hub's cache.

Air-gapped clinics (never any internet) are not supported in v1.

### Backups (hub data)

Open **Settings → Desktop hub → Backup hub data now** to copy the LAN sync log, cached profiles, and signing keys to a folder of your choice. Cloud Supabase remains the canonical store for patient records, so this is recovery insurance for the hub itself rather than a primary backup.

To recover after hub data loss, open **Settings → Desktop hub → Restore from backup**, select the backup folder, and the hub will restart automatically with the restored state.

Schedule weekly external backups (USB drive, network share) for any hub running real patient data.

### Code signing (release manager)

The v1 release pipeline packages signed macOS builds when these GitHub repo secrets are set:

- `APPLE_ID` — Apple Developer email
- `APPLE_PASSWORD` — app-specific password (NOT your Apple ID password)
- `APPLE_TEAM_ID` — from developer.apple.com → Membership
- `CSC_LINK` (optional) — base64 of a `.p12` cert if not using API signing
- `CSC_KEY_PASSWORD` — password for the above

Without these, the workflow still produces a `.dmg`, but it ships unsigned and Gatekeeper will block it on launch. Right-click → **Open** bypasses this for testing only.

Windows EV cert support is parked for v1.1; for now Windows installers ship unsigned.

### HTTPS on the LAN

The desktop app currently serves over plain HTTP on port 5174. For production deployments with real patient data, add a TLS layer in front of the hub using one of these approaches:

**Option A — Caddy (recommended, zero config)**

Install [Caddy](https://caddyserver.com) on the hub machine. Create `Caddyfile`:

```
hospitalrun.example.internal {
    reverse_proxy localhost:5174
    tls internal
}
```

Run `caddy run`. Caddy generates a self-signed cert from its own internal CA. Import the CA once on each tablet via the URL it prints.

**Option B — nginx + mkcert**

```bash
mkcert -install && mkcert hospitalrun.local
# Then configure nginx to proxy to localhost:5174 using the generated cert.
```

**Option C — Isolated network (acceptable for low-risk environments)**

Run the clinic on a fully isolated wifi VLAN (no guest access, no internet bridge). Treat the LAN as you would internal file shares: physically secured, no external access. The app-level encryption (JWT auth, Supabase TLS for cloud sync) still applies.

The HubCard in Settings will show an HTTP warning as a reminder when TLS is not detected.

### Updating

When a new release ships, the desktop app prompts on next launch ("Update ready — install and restart"). Updates download in the background; nothing applies without your click.
