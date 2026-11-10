# Deploy TONY to a VPS

Production stack: **Docker Compose + Caddy** (auto HTTPS) on any Ubuntu/Debian VPS.

## One-time VPS prep

```bash
# On a fresh Ubuntu 22.04+ VPS
curl -fsSL https://get.docker.com | sh
sudo apt-get install -y docker-compose-plugin git
```

Point your domain DNS **A record** at the VPS IP (optional but recommended for HTTPS).

## Option A — one-command deploy from your laptop

```bash
cp .env.example .env
# edit .env: set TONY_API_TOKEN (strong), GROQ_API_KEY, TONY_DOMAIN=tony.yourdomain.com

export VPS_HOST=your.vps.ip.or.domain
export VPS_USER=root          # or ubuntu
export VPS_SSH_KEY=~/.ssh/id_rsa
export TONY_DOMAIN=tony.yourdomain.com

chmod +x scripts/deploy-vps.sh
./scripts/deploy-vps.sh
```

Open:
- `https://tony.yourdomain.com/jarvis`
- `https://tony.yourdomain.com/health`

Authorize with header `Authorization: Bearer <TONY_API_TOKEN>` (JARVIS prompts for the token).

## Option B — on the VPS itself

```bash
git clone https://github.com/mafzalkalwardev/tony-ai-agent.git /opt/tony-ai-agent
cd /opt/tony-ai-agent
cp .env.example .env
# fill TONY_API_TOKEN, GROQ_API_KEY, TONY_DOMAIN=...
docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d --build
```

## Option C — GitHub Actions

Add repository secrets:

| Secret | Required | Purpose |
|--------|----------|---------|
| `VPS_HOST` | yes | IP or hostname |
| `VPS_SSH_KEY` | yes | Private key contents |
| `VPS_USER` | no | default `root` |
| `VPS_PORT` | no | default `22` |
| `TONY_DOMAIN` | no | defaults to `VPS_HOST` |
| `TONY_API_TOKEN` | yes | gateway auth |
| `GROQ_API_KEY` | recommended | LLM |
| `DEEPGRAM_API_KEY` | optional | STT |
| `ELEVENLABS_API_KEY` | optional | TTS |
| `TELEGRAM_BOT_TOKEN` | optional | remote |
| `DISCORD_WEBHOOK_URL` | optional | remote |

Then run **Actions → Deploy TONY to VPS → Run workflow**, or merge to `master`.

## Systemd (no Docker)

```bash
sudo useradd -r -m -d /opt/tony-ai-agent tony || true
sudo cp deploy/tony.service /etc/systemd/system/
cd /opt/tony-ai-agent && npm ci --omit=dev
sudo systemctl enable --now tony
```

Put Caddy/nginx in front for TLS.

## Security checklist

- [ ] Strong unique `TONY_API_TOKEN` (never commit)
- [ ] `TONY_SHELL_UNSAFE=false`
- [ ] `TONY_TRUSTED_MODE=false` until you intentionally enable it
- [ ] Firewall: only 22/80/443 open
- [ ] Backups: `Tony backup data` or volume snapshots of `tony_data`

## Health

```bash
curl -s https://$TONY_DOMAIN/health | jq .version
```
