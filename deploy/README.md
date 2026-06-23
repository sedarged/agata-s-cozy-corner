# Agata — VPS deploy & ops runbook

This directory contains everything you need to bring Agata up on a fresh
Ubuntu/Debian VPS and keep it running 24/7. Every file here is idempotent
— re-running them won't break anything.

## What's in here

| File                    | Install where                          | Purpose                                                  |
| ----------------------- | -------------------------------------- | -------------------------------------------------------- |
| `agata.service`         | `/etc/systemd/system/agata.service`    | systemd unit — runs the Node server, auto-restarts       |
| `Caddyfile`             | `/etc/caddy/Caddyfile` (or imported)   | Reverse proxy with auto-TLS (Let's Encrypt or Tailscale)  |
| `agata-logrotate.conf`  | `/etc/logrotate.d/agata`               | Rotates Caddy logs (14 days, gzipped, capped)            |
| `journald-agata.conf`   | `/etc/systemd/journald.conf.d/agata.conf` | Caps journal size at 500 MB / 7 days                  |

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
   *without* the reverse proxy in front? If yes, it's a Caddy config
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