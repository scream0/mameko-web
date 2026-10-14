---
name: mameko-web-dev
description: >-
  Standard and runbook for developing, auditing, and maintaining the Mameko Web application
  (Next.js 15 App Router + React 19 + TypeScript + CSS Modules + data/ui JSON pattern + Cloudflare Pages).
  Covers architectural guidelines, 100% Zero Hardcode standard, StoreContext state management,
  API client communication with Go Backend & Supabase, settings persistence, and Cloudflare Pages deployment.
---

# Mameko Web Development & Architecture Standard

This skill defines the official architectural guidelines, coding conventions, styling rules, UI text management patterns, API dataflow, and deployment standards for the **Mameko Web** application (`mameko-web`).

---

## 1. Tech Stack & Directory Structure

The web application is built with modern, zero-bloat web technologies designed for peak performance:
- **Framework**: Next.js 15 (App Router with static exports for Cloudflare Pages)
- **UI & Logic**: React 19, TypeScript
- **Styling**: Strict CSS Modules (`*.module.css`) + CSS Custom Properties (`globals.css`)
- **State Management**: `StoreContext.tsx` via custom `useStore()` hook
- **Data Integration**: Go Fiber REST API via `src/lib/apiClient.ts` & Supabase PostgreSQL via `src/lib/supabaseClient.ts`
- **Hosting & Edge**: Cloudflare Pages with Cloudflare Tunnel connecting to self-hosted Go Backend

### Key Directory Layout (`mameko-web/src`):
```text
src/
├── app/                  # Next.js App Router pages (layout.tsx, page.tsx, dashboard/, checkout/, privacy/, terms/, etc.)
├── components/           # Component library grouped by domain:
│   ├── Dashboard/        # Admin & User dashboards, settings, user management, order views
│   ├── UI/               # Reusable atomic UI (Button, Modal, AppIcon, ThemeToggle)
│   ├── Legal/            # Shared legal document layouts (LegalLayout.tsx)
│   ├── Navbar/ & Footer/ # Global navigation and branding
│   └── CookieConsent/    # Privacy & cookie consent banners
├── config/               # Business configuration (constants, couriers)
├── context/              # Global React Contexts (StoreContext, ThemeContext)
├── data/ui/              # Centralized JSON UI configuration files (100% Zero Hardcode!)
├── hooks/                # Custom React hooks (useCart, useOutsideClick, useProductFilter)
├── lib/                  # Shared clients (apiClient.ts, supabaseClient.ts, midtrans.ts)
├── services/             # Frontend data-access services (settingsService.ts, productService.ts)
├── types/                # TypeScript interface definitions (data.ts, index.ts)
└── utils/                # Helper utilities (authHelpers, rateLimit, imageConverter)
```

---

## 2. Mandatory UI Text & Copy Pattern (`data/ui/*.json`)

### HUKUM MUTLAK: 100% Zero Hardcode
**All user-facing text, button labels, placeholders, titles, empty states, and toast notifications MUST reside in `src/data/ui/*Config.json`**.

### Strict Rules:
1. **Zero Hardcoded JSX Text**: Never write Indonesian or English strings directly in TSX components.
2. **Import UI Config**: Always import from `@/data/ui/<name>Config.json`:
   ```tsx
   import settingsConfig from "@/data/ui/settingsConfig.json";
   
   // Good:
   <button>{settingsConfig.buttons.save}</button>
   
   // Forbidden (HARDCODED):
   <button>Simpan Perubahan</button>
   ```
3. **Structured Hierarchy**: Organize JSON into logical blocks (`header`, `nav`, `labels`, `modals`, `toasts`, `prompts`, `states`).

---

## 3. Styling Standards: Strict Vanilla CSS Modules

1. **No Utility Frameworks**: Do NOT use Tailwind CSS or CSS-in-JS libraries.
2. **CSS Modules**: Every component requiring custom styles must have its own co-located `<ComponentName>.module.css`:
   ```tsx
   import styles from "./SettingsView.module.css";
   
   <div className={styles.sectionCard}>
   ```
3. **No Inline Styles**: Dilarang keras menggunakan `style={{ ... }}` di JSX. Pindahkan seluruh properti visual ke file CSS module co-located.
4. **Global Design Tokens**: Always reference CSS custom properties defined in `globals.css`:
   - Canvas: `var(--background)`, `var(--surface-primary)`, `var(--surface-secondary)`, `var(--border-color)`
   - Text: `var(--text-primary)`, `var(--text-secondary)`, `var(--text-tertiary)`
   - Accent: `var(--primary-accent)`, `var(--primary-accent-bg)`, `var(--primary-accent-text)`, `var(--secondary)`, `var(--secondary-container)`
5. **Container-Content Pairing**: Setiap wadah berlatar warna wajib menggunakan warna konten pasangannya untuk memastikan rasio kontras tinggi di Light & Dark Mode.

---

## 4. State Management & API Client Integration

### StoreContext & Shopping Cart
For global shopping cart operations, currency formatting, and theme state:
```tsx
import { useStore } from "@/context/StoreContext";

const { cart, addToCart, removeFromCart, cartQuantity, rupiah } = useStore();
```
- Always use `rupiah(amount)` for consistent IDR currency formatting.

### Backend API Client (`apiClient.ts`)
All requests to the Go backend must go through `getApiBaseUrl()` from `@/lib/apiClient`:
```tsx
import { getApiBaseUrl } from "@/lib/apiClient";

const res = await fetch(`${getApiBaseUrl()}/api/user/orders`, {
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
});
```

### Settings & Legal Persistence Flow
1. **Public Reading**: `getPublicSettings()` in `settingsService.ts` calls `GET /api/settings?public=true` (cached for 5 minutes).
2. **Admin Reading & Saving**: `getAdminSettings(session)` and `saveSettings(payload, session)` call `/api/settings` and `/api/admin/settings` with bearer token.
3. **Database Layer**: Data disimpan di tabel `store_config` Supabase PostgreSQL. Kolom `legal jsonb` menyimpan seluruh pasal kustom (`privacy.sections` dan `terms.sections`).

---

## 5. Cloudflare Pages Deployment & Edge Optimization

### File `public/_headers`
- Mengatur Content Security Policy (CSP), HSTS, Cache-Control untuk aset statis (`/images/*`, `/assets/*`).
- Mengatur header publik khusus untuk bot verifikasi:
  ```http
  /delete-account
    Access-Control-Allow-Origin: *
    Cache-Control: public, max-age=3600
    X-Robots-Tag: index, follow
  ```

### File `public/robots.txt`
- Secara eksplisit mengizinkan Google Play Inspection bot (`Google-InspectionTool`, `Googlebot`, `*`) merayapi rute `/delete-account`, `/privacy`, dan `/terms`.

### Cloudflare WAF Skip Rule
- Untuk mencegah 403 Forbidden pada robot verifikasi Google Play Console:
  - Expression: `(http.request.uri.path in {"/delete-account" "/delete-account/"})`
  - Action: `Skip` -> Centang `All remaining custom rules`, `WAF managed rules`, dan `Bot Fight Mode`.

---

## 6. Pre-Commit & Quality Verification Runbook

Before committing or pushing any web changes:

### Step 1: Run Unit Tests
```powershell
npm test
```
*Verify that all tests in `src/**/*.test.ts` pass (7/7 tests passed).*

### Step 2: Run Production Build
```powershell
npm run build
```
*Ensure Next.js compiles all 18 static pages without type errors or broken imports.*

### Step 3: Git Synchronization
```powershell
git status
git add <files>
git commit -m "feat/fix: descriptive message"
git push origin main
```
