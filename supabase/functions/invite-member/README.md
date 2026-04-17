# invite-member Edge Function

Optional server-side function that powers the "Invite" and "Create user" flows in Settings → Team. Without it, admins can't add teammates by email, but everything else in the app works normally.

## Browser-only deploy (via the Supabase Dashboard)

1. Supabase Dashboard → **Edge Functions** → **Deploy a new function** → name it exactly `invite-member`.
2. Paste the contents of [`index.ts`](./index.ts) into the editor.
3. Click **Deploy function**.
4. Open the function → **Secrets** → add:
   - `SITE_URL` = the public URL of your deployed frontend (e.g. `https://hr.example-clinic.org`). Used to build the login redirect for invite emails. The function now returns `site_url_not_configured` if this is missing.
5. No other secrets needed. Supabase auto-injects `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` into the function runtime.

## CLI deploy (developers)

```bash
supabase functions deploy invite-member
supabase secrets set SITE_URL=https://hr.example-clinic.org
```

## Security notes

- The function verifies the caller is an `admin` in the same org before doing anything — non-admins get a 403.
- `SUPABASE_SERVICE_ROLE_KEY` is used only inside this function; it is never sent to the browser.
- Email validation and role allowlist (`admin | doctor | nurse | user`) are enforced server-side.
- Invited users are created with `invited_org_id` + `invited_role` metadata so the `handle_new_user` trigger attaches them to the correct org.
