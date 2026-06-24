# Agata — VPS deploy & ops runbook

This directory contains everything you need to bring Agata up on a fresh
Ubuntu/Debian VPS and keep it running 24/7. Every file here is idempotent
— re-running them won't break anything.

## What's in here

| File                   | Install where                             | Purpose                                                  |
| ---------------------- | ----------------------------------------- | -------------------------------------------------------- |
| `agata.service`        | `/etc/systemd/system/agata.service`       | systemd unit — runs the Node server, auto-restarts       |
| `Caddyfile`            | `/etc/caddy/Caddyfile` (or imported)      | Reverse proxy with auto-TLS (Let's Encrypt or Tailscale) |
| `agata-logrotate.conf` | `/etc/logrotate.d/agata`                  | Rotates Caddy logs (14 days, gzipped, capped)            |
| `journald-agata.conf`  | `/etc/systemd/journald.conf.d/agata.conf` | Caps journal size at 500 MB / 7 days                     |

## One-time bring-up

```bash
# 1. Clone + install deps
git clone <repo> /opt/agata && cd /opt/agata
./scripts/vps-setup.sh

# 2. Provision the dedicated user (no home, no shell — service-only)
sudo useradd --system --shell /usr/sbin/nologin --home /var/lib/agata agata

# 3. Provision data dir
sudo mkdir -p /var/lib/agata
sudo chown -R agata:agata /var/lib/agata
sudo chmod 750 /var/lib/agata

# 4. Provision the env file (CHMOD 600 — secrets)
sudo cp .env.example /etc/agata.env
sudo chmod 600 /etc/agata.env
sudo chown root:root /etc/agata.env
# Generate an AES-256 key for OAuth token encryption:
echo "GIGI_TOKEN_KEY=$(openssl rand -base64 32)" | sudo tee -a /etc/agata.env >/dev/null
# Edit with your AI keys (optional):
sudo $EDITOR /etc/agata.env

# 5. Install systemd + logrotate + journald configs
sudo cp deploy/agata.service        /etc/systemd/system/agata.service
sudo cp deploy/agata-logrotate.conf /etc/logrotate.d/agata
sudo mkdir -p /etc/systemd/journald.conf.d
sudo cp deploy/journald-agata.conf  /etc/systemd/journald.conf.d/agata.conf
sudo systemctl restart systemd-journald
sudo systemctl daemon-reload
sudo systemctl enable --now agata

# 6. Reverse proxy
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
# Edit the hostname in the Caddyfile (search for `agata.example.com`):
sudo $EDITOR /etc/caddy/Caddyfile
sudo systemctl reload caddy

# 7. Verify
curl -sI https://<your-hostname>/
curl -s https://<your-hostname>/api/health | jq
```

After step 7 you should see `{ "ok": true, "status": "ok", ... }` and a
2xx response from the root URL.

## Day-2 operations

### Update after `git pull`

```bash
cd /opt/agata
./scripts/vps-setup.sh          # npm ci + npm run build
sudo systemctl restart agata
```

The systemd unit has `Restart=on-failure` + `RestartSec=3`, so a crash
auto-recovers. No cron needed.

### Health check

```bash
curl -s https://<hostname>/api/health | jq
# → { "ok": true, "status": "ok", "nodeVersion": "v...", "uptime": 1234, "dbLatencyMs": 0.42 }
```

`dbLatencyMs` should stay under 50 ms — anything above 200 ms means
SQLite is contending (likely WAL checkpoint backlog).

### Tail logs

```bash
sudo journalctl -u agata -f        # app stdout/stderr
sudo journalctl -u caddy -f        # reverse-proxy
sudo tail -f /var/log/caddy/access.log
```

### Restart cleanly

```bash
sudo systemctl restart agata       # zero-downtime if the Caddy upstream pool
                                  # keeps the old socket open for ~5 s; new
                                  # requests hit the fresh process.
```

### Rotate logs manually

```bash
sudo systemctl reload caddy        # forces logrotate postrotate
sudo logrotate -f /etc/logrotate.d/agata
```

### Backup

The app is single-user, single-VPS, single-SQLite. Backup is one
command:

```bash
# Hot backup (no downtime — SQLite WAL makes this safe):
sudo -u agata sqlite3 /var/lib/agata/agata.db ".backup /var/lib/agata/agata-backup-$(date +%F).db"

# Or the file-based route (simpler but brief lock):
sudo systemctl stop agata
sudo cp /var/lib/agata/agata.db /var/lib/agata/agata-backup-$(date +%F).db
sudo systemctl start agata
```

Add to `/etc/cron.daily/agata-backup`:

```
0 3 * * * agata sqlite3 /var/lib/agata/agata.db ".backup /var/lib/agata/agata-backup-$(date +\%F).db"
```

## Troubleshooting

### "502 Bad Gateway" from Caddy

1. `sudo systemctl status agata` — is the process running?
2. `sudo journalctl -u agata -n 100` — last 100 lines from the app.
3. `curl -s http://127.0.0.1:3001/api/health` — does the app answer
   _without_ the reverse proxy in front? If yes, it's a Caddy config
   issue. If no, it's an app startup issue.

### "ERR_DLOPEN_FAILED: better-sqlite3" on startup

`better-sqlite3` is a native addon compiled against the Node version
that ran `npm install`. If you upgrade Node on the VPS you need to
rebuild:

```bash
cd /opt/agata
npm rebuild better-sqlite3
sudo systemctl restart agata
```

### "Port 3001 already in use"

```bash
sudo ss -ltnp | grep 3001     # who has it?
# If it's another Node service, change PORT in /etc/agata.env
sudo systemctl restart agata
```

### Health endpoint says `dbLatencyMs: 5000+`

The disk is probably slow, or the journal is doing a long sync. Check:

```bash
sudo iotop -o          # who's writing?
df -h /var/lib/agata   # is the disk full?
sudo journalctl --disk-usage
```

### OAuth ChatGPT keeps prompting the user

The token store needs `GIGI_TOKEN_KEY` to persist tokens across restarts.
Without it the user has to re-connect every time the server restarts.

```bash
grep GIGI_TOKEN_KEY /etc/agata.env    # should be a base64 string
sudo systemctl restart agata
```

### "Permission denied" on the data dir

The app runs as `agata:agata`. After a manual `chown` or a fresh
provisioning step the perms can drift:

```bash
sudo chown -R agata:agata /var/lib/agata
sudo chmod 750 /var/lib/agata
sudo systemctl restart agata
```

### Database locked forever

SQLite uses WAL + a 5-second busy timeout by default. If you see
"database is locked" for >10 s:

```bash
sudo -u agata sqlite3 /var/lib/agata/agata.db
> PRAGMA busy_timeout;
> PRAGMA wal_checkpoint(TRUNCATE);
> .quit
sudo systemctl restart agata
```

## Security checklist

- [ ] `/etc/agata.env` is mode 600, owned by root (not agata).
- [ ] `GIGI_TOKEN_KEY` is generated and present.
- [ ] Caddy listens only on the Tailscale/Private interface OR has
      basic auth in front of a public hostname.
- [ ] No firewall rule opens 3001 to the internet (only Caddy should
      see it).
- [ ] `npm audit` has no high/critical vulnerabilities.
- [ ] The data dir is on a filesystem with atime disabled (less disk
      wear, faster SQLite).

## Monitoring (optional)

Point Prometheus blackbox exporter at `/api/health`:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: agata
    metrics_path: /probe
    params:
      module: [http_2xx]
    static_configs:
      - targets:
          - https://<your-hostname>/api/health
    relabel_configs:
      - source_labels: [__address__]
        target_label: __param_target
      - source_labels: [__param_target]
        target_label: instance
      - target_label: __address__
        replacement: blackbox-exporter:9115
```

Or wire `/api/health` into Uptime Kuma / Healthchecks.io as an HTTPS
keyword monitor — the body contains `"ok":true`.

## Cloudflare Tunnel (public HTTPS via mycozylibary.com)

Optional path that puts Agata on the public internet behind a Cloudflare
Tunnel. **Coexists with the Tailscale + Caddy path above** — they don't
fight over ports:

- `cloudflared` makes _outbound_ connections to Cloudflare's edge; it
  binds no public port on the VPS.
- Caddy keeps listening on `:9443` for tailnet access.
- Both upstreams point at the same `127.0.0.1:3001` (the Node app).

So you can have `https://mycozylibary.com/` (public) and
`https://hermes-computer-1.tail4d5951.ts.net:9443/` (tailnet) live at
the same time. Roll back by stopping the cloudflared service — no VPS
infra changes to undo.

### Threat model (be aware before going public)

This is **a single-user app with no app-level auth**. The Cloudflare
front gives you HTTPS + a real domain, but does **not** gate access.
Anyone who guesses or scrapes the domain name can:

- Read every book, note, quote, and reading session in the database.
- Call `/api/chat` and consume your ChatGPT subscription quota.
- Call `/api/book-search/*` and use the VPS as a free proxy against
  Open Library / Google Books / BN (already rate-limited upstream; see
  `src/routes/api/book-search.batch.ts`).

You opted out of `GIGI_SECRET`, edge rate-limiting, and Cloudflare WAF
because it's a private single-user app. If you ever want to share a
screenshot link publicly, revisit this section.

### One-time setup (VPS side)

```bash
# 1. Install cloudflared (creates the `cloudflared` system user + group).
sudo apt install -y cloudflared

# 2. Login to Cloudflare from the VPS — opens a browser URL you paste
# locally, then the cert lands at /root/.cloudflared/cert.pem.
sudo cloudflared login

# 3. Create the tunnel. Cloudflare prints a UUID like
#    "a1b2c3d4-..." and a credentials JSON. Save both:
sudo cloudflared tunnel create agata-vps
# UUID shown above; credentials written to
#   /root/.cloudflared/<UUID>.json
sudo cp /root/.cloudflared/<UUID>.json /etc/cloudflared/<UUID>.json
sudo chmod 600 /etc/cloudflared/<UUID>.json
sudo chown root:root /etc/cloudflared/<UUID>.json

# 4. Drop the repo's unit + config template, fill in the UUID:
sudo cp deploy/cloudflared-agata.service /etc/systemd/system/
sudo cp deploy/cloudflared-config.example.yml /etc/cloudflared/config.yml
sudo sed -i "s|<TUNNEL_ID>|$UUID|g" /etc/cloudflared/config.yml
sudo chmod 644 /etc/cloudflared/config.yml

# 5. Enable + start.
sudo systemctl daemon-reload
sudo systemctl enable --now cloudflared-agata
systemctl status cloudflared-agata
```

### Cloudflare dashboard (one-time)

1. **Add the zone** — Cloudflare dashboard → Add Site → `mycozylibary.com`.
   Cloudflare will scan existing DNS records. Free tier is enough.
2. **Point nameservers** — copy the two `ns.cloudflare.com` nameservers
   Cloudflare gives you and update them at your registrar (where you
   bought `mycozylibary.com`). Propagation takes up to 48h.
3. **Create the public hostname route** — Cloudflare dashboard → Zero
   Trust → Networks → Tunnels → `agata-vps` → Public Hostnames → Add:
   - Subdomain: _(empty — apex)_
   - Domain: `mycozylibary.com`
   - Service: `http://127.0.0.1:3001`
     Then repeat for `www.mycozylibary.com` → same upstream (or 301 www →
     apex from a Cloudflare Page Rule).

### Update `CHATGPT_OAUTH_REDIRECT_URI` so the OAuth flow works

When the user clicks "Połącz konto ChatGPT" in Settings, OpenAI
redirects back to whatever URL the server told it to use during the
authorize step. With the app now reachable on the public domain, the
URL must match or OpenAI rejects the redirect:

```bash
# Append to /etc/agata.env (existing env file from §"One-time bring-up")
echo "CHATGPT_OAUTH_REDIRECT_URI=https://mycozylibary.com/api/chatgpt/callback" | sudo tee -a /etc/agata.env
sudo systemctl restart agata
```

The paste-the-URL hint + textarea placeholder in `ChatGPTConnectCard`
read this value via `/api/chatgpt/redirect-uri` (added in commit that
shipped the resolver). Hard-coded fallback is the loopback URL — so
if you ever unset the env var, the paste flow on `127.0.0.1:3001`
still works.

### Day-2: smoke checks

```bash
# Public URL responds (eventually, after DNS propagates).
curl -skI https://mycozylibary.com/             # 200 + Agata title
curl -sk  https://mycozylibary.com/api/health  # {"ok":true}

# Tailscale URL still works (regression check).
curl -skI https://hermes-computer-1.tail4d5951.ts.net:9443/

# Tunnel is connected.
sudo cloudflared tunnel info agata-vps

# Tunnel logs.
sudo journalctl -u cloudflared-agata -f
```

### Rollback

```bash
sudo systemctl disable --now cloudflared-agata
# Then in the Cloudflare dashboard: remove the Public Hostname routes
# (or delete the tunnel entirely). The VPS infra (Caddy, Agata, SQLite)
# is untouched and keeps serving the tailnet URL.
```
