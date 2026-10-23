---
name: mameko-encryption-and-cryptography
description: >-
  Standard and comprehensive runbook for end-to-end encryption, cryptographic validation,
  zero-secret-exposure, and data protection across the Mameko ecosystem (Next.js Web,
  Golang Backend, Supabase PostgreSQL, Midtrans Snap, Biteship Logistics, and Android client).
---

# Mameko Encryption & Cryptographic Hardening Standard

Dokumen ini adalah standar arsitektur wajib untuk seluruh developer dan agen AI dalam mengimplementasikan, mengaudit, dan memelihara **enkripsi, integritas kriptografis, dan keamanan data** di seluruh ekosistem **Mameko**.

---

## 1. HUKUM MUTLAK ENKRIPSI & KRIPTOGRAFI MAMEKO

1. **Zero Secret Exposure in Browser / Public Clients**:
   - `SUPABASE_SERVICE_ROLE_KEY`, `MIDTRANS_SERVER_KEY`, `BITESHIP_API_KEY`, `CRON_SECRET`, dan JWT Secrets **DILARANG KERAS** muncul di frontend (`mameko-web`) atau client native (`mameko-app`).
   - Browser client hanya boleh memegang `NEXT_PUBLIC_SUPABASE_ANON_KEY` yang dilindungi oleh Row-Level Security (RLS) PostgreSQL.
   - Variabel apa pun yang diawali `NEXT_PUBLIC_` akan dikompilasi ke bundle JavaScript publik yang dapat dibaca siapa saja. Jangan pernah memberi prefix `NEXT_PUBLIC_` pada secret backend.

2. **Mandatory Encryption in Transit (HTTPS / TLS 1.3 Strict)**:
   - Seluruh panggilan API ke backend (`api.mameko.my.id`), Supabase, Cloudinary, Midtrans, dan Biteship **WAJIB** menggunakan HTTPS / WSS.
   - Dilarang keras memuat aset gambar atau skrip dari URL HTTP tidak terenkripsi (*Zero Mixed Content*).
   - Seluruh Cloudflare Tunnel dan Reverse Proxy wajib mengaktifkan HTTP/2 atau HTTP/3 dengan sertifikat TLS modern.

3. **Constant-Time Comparison untuk Validasi Signature**:
   - Membandingkan token rahasia, HMAC, atau hash signature wajib menggunakan perbandingan waktu-konstan (`crypto/subtle.ConstantTimeCompare` di Go atau `crypto.timingSafeEqual` di Node.js) guna mencegah serangan *timing side-channel*.

4. **Zero Client-Side Financial Calculation**:
   - Total harga, diskon voucher, biaya ongkir, dan payload pembayaran **WAJIB** dihitung dan diverifikasi secara kriptografis oleh Golang Backend.
   - Klien web tidak boleh menandatangani (*sign*) transaksi pembayaran Midtrans Snap secara mandiri.

5. **Sanitasi Data Sensitif di Sisi Klien (Data at Rest in Browser)**:
   - Data PII (*Personally Identifiable Information*), nomor rekening bank, atau payload sensitif dilarang disimpan dalam bentuk *plaintext* yang tidak terproteksi di `localStorage`.
   - Token sesi login wajib disimpan dalam cookie yang aman (`Secure`, `SameSite=Lax`).

---

## 2. ENKRIPSI DATA IN TRANSIT (TRANSPORT SECURITY)

### A. Penegakan Protokol Aman di Web Client (`src/lib/apiClient.ts`)
Setiap fungsi pemanggil jaringan wajib memeriksa skema protokol:
```typescript
// ✅ SECURE: Memaksa HTTPS untuk lingkungan produksi dan staging
export const getApiBaseUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && envUrl.trim() !== "") {
    return envUrl.replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:8080";
    }
    return "https://api.mameko.my.id";
  }

  return process.env.NODE_ENV === "production"
    ? "https://api.mameko.my.id"
    : "http://localhost:8080";
};
```

### B. Cloudinary Image HTTPS Enforcement
Pastikan seluruh helper optimasi gambar (`imageOptimizer.ts`) memvalidasi URL awal dan memaksa protokol HTTPS:
```typescript
// ✅ Pastikan URL Cloudinary selalu HTTPS
export function enforceHttps(url: string): string {
  if (!url) return "";
  return url.replace(/^http:\/\//i, "https://");
}
```

---

## 3. KRIPTOGRAFI TOKEN & AUTENTIKASI (SUPABASE JWT)

### A. Verifikasi Signature di Sisi Backend Go API
Backend **TIDAK BOLEH** hanya membaca *payload* JWT tanpa memverifikasi tanda tangan kriptografis:
1. Periksa header token: Algoritma `"alg": "none"` wajib ditolak dengan HTTP 401 Unauthorized.
2. Jika menggunakan HMAC-SHA256: Verifikasi menggunakan `SUPABASE_JWT_SECRET` dengan `hmac.Equal`.
3. Jika menggunakan Asymmetric (`RS256` / `ES256`): Validasi dengan public key dari Supabase JWKS endpoint (`/auth/v1/.well-known/jwks.json`).
4. Pastikan klaim `exp` (expiration time) dan `nbf` (not before) valid sebelum mengekstrak `sub` (User ID).

### B. Proteksi Cookie Session di Web (`createBrowserClient`)
Di [src/lib/supabaseClient.ts](file:///d:/Xar%20Project/mameko-web/src/lib/supabaseClient.ts):
- `@supabase/ssr` otomatis menyimpan token ke Cookie browser yang diteruskan ke server middleware.
- Pastikan pengaturan cookie pada browser client mencakup:
  - `secure: true` (hanya dikirim via HTTPS).
  - `sameSite: "lax"` (mencegah eksploitasi CSRF).

---

## 4. KRIPTOGRAFI PEMBAYARAN & WEBHOOK INTEGRITY

### A. Midtrans Webhook SHA-512 Verification
Setiap kali webhook Midtrans diterima oleh backend di `/api/webhooks/midtrans`, integritas payload wajib divalidasi dengan rumus SHA-512:
$$\text{Signature} = \text{SHA512}(\text{order\_id} + \text{status\_code} + \text{gross\_amount} + \text{ServerKey})$$

```go
// ✅ Pola Verifikasi Signature Midtrans di Go Backend:
expectedSignature := sha512Hex(orderID + statusCode + grossAmount + serverKey)
if subtle.ConstantTimeCompare([]byte(expectedSignature), []byte(incomingSignature)) != 1 {
    return fiber.NewError(fiber.StatusUnauthorized, "Invalid cryptographic webhook signature")
}
```

### B. Biteship Webhook Secret Verification
Webhook logistik Biteship memverifikasi header `X-Biteship-Secret` menggunakan `subtle.ConstantTimeCompare`:
```go
if subtle.ConstantTimeCompare([]byte(reqSecret), []byte(biteshipWebhookSecret)) != 1 {
    return fiber.NewError(fiber.StatusUnauthorized, "Unauthorized webhook secret")
}
```

---

## 5. AUDIT CHECKLIST KEAMANAN & ENKRIPSI (CHECKLIST PRE-DEPLOY)

Sebelum kode di-merge atau dirilis ke produksi, wajib memeriksa checklist berikut:

- [ ] **Zero Hardcoded Secrets**: Tidak ada string API key, service role key, database password, atau JWT secret di seluruh repository git.
- [ ] **Environment Separation**: File `.env.local` di-ignore oleh `.gitignore` dan hanya variabel publik yang menggunakan awalan `NEXT_PUBLIC_`.
- [ ] **HTTPS Enforced**: Seluruh tautan API, CDN Cloudinary, dan script eksternal menggunakan `https://`.
- [ ] **OWASP Top 10 A02:2021 Compliance**: Kriptografi menggunakan standar modern (SHA-256 / SHA-512 / AES-GCM / TLS 1.3), tanpa algoritma usang (MD5, SHA-1, DES).
- [ ] **Anti-Tampering Checkout**: Nilai tagihan dan status transaksi diverifikasi penuh oleh Go backend, bukan berdasarkan request body client yang bisa diubah oleh pengguna.
