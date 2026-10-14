---
name: mameko-values-and-database-integrity
description: >-
  HUKUM MUTLAK ARSITEKTUR MAMEKO WEB: Larangan keras segala bentuk hardcode (TIDAK BOLEH ADA HARDCODE SAMA SEKALI,
  termasuk teks UI di JSX/TSX, warna harfiah #FFFFFF/#000000/hex di inline style, inline style={{ ... }},
  dan static dummy in-memory mock data). Seluruh teks wajib di src/data/ui/*Config.json, seluruh styling wajib di
  CSS Modules (*.module.css) dengan token CSS globals.css (var(--...)) dan pasangan kontras valid (container + onContent),
  dan seluruh data bisnis wajib dinamis dari Supabase PostgreSQL / Golang REST API.
---

# Mameko Web Values & Database Integrity Skill
## HUKUM MUTLAK: TIDAK BOLEH ADA HARDCODE SAMA SEKALI (Zero Hardcode Standard untuk Mameko Web)

Dokumen ini adalah standar arsitektur wajib yang mengikat seluruh developer dan agen AI di proyek **Mameko Web** (`mameko-web`):
1. **Zero Hardcoded Strings**: Seluruh teks UI, label, placeholder, tooltip, pesan error, modal, dan toast wajib berada di `src/data/ui/*Config.json`.
2. **Zero Hardcoded Colors & Zero Inline Styles**: Dilarang keras menuliskan warna harfiah (`#FFFFFF`, `#000000`, `rgb(...)`, `red`, dsb.) atau atribut `style={{ ... }}` di file TSX/JSX. Wajib menggunakan token tema resmi dari `globals.css` via CSS Modules (`*.module.css`) dan mematuhi prinsip pasangan warna kontras (`container` + `onContent`).
3. **Zero Hardcoded Dimensions**: Seluruh ukuran spacing, padding, margin, dan border-radius wajib menggunakan token CSS variables atau skala 4px/8px grid di CSS Modules, bukan inline styles.
4. **Zero Static / Mock / Hardcoded Data**: Seluruh entitas dan state bisnis (produk, varian, promo, keranjang, pesanan, alamat, legalitas toko) wajib dinamis dari database (Supabase PostgreSQL / Golang REST API). Dilarang keras menyuntikkan data dummy ke database live.

---

## 1. Zero Hardcoded Colors & Zero Inline Styles Standard

### A. Larangan Keras (Strictly Forbidden)
- **DILARANG KERAS** menggunakan atribut inline style `style={{ ... }}` atau warna harfiah langsung di dalam file TSX/JSX:
  ```tsx
  // ❌ PELANGGARAN FATAL:
  <div style={{ backgroundColor: "#FFFFFF", color: "#000000", padding: "16px" }}>
  <button style={{ color: "red", fontSize: "14px" }}>Hapus</button>
  <span style={{ whiteSpace: "pre-line" }}>{text}</span>
  ```
- **Bahaya Fatal Hardcoded Colors**:
  - Di **Dark Mode**, background permukaan website berwarna gelap (`var(--surface-primary) = #15181E` atau `#0D0F12`). Jika teks di-hardcode `#FFFFFF` atau `#000000` tanpa token CSS, terjadi **Zero Contrast Bug (teks hitam di atas latar gelap atau teks putih di atas latar terang, kontras 1:1, teks hilang sama sekali)**!
  - Inline style `style={{ ... }}` merusak caching CSS browser, memicu re-render layout, dan melanggar prinsip separation of concerns.

### B. Aturan Wajib Token Warna Resmi (`globals.css`)
Seluruh warna dan permukaan visual wajib menggunakan CSS Custom Properties yang terdaftar di `src/app/globals.css`:
1. **Surface & Canvas Tokens**:
   - `var(--background)`: Latar belakang kanvas utama halaman.
   - `var(--surface-primary)`: Latar kartu utama (Card, Modal, Dropdown).
   - `var(--surface-secondary)`: Latar kartu bertingkat (Sub-card, Form block, Section card).
   - `var(--border-color)`: Border garis tipis 1px pembatas elemen.
2. **Typography & Content Tokens**:
   - `var(--text-primary)`: Teks utama berbobot tinggi.
   - `var(--text-secondary)`: Teks subjudul, deskripsi, atau keterangan pendukung.
   - `var(--text-tertiary)`: Teks metadata kecil, timestamp, caption.
3. **Brand Accent & Action Tokens**:
   - `var(--primary-accent)` / `var(--secondary)`: Aksen utama Amber Gold Mameko untuk tombol aksi utama (CTA), active state, badge.
   - `var(--primary-accent-bg)` / `var(--secondary-container)`: Wadah latar aksen dengan opasitas lembut.
   - `var(--primary-accent-text)` / `var(--on-secondary)`: Teks di atas wadah berlatar aksen utama.
4. **Semantic Status Tokens**:
   - `var(--error)` / `var(--error-bg)`: Notifikasi error / bahaya.
   - `var(--success)` / `var(--success-bg)`: Notifikasi sukses / lunas.

### C. Prinsip Pasangan Kontras Wajib (Container-Content Pairing)
Setiap kali mendefinisikan wadah visual berlatar warna (Badge, Button, Card, Chip, Toast), **WAJIB** memasangkan warna wadah dengan warna konten pasangannya di CSS Modules:

| Wadah (`background`) | Konten / Teks / Ikon (`color` / `fill`) |
| :--- | :--- |
| `var(--primary-accent)` | `var(--primary-accent-text)` |
| `var(--secondary-container)` | `var(--secondary)` |
| `var(--surface-primary)` | `var(--text-primary)` |
| `var(--surface-secondary)` | `var(--text-secondary)` |
| `var(--error-bg)` | `var(--error)` |

**Contoh Penerapan Benar di CSS Module**:
```css
/* ✅ BENAR & MEMATUHI WCAG AAA DI LIGHT & DARK MODE: */
.statusBadge {
  background: var(--secondary-container);
  color: var(--secondary);
  border: 1px solid var(--border-color);
  padding: 0.25rem 0.65rem;
  border-radius: 9999px;
  font-size: 0.8rem;
  font-weight: 700;
}
```

---

## 2. Zero Hardcoded Strings Standard (`src/data/ui/*.json`)

### Core Rules
- **DILARANG KERAS menuliskan teks harfiah bahasa Indonesia atau Inggris** di dalam file TSX/JSX komponen, helper, atau konteks.
- Seluruh teks antarmuka wajib dipisahkan ke dalam file konfigurasi JSON di `src/data/ui/*Config.json`.

### Struktur File Konfigurasi UI:
- `src/data/ui/homeConfig.json`: Teks landing page, hero, about, fitur.
- `src/data/ui/catalogConfig.json`: Teks filter katalog, pengurutan, pencarian.
- `src/data/ui/checkoutConfig.json`: Teks form alamat, kurir Biteship, ringkasan pembayaran.
- `src/data/ui/privacyConfig.json`: Teks kebijakan privasi, daftar pasal default, modal hapus akun.
- `src/data/ui/termsConfig.json`: Teks syarat & ketentuan toko, klausul garansi, pasal default.
- `src/data/ui/settingsConfig.json`: Teks formulir admin settings, label input, placeholder, tombol simpan.
- `src/data/ui/cookieConsentConfig.json`: Teks banner cookie consent dan modal preferensi privasi.
- `src/data/ui/deleteAccountConfig.json`: Teks portal penghapusan akun mandiri.

### Contoh Penerapan:
```tsx
// ❌ SALAH (HARDCODED):
<button className={styles.saveBtn}>Simpan Perubahan</button>
<p>Komitmen Make Me Kool dalam menjaga privasi data Anda.</p>

// ✅ BENAR (ZERO HARDCODE):
import settingsConfig from "@/data/ui/settingsConfig.json";
<button className={styles.saveBtn}>{settingsConfig.buttons.save}</button>
<p>{settingsConfig.legal.privacy.subtitlePlaceholder}</p>
```

---

## 3. Zero Hardcoded Dimensions Standard (Tokens Spacing, Corner, Elevation)

### Core Rules
- **DILARANG KERAS** menuliskan ukuran margin, padding, atau width secara sembarangan di inline style `style={{ ... }}`.
- Seluruh dimensi wajib didefinisikan di CSS Modules co-located `<ComponentName>.module.css` menggunakan standar **4-point / 8-point grid**:
  - `0.25rem` (4px): Micro gap antara teks dan icon kecil.
  - `0.5rem` (8px): Standard gap di dalam row atau chip.
  - `0.75rem` (12px): Compact card padding & form input horizontal spacing.
  - `1rem` (16px): Standard container padding & input field height clearance.
  - `1.5rem` (24px): Card padding, section divider margin.
  - `2rem` (32px): Modal header spacing & layout section gap.
- Border radius wajib menggunakan token standar:
  - `border-radius: 8px` / `12px` (Card, input field).
  - `border-radius: 9999px` (Pill button, circular badge, chip).

---

## 4. Zero Static / Dummy Data Standard (100% Database Driven)

### Core Rules
- **DILARANG KERAS membuat in-memory mock dummy array** di kode produksi (misal: `const mockProducts = [...]`, `const dummyOrders = [...]`).
- **Prinsip Fetch-First Dynamic Data**:
  - Seluruh data produk, kategori, varian wajib diambil dari Supabase PostgreSQL / Golang API (`/api/products`).
  - Seluruh pengaturan toko (nama toko, rekening bank, kurir Biteship aktif, legalitas TOS & Privasi, banner promo) wajib diambil dari tabel `store_config` via Golang API (`/api/settings` & `/api/admin/settings`).
  - Halaman legalitas (`/privacy` dan `/terms`) wajib merender pasal dari database Supabase (`store_config.legal`), dengan fallback ke `defaultArticles` hanya jika database belum pernah menyimpan kustomisasi.
- **Larangan Keras Mencemari Database Live**:
  - Dilarang menjalankan skrip pengujian atau tes lokal yang menyuntikkan data fiktif sembarangan ke tabel database live Supabase.
  - Jika diperlukan pengujian, gunakan transaksi yang di-`ROLLBACK` atau operasi read-only (`SELECT`).

---

## 5. Post-Test Cleanup & Pre-Commit Verification Checklist

### Mandatory Cleanup Rule: "Hapus Semua Tes Jika Tes Passed"
- Segera setelah pengujian berhasil (`PASSED`), **SEMUA file scratch pengujian, skrip tes ad-hoc di folder `scratch/`, dan file sementara WAJIB LANGSUNG DIHAPUS**.
- Workspace harus selalu bersih dari file sampah pengujian.

### Pre-Commit Verification Checklist
Sebelum menyatakan tugas selesai atau melakukan commit/push:
1. **Hardcode Strings Scan**: Pastikan tidak ada teks bahasa Indonesia / Inggris harfiah di file TSX/JSX di luar file `src/data/ui/*.json`.
2. **Hardcode Colors & Inline Styles Scan**: Pastikan tidak ada atribut `style={{ ... }}` dan tidak ada hex harfiah `#FFFFFF`/`#000000` di TSX.
3. **Automated Unit Tests**:
   ```powershell
   npm test
   ```
   Seluruh test suite wajib lulus (7/7 tests passed, 0 errors).
4. **Production Build Compilation**:
   ```powershell
   npm run build
   ```
   Kompilasi Next.js wajib exit dengan code 0 dan 100% rute statis berhasil di-generate.
5. **Git Synchronization**:
   Lakukan commit dengan pesan terstruktur dan push ke remote `origin/main`.
