# Mameko Web App (Production Ready)

A modern full-stack e-commerce and store management platform built with Next.js (Frontend), Go API (Backend), and Supabase (Postgres Database, Authentication, and Storage).

---

## 🏛 Architecture Overview

- **Frontend (`Next.js 15 App Router`)**:
  - Hosted on **Cloudflare Pages** (`out/` static export).
  - Client state management with React 19, Supabase JS Client for Auth & Realtime, and Tailwind CSS + Vanilla CSS Modules.
  - Image delivery optimized through Cloudinary CDN.
- **Backend (`Go + Fiber`)**:
  - Self-hosted Go microservice (`backend/cmd/api/main.go`).
  - Connects to Supabase Postgres via `pgxpool` with automated connection pooling.
  - Exposed securely via **Cloudflare Tunnel** (`api.mameko.my.id`), binding locally to `127.0.0.1:8080`.
  - Midtrans Snap payment gateway integration & Biteship logistics API.
- **Database & Services (`Supabase`)**:
  - Postgres DB with Row-Level Security (RLS) active on all tables.
  - Supabase Auth (JWT verified in Go backend middleware).
  - Supabase Storage buckets for assets and receipts.

---

## 🚀 Getting Started (Local Development)

### 1. Prerequisites
- Node.js >= 20.x (Node 22 or 24 recommended)
- Go >= 1.22
- Supabase project / local credentials
- Cloudflare Tunnel (for exposing Go backend if testing live webhooks)

### 2. Frontend Setup
```bash
# Install dependencies
npm install

# Run development server (http://localhost:3000)
npm run dev

# Run unit tests
npm test

# Run linter
npm run lint
```

### 3. Backend Setup
```bash
cd backend

# Tidy Go modules
go mod tidy

# Run Go backend API (http://127.0.0.1:8080)
go run ./cmd/api

# Build backend binary
go build -o api.exe ./cmd/api
```

---

## ⚙️ Environment Variables

### Frontend (`.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_API_URL=https://api.mameko.my.id
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=your_midtrans_client_key
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
```
> **Security Note**: Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend `.env.local`.

### Backend (`backend/.env`)
```env
PORT=8080
DATABASE_URL=postgres://postgres:[PASSWORD]@[HOST]:[PORT]/postgres?sslmode=require
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
MIDTRANS_SERVER_KEY=your_midtrans_server_key
BITESHIP_API_KEY=your_biteship_api_key
ALLOWED_ORIGINS=https://mameko.pages.dev,https://mameko.my.id,http://localhost:3000
```

---

## 📦 Production Build & Deployment

### 1. Frontend: Cloudflare Pages
```bash
# Build static export to out/ directory
npm run build

# Deploy via Wrangler CLI (if configured)
npm run pages:deploy
```

### 2. Backend: Self-Hosted via Cloudflare Tunnel
1. Compile backend executable:
   ```bash
   cd backend
   go build -ldflags="-s -w" -o MamekoServer.exe ./cmd/api
   ```
2. Run Cloudflare Tunnel:
   ```bash
   cloudflared.exe tunnel run <TUNNEL_NAME>
   ```
3. Or use the built-in system manager: `backend/cmd/manager` / `MamekoServer.exe`.

---

## 🛠 Maintenance Tools

### Re-linking WhatsApp Bot
If WhatsApp connection expires or requires QR re-authentication:
```bash
cd backend
go run ./cmd/relink_whatsapp
```
Scan the QR code displayed in the terminal using the WhatsApp mobile app (Linked Devices).

---

## 🧪 Testing & Verification Suite

- **Unit Tests**: `npm test` runs Node test runner (`orderSorting`, `orderStatus`, `authRedirect`, `dashboardSummary`, `logger`).
- **E2E Tests**: `npm run e2e` runs Playwright browser tests.
- **Go Suite**: `go test ./...` and `go vet ./...` in `backend/`.
