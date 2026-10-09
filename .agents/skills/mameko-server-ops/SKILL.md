---
name: mameko-server-ops
description: >-
  Standard and runbook for updating, rebuilding, deploying, managing, and health-checking
  the Mameko backend server, PM2 processes (mameko-api, mameko-tunnel), Cloudflare tunnel,
  database pool, zero-downtime restarts, and emergency rollback operations.
---

# Mameko Server Operations & Deployment Runbook

This skill provides mandatory operational standards, compilation instructions, PM2 process management rules, health audit procedures, and disaster recovery runbooks for the Mameko Golang backend server and Cloudflare tunnel services (`mameko-backend`).

---

## 1. Architecture of Server Services

The Mameko backend infrastructure runs on a Windows host using PM2 process manager configured in `ecosystem.config.js`:

| PM2 ID | Name | Executable | Port / Routing | Responsibility |
|---|---|---|---|---|
| **0** | `mameko-api` | `./api.exe` | `8080` (HTTP) | Core Go Fiber REST API, Supabase connection pool, Midtrans & Biteship webhooks |
| **1** | `mameko-tunnel` | `./cloudflared.exe` | Cloudflare Zero Trust | Ingress tunnel routing public HTTPS domain to local port 8080 |

### Key Files in `mameko-backend`:
- `cmd/api/main.go`: Application entrypoint with graceful shutdown listener.
- `ecosystem.config.js`: PM2 ecosystem definition, environment variables, restart policies.
- `start-services.bat`: Windows batch script to initialize PM2 processes on host boot.
- `backend.log`: Merged stdout/stderr application log for `mameko-api`.
- `tunnel.log`: Connectivity log for `cloudflared.exe`.

---

## 2. Standard Server Update Runbook (Step-by-Step)

Whenever changes are made to Go code, database queries, models, or routes, follow this exact sequence:

### Step 1: Pre-Build Code Audit & Static Analysis
Always run vet and package build checks to catch syntax or type errors before touching the running server:
```powershell
cd '..\mameko-backend'
go vet ./...
go build ./...
```
*If any compile errors or vet warnings occur, STOP immediately and fix them before proceeding.*

### Step 2: Safe Binary Compilation & Backup
Create a fast rollback backup of the current binary, then compile the new binary into `api.exe`:
```powershell
# Optional: Backup previous binary for instant rollback
if (Test-Path 'api.exe') { Copy-Item 'api.exe' 'api.exe.bak' -Force }

# Compile new binary
go build -o api.exe ./cmd/api
```

### Step 3: PM2 Process Restart
Restart the API process with PM2. If environment variables or `.env.local` changed, append `--update-env`:
```powershell
# Standard restart (Go Fiber drains active requests gracefully within 10s)
pm2 restart 0

# If environment variables in ecosystem.config.js changed:
pm2 restart 0 --update-env
```

### Step 4: Active Health & Pool Verification
Verify that the new server is up, healthy, and accepting requests:
```powershell
# Query local health endpoint
Invoke-RestMethod -Uri 'http://127.0.0.1:8080/api/health'
```

**Expected JSON Response:**
```json
{
  "status": "success",
  "message": "MAMEKO Backend is running",
  "database": "healthy",
  "latency_ms": 63,
  "pool": {
    "open_connections": 2,
    "in_use": 0,
    "idle": 2,
    "max_open_connections": 25,
    "wait_count": 0
  }
}
```
*Verify that `database` is `"healthy"` and `in_use` is within normal limits.*

---

## 3. Observability & Log Monitoring Standards

### Inspecting Runtime Logs
To monitor live requests, database queries, and any unhandled errors:
```powershell
# PM2 realtime log stream (last 50 lines)
pm2 logs mameko-api --lines 50

# Or read directly from merged log file
Get-Content -Tail 50 -Wait backend.log
```

### Checking Cloudflare Tunnel Health
Ensure `mameko-tunnel` is connected to Cloudflare Edge servers:
```powershell
pm2 status
pm2 logs mameko-tunnel --lines 30
```
Look for `Registered tunnel connection` in the tunnel logs. If the tunnel disconnected, run:
```powershell
pm2 restart 1
```

---

## 4. Emergency Rollback Runbook (Disaster Recovery)

If the new binary causes panics, infinite restart loops, or breaks mobile client compatibility:

1. **Check Crash Status**:
   ```powershell
   pm2 status
   pm2 logs mameko-api --err --lines 50
   ```
2. **Instant Binary Revert**:
   ```powershell
   if (Test-Path 'api.exe.bak') {
       pm2 stop 0
       Copy-Item 'api.exe.bak' 'api.exe' -Force
       pm2 start 0
   }
   ```
3. **Verify Recovery**:
   ```powershell
   Invoke-RestMethod -Uri 'http://127.0.0.1:8080/api/health'
   ```

---

## 5. Pre-Deployment Checklist

Before concluding any server update task, verify:
- [ ] `go vet ./...` exits with code 0.
- [ ] `api.exe` binary size and timestamp updated.
- [ ] `pm2 list` shows process 0 (`mameko-api`) status `online` with 0 continuous restart loops.
- [ ] `GET /api/health` returns HTTP 200 with `database: healthy`.
- [ ] Public domain ingress through Cloudflare tunnel is reachable from mobile and web clients.
