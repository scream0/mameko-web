---
name: mameko-docker-postgres-and-container-security
description: >-
  Mandatory standard and operational runbook for managing, hardening, scanning, backing up,
  and restoring the self-hosted Mameko Docker PostgreSQL infrastructure (mameko-infra),
  including custom Alpine Dockerfile hardening (su-exec over gosu), loopback-only port binding
  (127.0.0.1:5432), Docker Scout CVE remediation, .env secret isolation, and zero-data-loss upgrades.
---

# Mameko Docker PostgreSQL & Container Security Skill

Use this skill whenever creating, auditing, rebuilding, scanning, backing up, or modifying Docker containers, `Dockerfile`, or `docker-compose.yml` in `d:\Xar Project\mameko-infra` for the Mameko database infrastructure.

---

## 1. Mandatory Container & Network Hardening Rules

1. **Loopback-Only Port Binding (`127.0.0.1` Mandatory)**:
   - NEVER publish PostgreSQL to all interfaces (`"5432:5432"` binds `0.0.0.0:5432` and `[::]:5432`).
   - ALWAYS bind strictly to host loopback in `docker-compose.yml`:
     ```yaml
     ports:
       - "127.0.0.1:5432:5432"
     ```
   - `mameko-api` connects internally over the isolated `mameko-net` bridge (`mameko-db:5432`), while host administrative tools (`MamekoServer.exe`, backups) connect via `127.0.0.1:5432`. External traffic enters exclusively via `mameko-tunnel` (`network_mode: "service:mameko-api"`).

2. **Eliminate Stale Go Entrypoint Helpers via Multi-Stage Scratch Squash (`su-exec` Over `gosu`)**:
   - Upstream `postgres:*-alpine` ships `/usr/local/bin/gosu` compiled with older Go toolchains, introducing dozens of `golang/stdlib` CVEs in Docker Scout.
   - Simply running `rm -f /usr/local/bin/gosu` in a single-stage `Dockerfile` only writes an overlayfs whiteout while leaving the vulnerable binary inside parent OCI layers (so Docker Scout still flags all CVEs!).
   - ALWAYS use a **multi-stage `FROM scratch` squash** in `mameko-infra/Dockerfile` so `gosu` is physically absent from every OCI layer:
     ```dockerfile
     FROM postgres:16-alpine AS hardened-rootfs

     RUN apk update \
         && apk upgrade --no-cache \
         && apk add --no-cache su-exec \
         && rm -f /usr/local/bin/gosu \
         && ln -s /sbin/su-exec /usr/local/bin/gosu \
         && rm -rf /var/cache/apk/*

     FROM scratch
     COPY --from=hardened-rootfs / /
     ENV PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
         LANG=en_US.utf8 \
         PG_MAJOR=16 \
         PG_VERSION=16.15 \
         PGDATA=/var/lib/postgresql/data
     WORKDIR /
     VOLUME /var/lib/postgresql/data
     STOPSIGNAL SIGINT
     EXPOSE 5432
     ENTRYPOINT ["docker-entrypoint.sh"]
     CMD ["postgres"]
     ```

3. **Secret Isolation & Volume Safety**:
   - Store `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` in `mameko-infra/.env` (listed in `.gitignore`), never hardcoded in `docker-compose.yml`.
   - Maintain a sanitized `.env.example` template for documentation.
   - Pin PostgreSQL major version (`16`) to match `postgres_data/PG_VERSION`. Never change major image versions (`16` -> `17`) on an existing bind mount without an explicit `pg_dumpall` / `pg_upgrade` migration.

4. **Runtime Hardening & Shared Memory**:
   - Enforce `security_opt: ["no-new-privileges:true"]`.
   - Allocate `shm_size: 128mb` so parallel PostgreSQL queries and index builds never fail with `could not resize shared memory segment`.
   - Keep `healthcheck` active (`pg_isready -U $POSTGRES_USER -d $POSTGRES_DB`).

---

## 2. Zero-Data-Loss Maintenance & Rebuild Procedure

Follow these exact steps before rebuilding or recreating `mameko-postgres`:

### Step 1: Take a Verified Pre-Change Backup
```powershell
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "d:\Xar Project\mameko-infra\backups\backup_$timestamp.sql"
docker exec mameko-postgres pg_dump -U postgres -d mameko_db > $backupFile
if ((Get-Item $backupFile).Length -lt 1024) { throw "Backup failed or empty!" }
```

### Step 2: Rebuild & Recreate Container
> **Windows Docker Desktop Note**: When changing host port bindings (e.g. `0.0.0.0:5432` -> `127.0.0.1:5432`), run `docker compose down` before `docker compose up -d` so `wslrelay.exe` cleanly releases the TCP port before rebinding.

```powershell
Set-Location "d:\Xar Project\mameko-infra"
docker compose build --pull
docker compose down
docker compose up -d
```

### Step 3: Run Automated Security & Health Verification
Run the bundled verification script [verify-db-security.ps1](./scripts/verify-db-security.ps1):
```powershell
powershell -ExecutionPolicy Bypass -File "d:\Xar Project\mameko-app\.agents\skills\mameko-docker-postgres-and-container-security\scripts\verify-db-security.ps1"
```

---

## 3. Docker Scout Vulnerability Triage Policy

1. **Zero Critical CVE Gate**:
   - Run `docker scout cves mameko-postgres:16-hardened --only-severity critical`.
   - Critical CVE count MUST be `0`.
2. **Evaluating Upstream `not fixed` Alpine Packages**:
   - Packages pulled by `.postgresql-rundeps` such as `libxml2` may show `Fixed version: not fixed` until Alpine's security team publishes an `-r` revision.
   - Verify whether Mameko uses the affected feature (`mameko-backend` uses `jsonb` exclusively and zero SQL/XML `XMLPARSE`/`XPATH` functions). If unused and unpatched upstream, document as non-exploitable in runtime and pull patches periodically via `docker compose build --pull --no-cache`.

---

## 4. Emergency Restore Runbook

If a schema change or disk issue corrupts database state:
```powershell
# Restore from latest verified SQL snapshot in mameko-infra/backups/
Get-Content "d:\Xar Project\mameko-infra\backups\<latest_backup>.sql" | docker exec -i mameko-postgres psql -U postgres -d mameko_db
docker compose -f "d:\Xar Project\mameko-infra\docker-compose.yml" restart mameko-api mameko-tunnel
Invoke-RestMethod -Uri "http://127.0.0.1:8080/api/health"
```

