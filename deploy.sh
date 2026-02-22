#!/usr/bin/env bash
# SchoolConnect Atlas — DigitalOcean App Platform deploy helper
# Usage: ./deploy.sh [--create | --update | --status | --logs | --secrets]
set -euo pipefail

APP_SPEC=".do/app.yaml"
APP_NAME="schoolconnect-atlas"
BOLD="\033[1m"
RESET="\033[0m"
RED="\033[31m"
GREEN="\033[32m"
YELLOW="\033[33m"

# ── Helpers ───────────────────────────────────────────────────────────────────
check_doctl() {
  if ! command -v doctl &>/dev/null; then
    echo -e "${RED}doctl not found.${RESET} Install it first:"
    echo "  macOS:   brew install doctl"
    echo "  Linux:   curl -sL https://github.com/digitalocean/doctl/releases/latest/download/doctl-linux-amd64.tar.gz | tar xz && sudo mv doctl /usr/local/bin/"
    echo "  Windows: scoop install doctl"
    echo ""
    echo "Then authenticate: doctl auth init"
    exit 1
  fi
  if ! doctl account get &>/dev/null 2>&1; then
    echo -e "${RED}Not authenticated.${RESET} Run: doctl auth init"
    exit 1
  fi
}

check_secrets() {
  if grep -q "CHANGE_ME" "$APP_SPEC"; then
    echo -e "${RED}ERROR:${RESET} Found CHANGE_ME placeholders in $APP_SPEC."
    echo ""
    echo "Edit .do/app.yaml and replace:"
    echo "  SECRET_KEY               — generate with: openssl rand -hex 32"
    echo "  API_KEYS                 — comma-separated tokens for privileged access"
    echo "  NEXT_PUBLIC_MAPBOX_TOKEN — your Mapbox public token (starts with pk.)"
    echo ""
    echo "Or run: ./deploy.sh --secrets  (interactive prompt)"
    exit 1
  fi
}

get_app_id() {
  doctl apps list --format ID,Spec.Name --no-header 2>/dev/null \
    | awk -v name="$APP_NAME" '$2 == name { print $1 }' \
    | head -1
}

# ── Commands ──────────────────────────────────────────────────────────────────
cmd_create() {
  echo -e "${BOLD}=== SchoolConnect Atlas — First Deploy ===${RESET}"
  echo ""
  check_secrets
  echo -e "${GREEN}✓ No CHANGE_ME placeholders found${RESET}"
  echo ""
  echo "Creating app on DigitalOcean App Platform..."
  APP_ID=$(doctl apps create --spec "$APP_SPEC" --no-wait --format ID --no-header)
  echo ""
  echo -e "${GREEN}✓ App created — ID: $APP_ID${RESET}"
  echo ""
  echo "Deploy order: backend → frontend (frontend bakes in backend URL at build time)"
  echo ""
  echo -e "${BOLD}Next steps:${RESET}"
  echo "  1. Watch the deploy:  ./deploy.sh --logs"
  echo "  2. Check status:      ./deploy.sh --status"
  echo "  3. Enable PostGIS (if not applied by migrations):"
  echo "     doctl databases list        # get the database ID"
  echo "     doctl databases connection <db-id> --no-header"
  echo "     psql <url> -c 'CREATE EXTENSION IF NOT EXISTS postgis;'"
}

cmd_update() {
  APP_ID=$(get_app_id)
  if [[ -z "$APP_ID" ]]; then
    echo "App '$APP_NAME' not found. Run: ./deploy.sh --create"
    exit 1
  fi
  check_secrets
  echo "Updating app spec for $APP_NAME ($APP_ID)..."
  doctl apps update "$APP_ID" --spec "$APP_SPEC"
  echo -e "${GREEN}✓ Spec updated. New deployment triggered.${RESET}"
}

cmd_status() {
  APP_ID=$(get_app_id)
  if [[ -z "$APP_ID" ]]; then
    echo "App '$APP_NAME' not found. Run: ./deploy.sh --create"
    exit 1
  fi
  echo -e "${BOLD}App: $APP_NAME ($APP_ID)${RESET}"
  echo ""
  doctl apps get "$APP_ID"
  echo ""
  echo -e "${BOLD}Live URLs:${RESET}"
  doctl apps list-deployments "$APP_ID" --format Phase,CreatedAt,UpdatedAt --no-header | head -3
}

cmd_logs() {
  APP_ID=$(get_app_id)
  if [[ -z "$APP_ID" ]]; then
    echo "App '$APP_NAME' not found. Run: ./deploy.sh --create"
    exit 1
  fi
  echo "Tailing runtime logs for $APP_NAME ($APP_ID) — Ctrl+C to stop"
  doctl apps logs "$APP_ID" --type=run --follow
}

cmd_secrets() {
  APP_ID=$(get_app_id)
  echo -e "${BOLD}=== Set Secrets Interactively ===${RESET}"
  echo ""
  echo "Enter values for the three required secrets."
  echo "Values are stored encrypted in DigitalOcean."
  echo ""

  # Read SECRET_KEY
  read -rsp "SECRET_KEY (leave blank to generate): " SECRET_KEY
  echo ""
  if [[ -z "$SECRET_KEY" ]]; then
    SECRET_KEY=$(openssl rand -hex 32)
    echo -e "  Generated: ${GREEN}${SECRET_KEY:0:16}...${RESET}"
  fi

  # Read API_KEYS
  read -rp "API_KEYS (comma-separated, e.g. key1,key2): " API_KEYS
  [[ -z "$API_KEYS" ]] && { echo "API_KEYS cannot be empty"; exit 1; }

  # Read MAPBOX token
  read -rp "NEXT_PUBLIC_MAPBOX_TOKEN (starts with pk.): " MAPBOX_TOKEN
  [[ "$MAPBOX_TOKEN" != pk.* ]] && echo -e "${YELLOW}Warning: Mapbox tokens usually start with pk.${RESET}"

  # Update the yaml using sed and write to a temp file
  TMPFILE=$(mktemp)
  sed \
    -e "s|value: CHANGE_ME.*# SECRET_KEY|value: $SECRET_KEY|" \
    "$APP_SPEC" > "$TMPFILE"

  # Use python for multi-key replacement since sed can't track which CHANGE_ME is which
  python3 - "$APP_SPEC" "$SECRET_KEY" "$API_KEYS" "$MAPBOX_TOKEN" <<'PYEOF'
import sys, re

spec_path, secret_key, api_keys, mapbox_token = sys.argv[1:]
text = open(spec_path).read()

replacements = [
    ("SECRET_KEY", secret_key),
    ("API_KEYS", api_keys),
    ("NEXT_PUBLIC_MAPBOX_TOKEN", mapbox_token),
]

for key, val in replacements:
    # Match the block: - key: KEY\n        value: CHANGE_ME
    pattern = rf'(- key: {re.escape(key)}\s+value: )CHANGE_ME'
    text = re.sub(pattern, rf'\g<1>{val}', text)

open(spec_path, "w").write(text)
print("✓ .do/app.yaml updated with secret values.")
PYEOF

  rm -f "$TMPFILE"
  echo ""

  if [[ -n "$APP_ID" ]]; then
    read -rp "Apply updated spec to existing app now? (y/N) " apply
    if [[ "$apply" =~ ^[Yy]$ ]]; then
      doctl apps update "$APP_ID" --spec "$APP_SPEC"
      echo -e "${GREEN}✓ Secrets deployed.${RESET}"
    fi
  else
    echo "App not yet created. Run: ./deploy.sh --create"
  fi
}

# ── Main ──────────────────────────────────────────────────────────────────────
check_doctl

case "${1:---help}" in
  --create)  cmd_create  ;;
  --update)  cmd_update  ;;
  --status)  cmd_status  ;;
  --logs)    cmd_logs    ;;
  --secrets) cmd_secrets ;;
  *)
    echo -e "${BOLD}SchoolConnect Atlas — DigitalOcean Deploy Helper${RESET}"
    echo ""
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  --create   Create the app on DigitalOcean (first deploy)"
    echo "  --update   Push an updated .do/app.yaml spec to an existing app"
    echo "  --status   Show app status and live URLs"
    echo "  --logs     Tail runtime logs (Ctrl+C to stop)"
    echo "  --secrets  Interactively set SECRET_KEY, API_KEYS, MAPBOX_TOKEN"
    echo ""
    echo "Quick start:"
    echo "  brew install doctl          # install CLI"
    echo "  doctl auth init             # authenticate"
    echo "  ./deploy.sh --secrets       # set secrets"
    echo "  ./deploy.sh --create        # deploy"
    echo "  ./deploy.sh --status        # get URLs"
    ;;
esac
