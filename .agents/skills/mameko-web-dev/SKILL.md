---
name: mameko-web-dev
description: >-
  Standard and runbook for developing, auditing, and maintaining the Mameko Web application
  (Next.js 15 App Router + React + TypeScript + CSS Modules + data/ui JSON pattern + Cloudflare Pages).
  Covers architectural guidelines, UI text separation, StoreContext state management,
  API client communication with Go Backend & Supabase, and production deployment.
---

# Mameko Web Development & Architecture Standard

This skill defines the official architectural guidelines, coding conventions, styling rules, UI text management patterns, and deployment standards for the Mameko Web application (`mameko-web`).

---

## 1. Tech Stack & Directory Structure

The web application is built with modern, zero-bloat web technologies:
- **Framework**: Next.js 15 (App Router with static exports / Cloudflare Pages target)
- **UI & Logic**: React 19, TypeScript
- **Styling**: Strict CSS Modules (`*.module.css`) + CSS Custom Properties (`globals.css`)
- **State Management**: `StoreContext.tsx` via custom `useStore()` hook
- **Data Integration**: Go REST API via `src/lib/apiClient.ts` & Supabase via `src/lib/supabaseClient.ts`

### Key Directory Layout (`mameko-web/src`):
```text
src/
├── app/                  # Next.js App Router pages (layout.tsx, page.tsx, dashboard/, checkout/, etc.)
├── components/           # Component library grouped by domain (Dashboard/, UI/, Navbar/, Footer/)
├── config/               # Business configuration (shipping, constants, checkout)
├── context/              # Global React Contexts (StoreContext, ThemeContext)
├── data/ui/              # Centralized JSON UI configuration files (e.g. userProfilConfig.json)
├── hooks/                # Custom React hooks (useCart, useOutsideClick, useProductFilter)
├── lib/                  # Shared clients (apiClient.ts, supabaseClient.ts, midtrans.ts)
├── types/                # TypeScript interface definitions (data.ts, index.ts)
└── utils/                # Helper utilities (authHelpers, rateLimit, imageConverter)
```

---

## 2. Mandatory UI Text & Copy Pattern (`data/ui/*.json`)

Similar to the Android `strings.xml` requirement in `mameko-values-and-database-integrity`, **all UI text, labels, button captions, modal headers, empty state descriptions, and toast messages in `mameko-web` MUST reside in `src/data/ui/*Config.json`**.

### Strict Rules:
1. **Zero Hardcoded JSX Text**: Never write user-facing Indonesian or English copy directly in TSX components.
2. **Import UI Config**: Always import from `@/data/ui/<name>Config.json`:
   ```tsx
   import profileConfig from "@/data/ui/userProfilConfig.json";
   
   // Good:
   <button>{profileConfig.buttons.editProfile}</button>
   
   // Forbidden (HARDCODED):
   <button>Edit Profil</button>
   ```
3. **Structured Hierarchy**: Organize JSON into logical blocks (`header`, `nav`, `labels`, `modals`, `toasts`, `prompts`, `states`).

---

## 3. Styling Standards: Strict Vanilla CSS Modules

To ensure lightning-fast performance and clean separation of concerns:
1. **No Utility Frameworks**: Do NOT use Tailwind CSS or CSS-in-JS libraries.
2. **CSS Modules**: Every component requiring custom styles must have its own co-located `<ComponentName>.module.css`:
   ```tsx
   import styles from "./UserProfil.module.css";
   
   <div className={styles.profileContainer}>
   ```
3. **Global Design Tokens**: Always reference CSS custom properties defined in `globals.css` (e.g. `var(--primary-color)`, `var(--bg-card)`, `var(--radius-md)`).
4. **Responsive Layouts**: Use mobile-first flexbox and CSS grid with standard breakpoints (`@media (max-width: 768px)`).

---

## 4. State Management & API Client Integration

### StoreContext & Shopping Cart
For global shopping cart operations and currency formatting:
```tsx
import { useStore } from "@/context/StoreContext";

const { cart, addToCart, removeFromCart, cartQuantity, rupiah } = useStore();
```
- Use `rupiah(amount)` for consistent currency display across the entire web app.

### Backend API Client
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

### Supabase Authentication
For session and auth events:
```tsx
import { auth } from "@/lib/supabaseClient";

const session = await auth.getSession();
```

---

## 5. Verification & Deployment Standard

Before committing or pushing any web changes:

### Step 1: Run Unit Tests
```powershell
cd '..\mameko-web'
npm test
```
*Verify that all tests in `src/**/*.test.ts` pass.*

### Step 2: Run Production Build & Typecheck
```powershell
npm run build
```
*Ensure Next.js compiles all static pages without type errors or broken imports.*

### Step 3: Cloudflare Pages Deployment
To deploy static output to Cloudflare Pages:
```powershell
npm run pages:deploy
# Equivalent to: npm run pages:build && wrangler pages deploy out
```

---

## 6. Pre-Commit Checklist

- [ ] Zero hardcoded text in newly created/modified JSX files (all copy in `src/data/ui/*.json`).
- [ ] No broken imports or leftover files after refactoring.
- [ ] `npm test` passes with 0 failures.
- [ ] `npm run build` succeeds with 0 typecheck warnings/errors.
- [ ] Working tree clean and verified with `git status`.
