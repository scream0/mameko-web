---
name: mameko-zero-data-pollution-and-live-db-safety
description: >-
  HUKUM MUTLAK ARSITEKTUR MAMEKO: Larangan keras menyuntikkan data statis/dummy ke database live Supabase.
  Mewajibkan prinsip "Fetch-First Dynamic Data" (selalu gunakan data dinamis asli yang ada di DB),
  pengujian terisolasi dengan transaksi ROLLBACK atau Read-Only (SELECT), pertahanan anti-overwrite
  di backend, dan pembersihan seketika terhadap seluruh file scratch pengujian ("Hapus Semua Tes Jika Tes Passed").
---

# Mameko Zero Data Pollution & Live Database Safety (HUKUM MUTLAK)

> [!CAUTION]
> **PERINGATAN MUTLAK & TIDAK DAPAT DITAWAR**:
> Database Supabase PostgreSQL proyek Mameko berisi data bisnis aktif (produk, pesanan pelanggan asli, voucher, rekening, alamat logistik, dan konfigurasi storefront).
> **DILARANG KERAS** menyuntikkan data statis, mock dummy, atau payload tiruan ke database live! Pelanggaran aturan ini merusak integritas data riil toko.

---

## 1. Hukum Mutlak 1: Larangan Keras Menyuntikkan Data Statis ke Database Live

1. **Nol Injeksi Data Dummy**:
   - Dilarang membuat script pengujian (`.go`, `.js`, `.ts`, `.sql`, dll.) yang mengirimkan data string hardcoded tiruan (misalnya: `"Mameko"`, `"admin@mameko.id"`, `"151"`, `"Jakarta Barat"`, `"12430"`, `"Catatan"`, dsb.) ke database live.
   - Dilarang menjalankan query `UPDATE` atau `INSERT` pada tabel operasional (`store_config`, `products`, `vouchers`, `addresses`, `orders`) dengan data mock yang menggantikan data riil toko.

2. **Dilarang Mengarang Struct/Payload Uji dari Nol**:
   - Ketika menguji fitur baru (misalnya durasi flash sale atau banner baru), **JANGAN SEKALI-KALI** membuat object payload kosong atau dummy yang hanya diisi sebagian field lalu dikirim ke database live!

---

## 2. Hukum Mutlak 2: Prinsip "Fetch-First" (Wajib Gunakan Data Dinamis Asli yang Ada)

Jika suatu endpoint atau query database perlu diuji perilakunya:
1. **Langkah 1: Baca Data Riil yang Sedang Aktif (`SELECT`)**:
   - Ambil seluruh data dinamis yang ada di database saat ini:
     ```sql
     SELECT * FROM store_config WHERE id = 'main';
     ```
2. **Langkah 2: Gunakan Data Riil Sebagai Basis**:
   - Seluruh 50+ field asli (nama toko *Make Me Kool*, email, alamat *Wedomartani Sleman*, Area ID Biteship *IDNP5IDNC412IDND5051IDZ55584*, koordinat GPS, link IG *xar.project*, rekening *BLU by BCA*, menu navigasi footer) **WAJIB DIPERTAHANKAN APA ADANYA**.
3. **Langkah 3: Mutasi Hanya Field Target yang Diuji**:
   - Modifikasi **hanya 1 field spesifik** yang menjadi target fitur baru (misalnya `flash_sale_end_time`).
   - Tidak boleh ada satu pun field lain yang berubah atau terhapus.

---

## 3. Hukum Mutlak 3: Isolasi Pengujian dengan ROLLBACK atau Read-Only

Setiap pengujian script backend / database harus menggunakan salah satu dari 2 metode aman berikut:

### Metode A: Transaksi Rollback Otomatis (Dry-Run Test)
Jika ingin menguji apakah query `UPDATE`, `INSERT`, atau constraint baru bekerja tanpa error:
```go
// WAJIB gunakan transaksi yang di-ROLLBACK:
tx, err := conn.Begin(ctx)
if err != nil { ... }
defer tx.Rollback(ctx) // JAMINAN: Perubahan dibatalkan 100%

// Jalankan query pengujian di dalam transaksi tx
_, err = tx.Exec(ctx, query, ...)
if err != nil {
    log.Fatalf("Test Failed: %v", err)
}

// Log hasil sukses
log.Println("Query test passed validasi!")

// Transaksi otomatis di-ROLLBACK saat keluar dari fungsi.
// Data live di Supabase 100% AMAN dan TIDAK PERNAH TERCEMAR!
```

### Metode B: Read-Only Verification (`SELECT`)
Verifikasi logika dengan membaca data tanpa menulis:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'store_config';
```

---

## 4. Hukum Mutlak 4: Pertahanan Anti-Overwrite di Backend Golang

Setiap handler pembaruan (seperti `UpdateSettings` di [`settings.go`](file:///d:/Xar%20Project/mameko-backend/internal/controllers/settings.go)) **WAJIB** menerapkan proteksi kondisional `CASE WHEN` pada query `ON CONFLICT (id) DO UPDATE SET`:

```sql
ON CONFLICT (id) DO UPDATE SET
    store_name = CASE WHEN $1 <> '' THEN EXCLUDED.store_name ELSE store_config.store_name END,
    store_email = CASE WHEN $2 <> '' THEN EXCLUDED.store_email ELSE store_config.store_email END,
    store_city_id = CASE WHEN $6 <> '' THEN EXCLUDED.store_city_id ELSE store_config.store_city_id END,
    store_city_name = CASE WHEN $7 <> '' THEN EXCLUDED.store_city_name ELSE store_config.store_city_name END,
    low_stock_threshold = CASE WHEN $51::boolean THEN EXCLUDED.low_stock_threshold ELSE store_config.low_stock_threshold END,
    active_couriers = CASE WHEN $18::text = '[]' OR $18::text = '' OR $18::text = 'null' THEN store_config.active_couriers ELSE EXCLUDED.active_couriers END,
    hero = CASE WHEN $13::text = '{}' OR $13::text = '' OR $13::text = 'null' THEN store_config.hero ELSE EXCLUDED.hero END,
    about = CASE WHEN $14::text = '{}' OR $14::text = '' OR $14::text = 'null' THEN store_config.about ELSE EXCLUDED.about END,
    contact = CASE WHEN $16::text = '{}' OR $16::text = '' OR $16::text = 'null' THEN store_config.contact ELSE EXCLUDED.contact END,
    footer = CASE WHEN $17::text = '{}' OR $17::text = '' OR $17::text = 'null' THEN store_config.footer ELSE EXCLUDED.footer END,
```

- Jika client Android atau Web hanya mengirimkan pembaruan sebagian (misalnya hanya mengubah banner promo), kolom nama toko, kurir, alamat, footer, dsb. **TIDAK AKAN PERNAH TERTEMPA** dengan nilai default atau kosong.

---

## 5. Hukum Mutlak 5: Pembersihan Seketika ("Hapus Semua Tes Jika Tes Passed")

1. **Nol Sisa File Uji di Workspace**:
   - Segera setelah verifikasi / unit test berhasil (`BUILD SUCCESSFUL` / `PASSED`), **SEMUA file scratch, script tes sementara, dan runner uji coba WAJIB DIHAPUS BERSIH**.
   - Tidak boleh ada file `scratch/*.go`, `scratch/*.js`, atau script one-off yang tertinggal di folder manapun.
2. **Pre-Commit Guard**:
   - Sebelum tugas diserahkan ke pengguna, pastikan `git status` bersih dari file-file tes sementara.
