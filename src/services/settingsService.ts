"use client";

import { getApiBaseUrl } from "@/lib/apiClient";

/**
 * settingsService.ts — Data-access layer untuk pengaturan toko & landing page.
 *
 * Semua komponen (landing publik maupun dashboard admin) HARUS memakai service ini
 * untuk membaca/menyimpan konfigurasi. Dengan begitu:
 *   1. Halaman landing publik memakai getPublicSettings() → TANPA token (bisa diakses siapa saja).
 *   2. Dashboard admin memakai getAdminSettings(session) → wajib bearer token admin (Supabase session).
 *   3. Penyimpanan memakai saveSettings(payload, session) → wajib bearer token admin (Supabase session).
 */

export interface StoreSettings {
  storeName?: string;
  storeEmail?: string;
  currency?: string;
  adminLocale?: string;
  lowStockThreshold?: number;
  storeCityId?: string;
  storeCityName?: string;
  enableMidtrans?: boolean;
  enableManualTransfer?: boolean;
  midtransIsProduction?: boolean;
  biteshipIsProduction?: boolean;
  biteshipAutoOrder?: boolean;
  hero?: any;
  about?: any;
  product?: any;
  contact?: any;
  footer?: any;
  promoBannerEnabled?: boolean;
  promoBannerText?: string;
  promoDiscountType?: string;
  promoDiscountValue?: number;
  promoStartDate?: string;
  promoEndDate?: string;
  promoCode?: string;
  promoDestination?: string;
  promoTargetType?: string;
  promoTargetVariants?: any;
  activeCouriers?: any;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 menit
let publicCache: { data: StoreSettings | null; ts: number } = { data: null, ts: 0 };

/**
 * GET public settings — aman untuk landing page publik.
 * Tidak mengirim token, server hanya mengembalikan data non-sensitif.
 */
export async function getPublicSettings({ force = false } = {}): Promise<StoreSettings | null> {
  // Cache sederhana di sisi klien
  if (!force && publicCache.data && Date.now() - publicCache.ts < CACHE_TTL) {
    return publicCache.data;
  }

  const apiBase = getApiBaseUrl();
  const res = await fetch(`${apiBase}/api/settings?public=true`, {
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    console.error("settingsService.getPublicSettings error:", data?.error);
    return null;
  }

  publicCache = { data, ts: Date.now() };
  return data;
}

/**
 * GET admin settings — wajib auth admin. Memakai Supabase session (access_token).
 * @param tokenOrSession - access_token string atau Supabase session object
 */
export async function getAdminSettings(tokenOrSession: any): Promise<StoreSettings> {
  const token = await resolveTokenAsync(tokenOrSession);
  if (!token) throw new Error("Admin token required.");

  const apiBase = getApiBaseUrl();
  const res = await fetch(`${apiBase}/api/settings`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error || "Gagal memuat pengaturan dari server.");
  }

  // Invalidate public cache karena config berubah
  publicCache = { data: null, ts: 0 };

  return data;
}

/**
 * POST /api/admin/settings — simpan pengaturan (store + landing + promo + payment).
 * @param payload - object settings lengkap
 * @param tokenOrSession - access_token string atau Supabase session object
 */
export async function saveSettings(payload: any, tokenOrSession: any): Promise<StoreSettings> {
  const token = await resolveTokenAsync(tokenOrSession);
  if (!token) throw new Error("Admin token required.");

  const apiBase = getApiBaseUrl();
  const res = await fetch(`${apiBase}/api/admin/settings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error || "Gagal menyimpan pengaturan.");
  }

  // Invalidate cache agar landing langsung memakai data terbaru
  publicCache = { data: null, ts: 0 };

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("store-settings-updated", { detail: data }));
  }

  return data;
}

/**
 * Helper async untuk resolve token dari berbagai bentuk input.
 * Mendukung:
 *   - string token langsung
 *   - Supabase session object → { access_token, user, ... }
 */
export async function resolveTokenAsync(tokenOrUser: any): Promise<string> {
  if (!tokenOrUser) return "";
  if (typeof tokenOrUser === "string") return tokenOrUser;

  // Supabase session object: { access_token, user, ... }
  if (tokenOrUser.access_token) {
    return tokenOrUser.access_token;
  }

  return "";
}
