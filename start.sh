#!/usr/bin/env bash
set -euo pipefail

# ─── Project config ──────────────────────────────────────────────────────────
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_NAME="$(basename "$PROJECT_DIR")"
SLUG="project-webshop-template"
DB_NAME="project_webshop_template"
DB_USER="cms"
DB_PASSWORD="cms_local_password"

# Resolve the cms-ai-core checkout. Prefer an explicit CMS_CORE_DIR; otherwise
# try the sibling `cms-ai-core-1` (the working clone on the dev machine) then
# the conventional `cms-ai-core`.
if [[ -z "${CMS_CORE_DIR:-}" ]]; then
  for cand in cms-ai-core-1 cms-ai-core; do
    if [[ -d "$(dirname "$PROJECT_DIR")/$cand" ]]; then
      CMS_CORE_DIR="$(dirname "$PROJECT_DIR")/$cand"
      break
    fi
  done
fi
CMS_CORE_DIR="${CMS_CORE_DIR:-$(dirname "$PROJECT_DIR")/cms-ai-core}"
PID_FILE="$PROJECT_DIR/.dev-pids"

# Portable file mtime (GNU stat first, then BSD/macOS).
file_mtime() { stat -c %Y "$1" 2>/dev/null || stat -f %m "$1" 2>/dev/null || echo 0; }

# ─── Helpers ─────────────────────────────────────────────────────────────────
RESERVED_FILE=$(mktemp)
find_free_port() {
  local port="${1:-3000}"
  while lsof -iTCP:"$port" -sTCP:LISTEN &>/dev/null || \
        lsof -i6TCP:"$port" -sTCP:LISTEN &>/dev/null || \
        grep -qw "$port" "$RESERVED_FILE" 2>/dev/null; do
    port=$((port + 1))
  done
  echo "$port" >> "$RESERVED_FILE"
  echo "$port"
}

cleanup() {
  echo ""
  echo "Shutting down..."
  if [[ -f "$PID_FILE" ]]; then
    while read -r pid; do
      kill "$pid" 2>/dev/null || true
    done < "$PID_FILE"
    rm -f "$PID_FILE"
  fi
  cd "$PROJECT_DIR" && docker compose down 2>/dev/null || true
  echo "Stopped."
}
trap cleanup EXIT INT TERM

# ─── Check prerequisites ────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "Error: Docker is not installed." >&2
  exit 1
fi

if ! command -v pnpm &>/dev/null; then
  echo "Error: pnpm is not installed." >&2
  exit 1
fi

if [[ ! -d "$CMS_CORE_DIR" ]]; then
  echo "Error: cms-ai-core not found at $CMS_CORE_DIR" >&2
  echo "Set CMS_CORE_DIR env var to the correct path." >&2
  exit 1
fi

# ─── Find free ports ────────────────────────────────────────────────────────
PORT_DB=$(find_free_port 5432)
PORT_WEB=$(find_free_port 3000)
PORT_API=$(find_free_port 3001)
PORT_ADMIN=$(find_free_port 5173)
rm -f "$RESERVED_FILE"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Starting: $PROJECT_NAME"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  Core: $CMS_CORE_DIR"
echo "  Ports:"
echo "    Database   → localhost:$PORT_DB"
echo "    CMS API    → localhost:$PORT_API"
echo "    CMS Admin  → localhost:$PORT_ADMIN"
echo "    Website    → localhost:$PORT_WEB"
echo ""

# ─── 1. Start database ──────────────────────────────────────────────────────
echo "Starting database..."
cd "$PROJECT_DIR"
DB_PORT="$PORT_DB" docker compose up -d --wait 2>/dev/null

# ─── 2. Run migrations (idempotent) ──────────────────────────────────────────
echo "Running migrations..."
cd "$CMS_CORE_DIR/apps/api"
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:$PORT_DB/$DB_NAME" \
  npx tsx src/migrate.ts

# ─── 3. Seed default developer user (idempotent) ─────────────────────────────
echo "Seeding developer user..."
cd "$CMS_CORE_DIR/apps/api"
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:$PORT_DB/$DB_NAME" \
  SEED_ADMIN_EMAIL="developer@artkod.com" \
  SEED_ADMIN_PASSWORD="k0dart" \
  SEED_ADMIN_ROLE="developer" \
  npx tsx src/seed.ts

# ─── 3b. Seed per-project data (strings + runtime page types) ─────────────────
if [[ -f "$PROJECT_DIR/project-data.seed.json" ]]; then
  echo "Seeding project data (strings + page types)..."
  cd "$CMS_CORE_DIR/apps/api"
  DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:$PORT_DB/$DB_NAME" \
    PROJECT_SLUG="$SLUG" \
    PROJECT_DATA_FILE="$PROJECT_DIR/project-data.seed.json" \
    npx tsx src/seed-project-data.ts
fi

# ─── 4. Build admin package (if source changed or not built yet) ─────────────
ADMIN_BASE_DIST="$CMS_CORE_DIR/packages/admin-base/dist/index.js"
ADMIN_BASE_SRC="$CMS_CORE_DIR/packages/admin-base/src"
VITE_CACHE="$PROJECT_DIR/admin/node_modules/.vite"

needs_rebuild=false
if [[ ! -f "$ADMIN_BASE_DIST" ]]; then
  needs_rebuild=true
elif find "$ADMIN_BASE_SRC" -newer "$ADMIN_BASE_DIST" | grep -q .; then
  needs_rebuild=true
fi

if [[ "$needs_rebuild" == true ]]; then
  echo "Building admin package..."
  cd "$CMS_CORE_DIR"
  pnpm --filter @cms/admin-base build
fi

# ─── 5. Install project admin deps (first run only) ──────────────────────────
if [[ ! -d "$PROJECT_DIR/admin/node_modules" ]]; then
  echo "Installing project admin dependencies..."
  cd "$PROJECT_DIR/admin"
  pnpm install
fi

# Sync admin-base dist into pnpm virtual store (pnpm copies file: deps at install
# time and won't pick up rebuilds until the store is updated manually).
PNPM_ADMIN_BASE_DIST=$(readlink -f "$PROJECT_DIR/admin/node_modules/@cms/admin-base/dist" 2>/dev/null || \
  find "$PROJECT_DIR/admin/node_modules/.pnpm" -path "*/admin-base/dist" -type d 2>/dev/null | head -1)
if [[ -n "$PNPM_ADMIN_BASE_DIST" ]]; then
  cp "$CMS_CORE_DIR/packages/admin-base/dist/index.js"  "$PNPM_ADMIN_BASE_DIST/index.js" 2>/dev/null || true
  cp "$CMS_CORE_DIR/packages/admin-base/dist/index.d.ts" "$PNPM_ADMIN_BASE_DIST/index.d.ts" 2>/dev/null || true
fi

rm -rf "$VITE_CACHE"

# ─── 6. Start CMS API ────────────────────────────────────────────────────────
# COMMERCE_ENABLED=true — this is the webshop test project, so the API mounts the
# commerce routes and applies the commerce migration set on boot (creates the
# categories / shop_settings tables). Must match createAdmin({ commerce: true }).
echo "Starting CMS API (commerce enabled)..."
cd "$CMS_CORE_DIR"
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:$PORT_DB/$DB_NAME" \
  PORT="$PORT_API" \
  COMMERCE_ENABLED=true \
  pnpm --filter @cms/api dev &
API_PID=$!
echo "$API_PID" > "$PID_FILE"

echo -n "Waiting for API..."
for i in $(seq 1 30); do
  if curl -s -o /dev/null http://localhost:"$PORT_API"/api/health 2>/dev/null; then
    echo " ready!"
    break
  fi
  echo -n "."
  sleep 1
done

# ─── 7. Start project admin ──────────────────────────────────────────────────
echo "Starting project admin..."
cd "$PROJECT_DIR/admin"
VITE_API_URL="http://localhost:$PORT_API" \
  VITE_FRONTEND_URL="http://localhost:$PORT_WEB" \
  ADMIN_PORT="$PORT_ADMIN" \
  pnpm dev &
ADMIN_PID=$!
echo "$ADMIN_PID" >> "$PID_FILE"

# ─── Watch admin-base dist and hot-sync into pnpm cache on rebuild ───────────
(
  last_mtime=""
  while true; do
    sleep 2
    current_mtime=$(file_mtime "$ADMIN_BASE_DIST")
    if [[ "$current_mtime" != "$last_mtime" && -n "$last_mtime" ]]; then
      if [[ -n "$PNPM_ADMIN_BASE_DIST" ]]; then
        cp "$ADMIN_BASE_DIST" "$PNPM_ADMIN_BASE_DIST/index.js" 2>/dev/null || true
        cp "$CMS_CORE_DIR/packages/admin-base/dist/index.d.ts" \
           "$PNPM_ADMIN_BASE_DIST/index.d.ts" 2>/dev/null || true
      fi
      rm -rf "$VITE_CACHE"
      kill "$ADMIN_PID" 2>/dev/null || true
      sleep 1
      cd "$PROJECT_DIR/admin"
      VITE_API_URL="http://localhost:$PORT_API" \
        VITE_FRONTEND_URL="http://localhost:$PORT_WEB" \
        ADMIN_PORT="$PORT_ADMIN" \
        pnpm dev &
      ADMIN_PID=$!
      echo "  ↻  admin-base updated — admin server restarted (reload your browser tab)"
    fi
    last_mtime="$current_mtime"
  done
) &
WATCHER_PID=$!
echo "$WATCHER_PID" >> "$PID_FILE"

# ─── 8. Start frontend ──────────────────────────────────────────────────────
# Clear the frontend's Vite optimized-deps cache so a re-vendored @cms/storefront
# (file:./vendor/storefront — refreshed by `pnpm vendor:storefront` / a git pull)
# is re-bundled. Without this, Vite keeps serving the previous pre-bundle and new
# SDK methods (e.g. the L4.4 shipping calls) are missing at runtime → silent
# failures. Same reason §5 clears the admin's .vite cache after syncing admin-base.
rm -rf "$PROJECT_DIR/node_modules/.vite"

echo "Starting frontend..."
cd "$PROJECT_DIR"
VITE_CMS_API_URL="http://localhost:$PORT_API" \
  npx vite --port "$PORT_WEB" &
WEB_PID=$!
echo "$WEB_PID" >> "$PID_FILE"

echo -n "Waiting for website..."
for i in $(seq 1 30); do
  if curl -s -o /dev/null http://localhost:"$PORT_WEB" 2>/dev/null; then
    echo " ready!"
    break
  fi
  echo -n "."
  sleep 1
done

# ─── Ready ───────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  $PROJECT_NAME is running!"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  Admin:   http://localhost:$PORT_ADMIN"
echo "  Website: http://localhost:$PORT_WEB"
echo "  API:     http://localhost:$PORT_API"
echo ""
echo "  Press Ctrl+C to stop everything."
echo ""

wait
