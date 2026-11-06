---
name: mameko-backend-dev
description: >-
  Standard and runbook for developing, auditing, and optimizing the Mameko Golang Backend API
  (Go Fiber + pgx/v5 + database/sql + Self-Hosted Docker PostgreSQL 16), including connection pooling,
  Native HS256 JWT Auth, Resend Email OTP, Native WebSocket (/ws/chats), graceful shutdown,
  query lifecycle, and health monitoring.
---

# Mameko Backend Golang Development Skill

This skill defines architectural standards, database pool rules, native authentication/realtime conventions, and query safety patterns for the Mameko Golang Backend API (`d:\Xar Project\mameko-backend`).

---

## 1. Self-Hosted PostgreSQL 16 Connection Pool Architecture

`mameko-backend` connects directly to the local hardened Docker PostgreSQL 16 instance (`127.0.0.1:5432/mameko_db`) via `pgx/v5/stdlib`.

### Mandatory Pool Configuration (`internal/config/database.go`)
Never leave `database/sql` pool defaults (`MaxOpenConns=0` unlimited, `MaxIdleConns=2`). Always configure explicit bounds with environment overrides:

```go
maxOpenConns := getEnvInt("DB_MAX_OPEN_CONNS", 25)
maxIdleConns := getEnvInt("DB_MAX_IDLE_CONNS", 15)
connMaxLifetimeMin := getEnvInt("DB_CONN_MAX_LIFETIME_MINUTES", 30)
connMaxIdleTimeMin := getEnvInt("DB_CONN_MAX_IDLE_TIME_MINUTES", 5)

db.SetMaxOpenConns(maxOpenConns)
db.SetMaxIdleConns(maxIdleConns)
db.SetConnMaxLifetime(time.Duration(connMaxLifetimeMin) * time.Minute)
db.SetConnMaxIdleTime(time.Duration(connMaxIdleTimeMin) * time.Minute)
```

> **Note on Prepared Statements**: Direct TCP connection to local Docker PostgreSQL (`5432`) natively supports `pgx` statement caching. Only switch to `pgx.QueryExecModeSimpleProtocol` if an external transaction-mode PgBouncer (`6543`) is explicitly placed in front of Postgres.

---

## 2. Native Auth, Email OTP & WebSocket Architecture

1. **Native JWT Authentication (`internal/middleware/auth.go` & `internal/controllers/auth_native.go`)**:
   - Tokens are signed and verified using `HMAC-SHA256` (`HS256`) with `JWT_SECRET` from `.env.local` (with fallback verification for legacy `SUPABASE_JWT_SECRET` only during transition).
   - User identities reside in `auth.users` joined with `public.profiles` (ensure `auth.users` schema columns like `phone` and `banned_until` exist via idempotent startup migrations in `database.go`).
2. **Passwordless Email OTP (`internal/controllers/auth_email_otp.go` & `internal/services/email_service.go`)**:
   - Endpoints: `POST /api/auth/send-email-otp` and `POST /api/auth/verify-email-otp`.
   - Stores 6-digit codes in `public.email_otp_codes` with 5-minute TTL and max 5 verification attempts.
   - Sends transactional HTML emails via Resend REST API (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`). Never expose `RESEND_API_KEY` to frontend repositories.
3. **Native Realtime Chat WebSocket (`internal/websocket/chat_hub.go`)**:
   - Endpoint: `GET /ws/chats?token=<jwt>` (authenticated before WebSocket upgrade).
   - Broadcasts newly created/updated/deleted chat messages in real time to connected customer and admin clients without external cloud pub/sub dependencies.

---

## 3. Query & Transaction Lifecycle Rules

1. **Mandatory `defer rows.Close()`**:
   Every `db.Query(...)` or `tx.Query(...)` MUST be followed immediately by `defer rows.Close()` after error check to prevent connection pool starvation.
2. **Mandatory Transaction Rollback Guard**:
   ```go
   tx, err := config.DB.Begin()
   if err != nil {
       return err
   }
   defer tx.Rollback()
   // ... parameterized queries ($1, $2, ...) ...
   if err := tx.Commit(); err != nil {
       return err
   }
   ```
3. **Zero Schema Drift Assumptions**:
   Before writing `JOIN auth.users` or adding columns in SQL queries, verify column existence in the live local Docker `mameko_db` schema (`\d auth.users`, `\d public.profiles`) and register idempotent `ADD COLUMN IF NOT EXISTS` guards in `database.go`.

---

## 4. Graceful Shutdown & Health Check

- `cmd/api/main.go` must trap `os.Interrupt` / `syscall.SIGTERM`, call `app.ShutdownWithTimeout(10 * time.Second)`, and close `config.DB.Close()`.
- `GET /api/health` must execute a 2-second `PingContext` against `config.DB` and report live `db.Stats()` (`open_connections`, `in_use`, `idle`, `wait_count`).

---

## 5. Pre-Commit Verification Checklist
1. Verify zero raw SQL string concatenation (`$1, $2` placeholders only).
2. Verify every `.Query(` has `defer rows.Close()` and every `.Begin(` has `defer tx.Rollback()`.
3. Run `go vet ./...` and `go build ./...` with 0 errors.
4. Deploy following `mameko-server-ops` (`api.exe.bak` -> `go build -o api.exe ./cmd/api` -> `pm2 restart mameko-api`) and verify `GET /api/health`.
