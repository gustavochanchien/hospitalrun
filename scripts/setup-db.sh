#!/usr/bin/env bash
# HospitalRun 3 — Database Setup Script
# Sets up the Supabase database for a new deployment.
# Usage: ./scripts/setup-db.sh [project-ref]

set -euo pipefail

# ── Colours ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${BLUE}▶${RESET}  $*"; }
success() { echo -e "${GREEN}✓${RESET}  $*"; }
warn()    { echo -e "${YELLOW}⚠${RESET}  $*"; }
error()   { echo -e "${RED}✗${RESET}  $*" >&2; }
header()  { echo -e "\n${BOLD}$*${RESET}"; }

# ── Helpers ──────────────────────────────────────────────────────────────────
require_cmd() {
  if ! command -v "$1" &>/dev/null; then
    error "Required command not found: $1"
    echo "  Install it with: $2"
    exit 1
  fi
}

# ── 1. Prerequisites ─────────────────────────────────────────────────────────
header "Checking prerequisites…"

require_cmd supabase "brew install supabase/tap/supabase"
require_cmd node     "https://nodejs.org"

SUPABASE_VERSION=$(supabase --version 2>&1 | head -1)
success "Supabase CLI found: $SUPABASE_VERSION"
success "Node $(node --version) found"

# ── 2. Supabase login ────────────────────────────────────────────────────────
header "Checking Supabase authentication…"

if ! supabase projects list &>/dev/null; then
  warn "Not logged in to Supabase. Opening browser for login…"
  supabase login
else
  success "Already logged in to Supabase"
fi

# ── 3. Project ref ───────────────────────────────────────────────────────────
header "Linking Supabase project…"

PROJECT_REF="${1:-}"

if [[ -z "$PROJECT_REF" ]]; then
  echo ""
  info "Your projects:"
  supabase projects list 2>/dev/null || true
  echo ""
  echo -e "${BOLD}Find your project ref in the Supabase dashboard URL:${RESET}"
  echo "  https://supabase.com/dashboard/project/<project-ref>"
  echo ""
  read -rp "Enter your project ref: " PROJECT_REF
fi

if [[ -z "$PROJECT_REF" ]]; then
  error "No project ref provided. Exiting."
  exit 1
fi

info "Linking to project: $PROJECT_REF"
supabase link --project-ref "$PROJECT_REF"
success "Project linked"

# ── 4. Push migrations ───────────────────────────────────────────────────────
header "Applying database migrations…"

info "Running: supabase db push"
supabase db push

success "All migrations applied"

# ── 5. .env setup ────────────────────────────────────────────────────────────
header "Environment variables…"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"
ENV_EXAMPLE="$PROJECT_DIR/.env.example"

if [[ -f "$ENV_FILE" ]]; then
  success ".env already exists — skipping"
else
  info "Creating .env from .env.example…"
  cp "$ENV_EXAMPLE" "$ENV_FILE"

  echo ""
  warn ".env created with placeholder values. You need to fill in:"
  echo ""
  echo "  VITE_SUPABASE_URL   → Dashboard → Settings → API → Project URL"
  echo "  VITE_SUPABASE_ANON_KEY → Dashboard → Settings → API → anon public key"
  echo ""
  read -rp "Enter your Supabase project URL (or press Enter to fill in manually later): " SUPABASE_URL
  if [[ -n "$SUPABASE_URL" ]]; then
    sed -i.bak "s|https://your-project.supabase.co|$SUPABASE_URL|" "$ENV_FILE" && rm -f "$ENV_FILE.bak"
    success "VITE_SUPABASE_URL set"
  fi

  read -rp "Enter your Supabase anon key (or press Enter to fill in manually later): " ANON_KEY
  if [[ -n "$ANON_KEY" ]]; then
    sed -i.bak "s|your-anon-key|$ANON_KEY|" "$ENV_FILE" && rm -f "$ENV_FILE.bak"
    success "VITE_SUPABASE_ANON_KEY set"
  fi
fi

# ── 6. Post-setup instructions ───────────────────────────────────────────────
header "One manual step required"

echo ""
echo -e "${YELLOW}The custom JWT hook cannot be configured via the CLI.${RESET}"
echo "Complete it in the Supabase dashboard:"
echo ""
echo -e "  1. Go to ${BOLD}Authentication → Hooks${RESET}"
echo -e "  2. Enable ${BOLD}Custom Access Token${RESET} hook"
echo -e "  3. Select function: ${BOLD}public.custom_access_token_hook${RESET}"
echo ""
echo "Without this, users can log in but org/role data won't be in their JWT."
echo ""

# ── Done ─────────────────────────────────────────────────────────────────────
echo -e "${GREEN}${BOLD}Setup complete!${RESET}"
echo ""
echo "To start the app:"
echo ""
echo "  cd $(basename "$PROJECT_DIR")"
echo "  npm install"
echo "  npm run dev"
echo ""
