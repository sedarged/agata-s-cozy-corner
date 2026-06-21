#!/usr/bin/env bash
# Agata — VPS setup / (re)deploy helper.
# Idempotent: safe to run again to update after `git pull`.
#
#   ./scripts/vps-setup.sh          # install deps + build
#   ./scripts/vps-setup.sh --run    # ... and then start the server in the foreground
#
# It does NOT touch systemd, Caddy, or your .env — see docs/VPS_DEPLOY.md for those.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
echo "▶ Agata setup in: $ROOT"

# 1. Node check (need 20+, repo builds on 22).
if ! command -v node >/dev/null 2>&1; then
  echo "✗ Node.js not found. Install Node 20+ (22 recommended) first — see docs/VPS_DEPLOY.md." >&2
  exit 1
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
echo "▶ Node $(node -v)"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "✗ Node $NODE_MAJOR is too old. Use Node 20+ (22 recommended)." >&2
  exit 1
fi

# 2. .env scaffold (never overwrites an existing one).
if [ ! -f .env ]; then
  cp .env.example .env
  echo "▶ Created .env from .env.example (all values optional — edit if you want Gigi)."
fi

# 3. Dependencies. Prefer a clean, lockfile-exact install.
if [ -f package-lock.json ]; then
  echo "▶ npm ci"
  npm ci
else
  echo "▶ npm install"
  npm install
fi

# 4. Build the production server bundle (.output/server/index.mjs).
echo "▶ npm run build"
npm run build

if [ ! -f .output/server/index.mjs ]; then
  echo "✗ Build did not produce .output/server/index.mjs" >&2
  exit 1
fi
echo "✓ Build OK → .output/server/index.mjs"

# 5. Optionally run it now.
if [ "${1:-}" = "--run" ]; then
  # Load .env so PORT/HOST/keys apply when run by hand.
  set -a; . ./.env; set +a
  echo "▶ Starting server on ${HOST:-127.0.0.1}:${PORT:-3000} (Ctrl+C to stop)"
  exec node .output/server/index.mjs
fi

cat <<'EOF'

✓ Done. Next:
  • Quick test:   PORT=3000 node .output/server/index.mjs   → open http://<vps>:3000
  • Run for real: set up systemd + Caddy (see docs/VPS_DEPLOY.md)
EOF
