#!/bin/sh
# Write /config.json from SUPABASE_URL + SUPABASE_ANON_KEY env vars.
# The app's runtime config loader (src/lib/supabase/client.ts) fetches this
# before mounting. If either var is unset, skip — the app will route to
# /setup and the admin can paste credentials in the browser instead.

set -eu

CONFIG_PATH=/usr/share/nginx/html/config.json

if [ -n "${SUPABASE_URL:-}" ] && [ -n "${SUPABASE_ANON_KEY:-}" ]; then
  # Escape double quotes and backslashes for safe JSON embedding.
  url=$(printf '%s' "$SUPABASE_URL" | sed 's/\\/\\\\/g; s/"/\\"/g')
  anon=$(printf '%s' "$SUPABASE_ANON_KEY" | sed 's/\\/\\\\/g; s/"/\\"/g')
  printf '{"url":"%s","anonKey":"%s"}\n' "$url" "$anon" > "$CONFIG_PATH"
  echo "hospitalrun: wrote $CONFIG_PATH"
else
  # Ensure a stale config from a previous build doesn't leak in.
  rm -f "$CONFIG_PATH"
  echo "hospitalrun: SUPABASE_URL/SUPABASE_ANON_KEY not set — app will use /setup wizard"
fi
