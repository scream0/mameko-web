$ErrorActionPreference = "Stop"

Write-Host "=== [1/6] Checking mameko-postgres Container Status & Health ===" -ForegroundColor Cyan
$pgStatus = docker inspect mameko-postgres --format "{{.State.Status}}|{{.State.Health.Status}}|{{.Config.Image}}"
Write-Host "Postgres State: $pgStatus"
if ($pgStatus -notmatch "^running\|healthy\|") {
    throw "Container mameko-postgres is not running/healthy: $pgStatus"
}

Write-Host "`n=== [2/6] Checking mameko-api (FROM scratch, Non-Root) & mameko-tunnel Status ===" -ForegroundColor Cyan
$apiStatus = docker inspect mameko-api --format "{{.State.Status}}|{{.State.Health.Status}}|{{.Config.User}}|{{.Config.Image}}"
Write-Host "API State:      $apiStatus"
if ($apiStatus -notmatch "^running\|healthy\|65532:65532\|") {
    throw "Container mameko-api is not running/healthy as non-root 65532:65532: $apiStatus"
}
$tunnelStatus = docker inspect mameko-tunnel --format "{{.State.Status}}|{{.HostConfig.NetworkMode}}|{{.Config.Image}}"
Write-Host "Tunnel State:   $tunnelStatus"
if ($tunnelStatus -notmatch "^running\|container:") {
    throw "Container mameko-tunnel is not running or not attached to mameko-api network namespace: $tunnelStatus"
}

Write-Host "`n=== [3/6] Verifying Loopback-Only Port Bindings (127.0.0.1:5432 & 127.0.0.1:8080) ===" -ForegroundColor Cyan
foreach ($cname in @("mameko-postgres", "mameko-api")) {
    $ports = docker inspect $cname --format "{{json .NetworkSettings.Ports}}"
    Write-Host "$cname Ports: $ports"
    if ($ports -match '"HostIp":"0\.0\.0\.0"' -or $ports -match '"HostIp":"::"' -or $ports -match '"HostIp":""') {
        throw "SECURITY VIOLATION: $cname port is exposed on wildcard interface instead of 127.0.0.1!"
    }
}

Write-Host "`n=== [4/6] Verifying Postgres Entrypoint Helper (su-exec active, stale Go gosu removed) ===" -ForegroundColor Cyan
$gosuCheck = docker exec mameko-postgres sh -c "ls -l /usr/local/bin/gosu"
Write-Host "Entrypoint helper: $gosuCheck"
if ($gosuCheck -notmatch "su-exec") {
    throw "SECURITY WARNING: /usr/local/bin/gosu is not linked to Alpine su-exec!"
}

Write-Host "`n=== [5/6] Verifying Security Options (no-new-privileges on all 3 containers) ===" -ForegroundColor Cyan
foreach ($cname in @("mameko-postgres", "mameko-api", "mameko-tunnel")) {
    $secOpt = docker inspect $cname --format "{{json .HostConfig.SecurityOpt}}"
    Write-Host "$cname SecurityOpt: $secOpt"
    if ($secOpt -notmatch "no-new-privileges:true") {
        throw "SECURITY VIOLATION: $cname missing no-new-privileges:true!"
    }
}

Write-Host "`n=== [6/6] Verifying Local & Public Cloudflare Tunnel Health ===" -ForegroundColor Cyan
$localHealth = Invoke-RestMethod -Uri "http://127.0.0.1:8080/api/health" -TimeoutSec 5
Write-Host ("Local API:  {0} | DB: {1} | OpenConns: {2}" -f $localHealth.status, $localHealth.database, $localHealth.pool.open_connections)
if ($localHealth.database -ne "healthy") {
    throw "Local Backend API reported unhealthy database: $($localHealth.database)"
}

$pubHealth = Invoke-RestMethod -Uri "https://api.mameko.my.id/api/health" -TimeoutSec 10
Write-Host ("Public API: {0} | DB: {1} | LatencyMs: {2}" -f $pubHealth.status, $pubHealth.database, $pubHealth.latency_ms)
if ($pubHealth.database -ne "healthy") {
    throw "Public Cloudflare Tunnel API reported unhealthy database: $($pubHealth.database)"
}

Write-Host "`nALL FULL-DOCKER INFRASTRUCTURE & SECURITY CHECKS PASSED!" -ForegroundColor Green
