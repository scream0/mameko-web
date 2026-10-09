---
name: mameko-backend-dev
description: >-
  Standard and runbook for developing, auditing, and optimizing the Mameko Golang Backend API
  (Go Fiber + pgx/stdlib + database/sql + Supabase PostgreSQL), including connection pooling,
  PgBouncer transaction mode, graceful shutdown, query lifecycle, and health monitoring.
---

# Mameko Backend Golang Development & Connection Pool Skill

This skill provides architectural standards, connection pool rules, and runbooks for developing, optimizing, and maintaining the Mameko Golang Backend API (`xar-backend-go` / `mameko-backend`).

---

## 1. Database Connection Pool Architecture (PostgreSQL & Supabase)

### The Problem with Go `database/sql` Defaults
When connecting to PostgreSQL with `stdlib.OpenDB(*connConfig)` without explicit pool configuration, Go applies default values that cause severe production failures:
1. **`MaxOpenConns = 0` (Unlimited)**: Under traffic spikes or concurrent mobile clients, Go opens unlimited sockets. Supabase/PgBouncer rejects connections with `FATAL: sorry, too many clients already`.
2. **`MaxIdleConns = 2`**: Excess connections are destroyed immediately after a burst, causing constant TCP/TLS handshake renegotiation (200–500ms latency spikes) for subsequent queries.
3. **`ConnMaxLifetime = 0` (Never expires)**: Idle connections are held forever. Cloud load balancers (AWS/Supabase NAT) silently drop idle TCP sockets after 5–10 minutes, leading to `driver: bad connection` or `connection reset by peer`.
4. **`ConnMaxIdleTime = 0`**: Idle connections are never pruned, permanently hogging slots in PgBouncer.

### Mandatory Connection Pool Configuration
Every database initialization in `internal/config/database.go` must configure connection pool parameters with sensible defaults and environment variable overrides:

```go
// Default configuration tuned for Supabase Free/Pro tiers + Go Fiber concurrency
maxOpenConns := getEnvInt("DB_MAX_OPEN_CONNS", 25)
maxIdleConns := getEnvInt("DB_MAX_IDLE_CONNS", 15)
connMaxLifetimeMin := getEnvInt("DB_CONN_MAX_LIFETIME_MINUTES", 5)
connMaxIdleTimeMin := getEnvInt("DB_CONN_MAX_IDLE_TIME_MINUTES", 2)

db.SetMaxOpenConns(maxOpenConns)
db.SetMaxIdleConns(maxIdleConns)
db.SetConnMaxLifetime(time.Duration(connMaxLifetimeMin) * time.Minute)
db.SetConnMaxIdleTime(time.Duration(connMaxIdleTimeMin) * time.Minute)
```

### Supabase PgBouncer (Transaction Pooler) Compatibility
When connecting to Supabase PgBouncer on port `6543` (transaction mode):
1. **Disable Prepared Statement Caching**:
   ```go
   connConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
   ```
   PgBouncer in transaction pooling mode does not support session-level prepared statements.
2. **Sizing Alignment**: Client `DB_MAX_OPEN_CONNS` must remain below the database instance max connection pool (typically 20–30 for starter instances).

---

## 2. Query & Transaction Lifecycle Rules

### 1. Mandatory `defer rows.Close()`
Every `db.Query(...)` or `tx.Query(...)` MUST immediately be followed by `defer rows.Close()` to return the connection to the pool:
```go
rows, err := config.DB.Query(query, args...)
if err != nil {
    return err
}
defer rows.Close() // Mandatory! Prevents connection pool leak.
```

### 2. Mandatory Transaction Pattern
Transactions MUST always use the safe defer rollback pattern:
```go
tx, err := config.DB.Begin()
if err != nil {
    return err
}
defer tx.Rollback() // Safe: no-op if tx.Commit() succeeds, cleans up if error occurs

// ... execute operations using tx.Exec / tx.Query ...

if err := tx.Commit(); err != nil {
    return err
}
```

### 3. Query Execution Context & Timeouts
For external queries or long-running operations, use `context.WithTimeout` (e.g. 5–10s) to prevent queries from hanging pool slots indefinitely:
```go
ctx, cancel := context.WithTimeout(c.Context(), 5*time.Second)
defer cancel()

row := config.DB.QueryRowContext(ctx, query, args...)
```

---

## 3. Observability & Connection Pool Monitoring

### Active Health Check
The `/api/health` endpoint must actively verify database responsiveness and report pool status:
```go
func HealthCheck(c *fiber.Ctx) error {
    ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
    defer cancel()

    dbStatus := "healthy"
    if err := config.DB.PingContext(ctx); err != nil {
        dbStatus = "unhealthy: " + err.Error()
    }

    stats := config.DB.Stats()

    return c.Status(fiber.StatusOK).JSON(fiber.Map{
        "status":   "success",
        "database": dbStatus,
        "pool": fiber.Map{
            "max_open_connections": stats.MaxOpenConnections,
            "open_connections":     stats.OpenConnections,
            "in_use":               stats.InUse,
            "idle":                 stats.Idle,
            "wait_count":           stats.WaitCount,
            "wait_duration_ms":     stats.WaitDuration.Milliseconds(),
            "max_idle_closed":      stats.MaxIdleClosed,
            "max_lifetime_closed":  stats.MaxLifetimeClosed,
        },
    })
}
```

---

## 4. Graceful Shutdown Standard

In `cmd/api/main.go`, never terminate abruptly with unhandled `app.Listen()`. Catch termination signals, gracefully drain active HTTP requests, and close the database pool:

```go
// Run Fiber in background goroutine
go func() {
    if err := app.Listen(":8080"); err != nil && err != http.ErrServerClosed {
        log.Fatalf("Server listen error: %v", err)
    }
}()

// Listen for termination signals
quit := make(chan os.Signal, 1)
signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
<-quit

log.Println("Shutting down server gracefully...")

// 1. Drain HTTP requests with 10s timeout
if err := app.ShutdownWithTimeout(10 * time.Second); err != nil {
    log.Printf("Server forced to shutdown: %v", err)
}

// 2. Close database connection pool
if config.DB != nil {
    if err := config.DB.Close(); err != nil {
        log.Printf("Error closing database pool: %v", err)
    } else {
        log.Println("Database connection pool closed cleanly.")
    }
}
```

---

## 5. Pre-Commit Verification Checklist

Before deploying or committing backend changes:
1. **Connection Pool Audit**: Verify `SetMaxOpenConns`, `SetMaxIdleConns`, `SetConnMaxLifetime`, and `SetConnMaxIdleTime` are configured in `database.go`.
2. **Resource Leak Scan**: Verify every `.Query(` has `defer rows.Close()` and every `.Begin(` has `defer tx.Rollback()`.
3. **Build & Lint Verification**:
   ```bash
   go vet ./...
   go build ./...
   ```
4. **Health Check Verification**: Test `GET /api/health` and verify `pool.in_use` and `pool.open_connections` reflect active load accurately.
