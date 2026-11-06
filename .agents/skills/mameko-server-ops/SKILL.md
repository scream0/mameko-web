---
name: mameko-server-ops
description: >-
  Standard and runbook for updating, rebuilding, deploying, managing, and health-checking
  the self-hosted Mameko Full Docker Compose server stack (mameko-postgres, mameko-api,
  mameko-tunnel), Cloudflare Zero Trust tunnel, Resend Email OTP env management,
  zero-downtime container rollouts, and emergency image rollback operations.
---

# Mameko Server Operations & Deployment Runbook (Full Docker Stack)

This skill provides mandatory operational standards, container build & rollout instructions, log observability commands, and disaster recovery runbooks for the 100% containerized Mameko server infrastructure (PM2 has been retired).

---

## 1. Full Docker Compose Stack Architecture

The Mameko production infrastructure runs entirely inside Docker Compose (`d:\Xar Project\mameko-infra\docker-compose.yml`) across `d:\Xar Project\mameko-infra` and `d:\Xar Project\mameko-backend`:

| Layer | Container Name | Image / Base | Network / Binding | Responsibility |
| :--- | :--- | :--- | :--- | :--- |
| **Database** | `mameko-postgres` | `mameko-postgres:16-hardened` (Squashed Alpine + `su-exec`) | `mameko-net`, Host `127.0.0.1:5432` | Primary PostgreSQL 16 database (`auth` & `public` schemas) |
| **Backend API** | `mameko-api` | `mameko-api:hardened` (`FROM scratch`, Non-Root `65532:65532`, Go 1.27) | `mameko-net`, Host `127.0.0.1:8080` | Go Fiber REST API, Native JWT Auth, Native WebSocket (`/ws/chats`), Resend Email OTP, Midtrans & Biteship webhooks |
| **Edge Ingress** | `mameko-tunnel` | `cloudflare/cloudflared:latest` | `network_mode: "service:mameko-api"` (`https://api.mameko.my.id`) | Cloudflare Zero Trust tunnel sharing `mameko-api` loopback (`http://127.0.0.1:8080`) |

> **CRITICAL SIDECAR RULE (`network_mode: "service:mameko-api"`)**: Because `mameko-tunnel` shares the Linux network namespace of `mameko-api` (matching Cloudflare Zero Trust remote ingress `http://127.0.0.1:8080`), **ALWAYS include `mameko-tunnel` whenever restarting or recreating `mameko-api`** (`docker compose up -d --build mameko-api mameko-tunnel` or `docker compose restart mameko-api mameko-tunnel`). Restarting `mameko-api` alone without reattaching `mameko-tunnel` will leave `mameko-tunnel` attached to the old network sandbox and cause HTTP 502 on `api.mameko.my.id`.

### Key Files:
- `d:\Xar Project\mameko-infra\docker-compose.yml`: Unified 3-container stack definition with `service_healthy` dependencies, `no-new-privileges:true`, and JSON log rotation (`10m` x `3`).
- `d:\Xar Project\mameko-infra\Dockerfile` & `.env`: Hardened PostgreSQL 16 image definition and isolated DB credentials.
- `d:\Xar Project\mameko-infra\cloudflared\config.yml`: Container tunnel fallback config (credentials mounted `:ro` from `C:\Users\karim\.cloudflared\...json`).
- `d:\Xar Project\mameko-backend\Dockerfile` & `.dockerignore`: Multi-stage `golang:1.27-alpine` -> `FROM scratch` build with native `-healthcheck` flag.
- `d:\Xar Project\mameko-backend\.env.local`: Backend runtime secrets (`JWT_SECRET`, `RESEND_API_KEY`, Midtrans, Biteship, Cloudinary). Note: `docker-compose.yml` overrides `DATABASE_URL` inside the container to `@mameko-db:5432` while keeping `.env.local` on host pointing to `@127.0.0.1:5432` for host tools (`MamekoServer.exe`).
- `d:\Xar Project\mameko-backend\MamekoServer.exe` (`cmd/manager/main.go`) & `start-services.bat`: Windows desktop tray manager & startup launcher wrapping `docker compose`.

---

## 2. Standard Backend Update Runbook (Step-by-Step)

Whenever changes are made to Go code, database queries, models, routes, or `.env.local`:

### Step 1: Pre-Build Static Analysis
```powershell
Set-Location "d:\Xar Project\mameko-backend"
go vet ./...
```
*If any compile errors or vet warnings occur, STOP immediately and fix them before touching running containers.*

### Step 2: Tag Rollback Image & Rebuild/Rollout via Docker Compose
```powershell
Set-Location "d:\Xar Project\mameko-infra"
# Save current working image for instant rollback
docker image inspect mameko-api:hardened *> $null
if ($LASTEXITCODE -eq 0) { docker tag mameko-api:hardened mameko-api:rollback }

# Rebuild mameko-api and recreate both mameko-api + mameko-tunnel sidecar cleanly
docker compose up -d --build mameko-api mameko-tunnel
```

### Step 3: Full-Stack Health Verification (Local + Public Tunnel)
```powershell
Set-Location "d:\Xar Project\mameko-infra"
docker compose ps
Invoke-RestMethod -Uri "http://127.0.0.1:8080/api/health"
Invoke-RestMethod -Uri "https://api.mameko.my.id/api/health"
```
Verify all 3 containers are running (`mameko-postgres` `healthy`, `mameko-api` `healthy`, `mameko-tunnel` `Up`), and both local & public `/api/health` return `status: "success"` and `database: "healthy"`.

---

## 3. Observability, Resource Footprint & Log Monitoring

- **Backend API Logs**: `docker logs --tail 50 mameko-api` (or follow live with `docker logs -f mameko-api`)
- **Cloudflare Tunnel Logs**: `docker logs --tail 30 mameko-tunnel` (verify `Registered tunnel connection`)
- **Database Logs**: `docker logs --tail 50 mameko-postgres`
- **Live RAM & CPU Telemetry**: `docker stats --no-stream mameko-postgres mameko-api mameko-tunnel`

---

## 4. Emergency Rollback Runbook

If a newly built `mameko-api:hardened` container fails healthchecks or panics:
```powershell
Set-Location "d:\Xar Project\mameko-infra"
docker tag mameko-api:rollback mameko-api:hardened
docker compose up -d --no-build --force-recreate mameko-api mameko-tunnel
Invoke-RestMethod -Uri "http://127.0.0.1:8080/api/health"
Invoke-RestMethod -Uri "https://api.mameko.my.id/api/health"
```

---

## 5. Pre-Deployment Verification Checklist
- [ ] `go vet ./...` exits with code 0.
- [ ] `mameko-api:rollback` image tagged prior to rebuild.
- [ ] Both `mameko-api` AND `mameko-tunnel` recreated together (`docker compose up -d --build mameko-api mameko-tunnel`).
- [ ] `mameko-postgres` and `mameko-api` report `(healthy)`, bound strictly to `127.0.0.1:5432` and `127.0.0.1:8080`.
- [ ] Both `http://127.0.0.1:8080/api/health` and `https://api.mameko.my.id/api/health` return HTTP 200 with `database: "healthy"`.
