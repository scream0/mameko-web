---
name: mameko-coding-standards-and-best-practices
description: >-
  Mandatory development standard and code quality runbook for Mameko Web: Best practices for
  zero @ts-nocheck compile-time safety, React 19 lifecycle safety, AbortController on async fetch,
  atomic double-click guards on checkout/payments, anti-flicker skeleton state management,
  optimistic UI with error rollback, clean error propagation, and robust API contracts with the Go Backend.
---

# Mameko Web Coding Standards & Best Practices Skill

This skill defines non-negotiable software engineering standards, concurrency safeguards, component lifecycle patterns, and code quality best practices for the **Mameko Web** application (`mameko-web`, Next.js 15 App Router + React 19 + TypeScript).

---

## 1. Asynchronous Lifecycle & Component Mount Safety

### Rule 1.1: Mandatory Mount Guards & AbortController in `useEffect`
Every asynchronous data fetch inside React client components (`"use client"`) **must** guard against memory leaks and state updates on unmounted components:
```tsx
// ✅ BENAR (LIFECYCLE SAFE):
useEffect(() => {
  let isMounted = true;
  const controller = new AbortController();

  const fetchData = async () => {
    try {
      const data = await getPublicSettings({ signal: controller.signal });
      if (isMounted && data) {
        setSettings(data);
      }
    } catch (err: any) {
      if (err.name !== "AbortError" && isMounted) {
        console.error("Gagal memuat data:", err);
      }
    }
  };

  fetchData();

  return () => {
    isMounted = false;
    controller.abort();
  };
}, []);
```

### Rule 1.2: Mandatory Event Listener Cleanup
Whenever registering custom window listeners (e.g., `store-settings-updated`, `open-cookie-settings`, `admin-locale-change`), the cleanup callback in `useEffect` **must remove the exact same listener function**:
```tsx
useEffect(() => {
  const handleUpdate = () => refreshSettings();
  window.addEventListener("store-settings-updated", handleUpdate);
  return () => {
    window.removeEventListener("store-settings-updated", handleUpdate);
  };
}, []);
```

### Rule 1.3: Mandatory `try ... catch ... finally` for Loading Spinners
Every user action that sets a loading state (`isLoading`, `isSaving`, `isSubmitting`) **must** reset that flag in a `finally` block so buttons and spinners never get stuck permanently on network errors:
```tsx
const handleSave = async () => {
  setLoading(true);
  try {
    await saveSettings(payload, session);
    toast.success(cfg.toast.success);
  } catch (error: any) {
    toast.error(error.message);
  } finally {
    setLoading(false);
  }
};
```

---

## 2. Concurrency, Race Condition, & Double-Click Prevention

### Rule 2.1: Atomic Guard on Financial & Non-Idempotent Actions
Every checkout, order creation, payment submission, or critical setting mutation **must** enforce an atomic guard preventing duplicate clicks:
- Check state flag synchronously: `if (loading || isSubmitting) return;`
- Mutate state to `loading = true` **immediately** before awaiting any promises.
- Button disabled attribute **must** reflect: `disabled={loading || !isValid}`.

### Rule 2.2: Optimistic UI Updates with Rollback
For high-frequency user interactions (Cart quantity increment/decrement, Wishlist toggle):
1. Update local state immediately for zero-latency, tactile UI response.
2. Send network mutation in the background.
3. If the remote API returns an error or fails, **roll back** the local state to previous snapshot and display a toast error.

---

## 3. Anti-Flicker & Zero Cumulative Layout Shift (CLS)

### Rule 3.1: Strict Geometry-Matching Skeletons
Shimmer or skeleton placeholders **must** match the exact aspect ratio and dimensions of final rendered content:
- Product cards: 1:1 square image wrapper (`aspect-ratio: 1 / 1`).
- Promo banners: 16:9 or 21:9 landscape wrapper.
- Avatars: 1:1 circle.
- Text lines: Dedicated skeleton bar with `height: 1rem` and `margin-bottom: 0.5rem`.

### Rule 3.2: Container Height Reservation
Never allow an empty container to collapse to `0px` while loading if it will pop into a `400px` card once data arrives. Always assign minimum heights (`min-height: 280px`) or render placeholder skeletons to keep CLS score below **0.05**.

---

## 4. UI Architecture & Zero Hardcode Standard

### Rule 4.1: Centralized Copy via `src/data/ui/*.json`
- Never write raw Indonesian or English strings inside JSX/TSX.
- Import copy from `@/data/ui/<name>Config.json`.
- When adding new features (e.g. Pasal / Section editor in admin settings), **always** add all label, placeholder, and button texts into the respective JSON configuration first.

### Rule 4.2: CSS Modules & Design Token Strictness
- Never use inline `style={{ ... }}` for layout or colors.
- Always use `<ComponentName>.module.css` with CSS custom properties from `globals.css` (e.g. `var(--primary-accent)`, `var(--surface-primary)`).
- Ensure every colored background container adheres to the **Container-Content Pairing** rule for high contrast accessibility (WCAG AAA).

### Rule 4.3: AppIcon Registry Completeness
- Every `<AppIcon name="..." />` invoked in JSX/TSX **must** have its key registered in `iconMap` inside `src/components/UI/Icon/AppIcon.tsx`.
- Never use a semantically misleading icon (such as `Search`) as the default fallback in `AppIcon.tsx`; always use a neutral shape (`Circle`) and register the exact Lucide icon (`"home": Home`, etc.) before rendering.

---

## 5. Compile-Time Type Safety & Zero `@ts-nocheck` Standard

### Rule 5.1: Strict Prohibition of `// @ts-nocheck` and `// @ts-ignore`
- **DILARANG KERAS** menambahkan `// @ts-nocheck` atau `// @ts-ignore` pada file `.ts` maupun `.tsx` di dalam `src/`.
- Penggunaan `@ts-nocheck` menyembunyikan variabel atau import yang belum dideklarasikan (seperti `ReferenceError: mamekoClient is not defined` atau variabel kalkulasi invoice yang hilang), yang akan meledak saat runtime menjadi layar error `"500 — Terjadi Kendala Teknis"`.
- Seluruh properti komponen (termasuk alias prop modal seperti `onClose` / `onCancel`), key konfigurasi `src/data/ui/*Config.json`, dan method client (`mamekoClient`, `auth`) wajib memiliki tipe yang valid dan diverifikasi oleh compiler TypeScript.

---

## 6. Pre-Commit Verification Runbook

Before completing any task or committing changes in `mameko-web`, run all four checks:
```powershell
# 1. Verify zero @ts-nocheck directives exist in src/
Select-String -Path "src\**\*.ts","src\**\*.tsx" -Pattern "@ts-nocheck"

# 2. Run full TypeScript compiler validation
npx tsc --noEmit

# 3. Run unit tests
npm test

# 4. Run Next.js production build verification
npm run build
```
`Select-String` must return empty (0 matches), and `npx tsc --noEmit`, `npm test`, and `npm run build` **must** exit with code 0 (100% passed).
