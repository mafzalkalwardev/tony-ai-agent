#!/usr/bin/env bash
# Deploy TONY to a VPS over SSH.
# Required env:
#   VPS_HOST          e.g. 203.0.113.10 or tony.example.com
#   VPS_USER          e.g. root or ubuntu
# Optional:
#   VPS_SSH_KEY       path to private key (default: ~/.ssh/id_rsa)
#   VPS_PORT          ssh port (default: 22)
#   TONY_DOMAIN       public domain for Caddy TLS (default: VPS_HOST)
#   REMOTE_DIR        default /opt/tony-ai-agent
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${VPS_HOST:?Set VPS_HOST}"
USER_NAME="${VPS_USER:-root}"
PORT="${VPS_PORT:-22}"
KEY="${VPS_SSH_KEY:-$HOME/.ssh/id_rsa}"
REMOTE_DIR="${REMOTE_DIR:-/opt/tony-ai-agent}"
DOMAIN="${TONY_DOMAIN:-$HOST}"

SSH=(ssh -p "$PORT" -o StrictHostKeyChecking=accept-new)
SCP=(scp -P "$PORT" -o StrictHostKeyChecking=accept-new)
if [[ -f "$KEY" ]]; then
  SSH+=(-i "$KEY")
  SCP+=(-i "$KEY")
fi
TARGET="${USER_NAME}@${HOST}"

echo "==> Preparing remote $TARGET:$REMOTE_DIR"
"${SSH[@]}" "$TARGET" "sudo mkdir -p '$REMOTE_DIR' && sudo chown -R \$USER:\$USER '$REMOTE_DIR' || mkdir -p '$REMOTE_DIR'"

echo "==> Syncing repo (excluding node_modules/data/.git)"
rsync -az --delete \
  -e "${SSH[*]}" \
  --exclude node_modules \
  --exclude data \
  --exclude data-test \
  --exclude .git \
  --exclude '.env' \
  "$ROOT/" "$TARGET:$REMOTE_DIR/"

echo "==> Ensuring Docker + compose on remote"
"${SSH[@]}" "$TARGET" 'bash -s' <<'REMOTE'
set -euo pipefail
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER" || true
fi
docker compose version >/dev/null 2>&1 || sudo apt-get update && sudo apt-get install -y docker-compose-plugin
REMOTE

echo "==> Writing remote .env (from local .env if present, else template)"
if [[ -f "$ROOT/.env" ]]; then
  "${SCP[@]}" "$ROOT/.env" "$TARGET:$REMOTE_DIR/.env"
else
  "${SSH[@]}" "$TARGET" "test -f '$REMOTE_DIR/.env' || cp '$REMOTE_DIR/.env.example' '$REMOTE_DIR/.env'"
fi

"${SSH[@]}" "$TARGET" "grep -q '^TONY_DOMAIN=' '$REMOTE_DIR/.env' && sed -i 's/^TONY_DOMAIN=.*/TONY_DOMAIN=$DOMAIN/' '$REMOTE_DIR/.env' || echo 'TONY_DOMAIN=$DOMAIN' >> '$REMOTE_DIR/.env'"
"${SSH[@]}" "$TARGET" "grep -q '^TONY_ENV=' '$REMOTE_DIR/.env' || echo 'TONY_ENV=production' >> '$REMOTE_DIR/.env'"
"${SSH[@]}" "$TARGET" "grep -q '^NODE_ENV=' '$REMOTE_DIR/.env' || echo 'NODE_ENV=production' >> '$REMOTE_DIR/.env'"

echo "==> Building and starting stack"
"${SSH[@]}" "$TARGET" "cd '$REMOTE_DIR' && docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d --build"

echo "==> Health check"
sleep 5
"${SSH[@]}" "$TARGET" "curl -fsS http://127.0.0.1:8787/health | head -c 400 || curl -fsS https://$DOMAIN/health | head -c 400 || true"

echo ""
echo "TONY deploy complete."
echo "  JARVIS:  https://$DOMAIN/jarvis"
echo "  Health:  https://$DOMAIN/health"
echo "  Token:   use TONY_API_TOKEN from .env"
