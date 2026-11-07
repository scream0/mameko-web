

# Go Fiber + Next.js + Self-Hosted Docker PostgreSQL 16 Web App

Builds full-stack web apps with this self-hosted stack:

- **Backend**: Go Fiber (`mameko-backend`), `pgx/v5` connection pool, Native HS256 JWT Auth + Resend Email OTP, Native WebSocket (`/ws/chats`) for realtime messaging. Running in Docker container `mameko-api`.
- **Database**: Self-Hosted PostgreSQL 16 Alpine Hardened (`mameko-infra`), non-root `su-exec`, running in Docker container `mameko-postgres` bound strictly to loopback `127.0.0.1:5432`.
- **Frontend**: Next.js 15 (App Router), static exports deployed to **Cloudflare Pages**, calling the Go API over HTTP/WebSocket as an independent service. 100% Zero Supabase Cloud dependency.
- **Exposure / Ingress**: Self-hosted stack exposed via **Cloudflare Zero Trust Tunnel** (`mameko-tunnel`) to `https://api.mameko.my.id` (no public IP, no exposed database ports).

## Core architecture decisions (don't relitigate these per-task)

1. **Go API and Next.js are separate services.** Next.js never talks to Postgres directly and never embeds Go code. It calls the Go API over HTTP (JSON) and WebSocket (`/ws/chats`), same as any external client.
2. **Self-Hosted Docker Postgres 16 is the only database.** Go connects to it via `pgx/v5` connection pool (`postgresql://...mameko-db:5432/mameko_db`). Direct database access is strictly isolated inside the Docker bridge network `mameko-net`.
3. **Auth is Native Go JWT Auth (HS256).** The frontend uses native API client (`src/lib/mamekoClient.ts`) for sign-up, sign-in, Resend email OTP, and session management. No Supabase Auth client is used.
4. **Realtime is Native Go WebSocket (`/ws/chats`).** Realtime chat and notification broadcasts run through Go's `websocket.GlobalHub.BroadcastChat()`.
5. **Monorepo / Multi-repo ecosystem, independent deploys.** `mameko-web` (Cloudflare Pages), `mameko-backend` & `mameko-infra` (Docker Compose).

## Non-negotiables

- Never import `@supabase/supabase-js` or maintain dummy Supabase shims in frontend code. Use `src/lib/mamekoClient.ts` or `src/lib/apiClient.ts`.
- Every Go API response is JSON with a consistent error shape — no bare `http.Error` strings for API consumers.
- Validate JWTs on every protected Go route via shared middleware (`middleware.RequireAuth`, `middleware.RequireAdmin`).
- Zero hardcoded colors and zero hardcoded user-facing strings in `mameko-web`. Always adhere to `mameko-values-and-database-integrity`, `mameko-human-friendly-error-handling`, and `mameko-ui-ux-pro-max`.
- Validate JWTs on every protected Go route via the shared middleware — don't hand-roll auth checks per-handler.
- Run `sqlc generate` after any `.sql` query file change and don't hand-edit generated code.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
