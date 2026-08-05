# Backend deployment (production)

The backend is self-hosted on the user's home Ubuntu server — not a managed cloud platform.

## Server access

- `ssh llogarite-server` — direct connection, only works when on the same LAN (192.168.0.184).
- `ssh llogarite-server-remote` — works from anywhere, routed through the Cloudflare Tunnel and
  gated by Cloudflare Access (email one-time-code login), so SSH isn't exposed as an open port.
- Both aliases are in `~/.ssh/config` on the dev machine, using key `~/.ssh/id_ed25519_ralf_meca`.
- Server: Ubuntu 26.04 LTS, hostname `ralfsprivateserver`, user `denral`. Home-hosted — dynamic
  IP, no router port forwarding, which is why everything routes through Cloudflare Tunnel.
- Passwordless sudo is configured for `denral` (`/etc/sudoers.d/denral`).

## Domain & Cloudflare

Domain `llogarite.site` (registered at Namecheap) has its DNS managed by Cloudflare
(nameservers `collins.ns.cloudflare.com` / `piotr.ns.cloudflare.com`).

- `llogarite.site` / `www.llogarite.site` — the marketing website, hosted on GitHub Pages (plain
  A/CNAME records to `ralf-meca.github.io`). Unrelated to the tunnel below.
- `api.llogarite.site` — backend API, proxied through the tunnel to the server's Docker container
  on port 3000.
- `ssh.llogarite.site` — SSH, proxied through the same tunnel to port 22, gated by a Cloudflare
  Access application (Zero Trust → Access → Applications).

## Cloudflare Tunnel

- Named tunnel `llogarite-backend` (id `56a60fa7-8237-4d41-8c88-be874095a00d`), runs as a systemd
  service (`cloudflared.service`) on the server — enabled, survives reboots, auto-restarts.
- Config at `/etc/cloudflared/config.yml` holds the ingress rules for both hostnames above.
- Uses `protocol: http2`. This network's path to one Cloudflare region is unreliable over
  UDP/QUIC (the default), which caused connection failures — http2 (TCP) avoids that region.
- `/etc/systemd/system/cloudflared.service.d/override.conf` sets `TimeoutStartSec=120`. The
  default systemd start timeout was too short for the tunnel to find a working region and kept
  killing/restarting the service in a loop before it could connect. Don't remove this override.

## Docker deployment

- Repo cloned at `~/llogarite` on the server (public GitHub repo, plain `git clone`, no auth
  needed).
- `docker-compose.prod.yml` (repo root) runs two services: `postgres` and `backend` (built from
  `apps/backend/Dockerfile`, which builds from the monorepo root so npm workspace hoisting
  resolves correctly).
- A root-level `.env` next to `docker-compose.prod.yml` holds only `DATABASE_USER` /
  `DATABASE_PASSWORD` / `DATABASE_NAME`, for docker-compose's own `${...}` substitution in the
  `postgres` service block. This is separate from the backend's own env file below.
- `apps/backend/.env.production` holds the full backend env (DB creds, JWT secret, SMTP, Google
  client id) — generated fresh for production (different JWT secret and DB password than local
  dev), never committed, lives only on the server with `chmod 600`.
- Postgres data persists in a named volume (`postgres_data`) and is **not** exposed on a host
  port — only the `backend` container can reach it, over the compose network.

**To redeploy after a code change:**

```bash
ssh llogarite-server "cd ~/llogarite && git pull && docker compose -f docker-compose.prod.yml up -d --build"
```

## Mobile app config

`apps/mobile/eas.json`'s `production.env.EXPO_PUBLIC_API_URL` points at
`https://api.llogarite.site/api` — the permanent backend. Don't point production builds at a LAN
IP or a throwaway `trycloudflare.com` quick tunnel; those were only ever a stopgap before this
deployment existed.

**The server is the source of truth now** — don't spin up a local backend/Postgres/tunnel on the
dev machine as a stand-in for production testing anymore; use the server directly instead.
