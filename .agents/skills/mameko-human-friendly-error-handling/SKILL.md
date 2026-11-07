---
name: mameko-human-friendly-error-handling
description: >-
  HUKUM MUTLAK PENANGANAN ERROR MAMEKO: Larangan keras menampilkan raw JSON
  ({"error":...}, [...]), HTML error gateway (502/504), pesan SQL/PostgreSQL
  (SQLSTATE, pq:, pgx, sql:), nama class exception (HttpException, TypeError,
  SocketTimeoutException), kode status mentah, atau stacktrace ke pengguna di
  seluruh ekosistem Mameko (Android Jetpack Compose, Next.js Web, dan Golang
  Backend). Gunakan selalu saat menulis, merefaktor, atau mengaudit API,
  controller, repository, ViewModel, toast, snackbar, banner, form, dan halaman error.
---

# Mameko Human-Friendly Error Handling Skill
## HUKUM MUTLAK: DILARANG MENAMPILKAN RAW JSON DAN PESAN TEKNIS KE PENGGUNA

Dokumen ini adalah standar wajib penanganan error di seluruh ekosistem Mameko (`mameko-backend`, `mameko-app`, dan `mameko-web`). Pengguna akhir maupun admin **TIDAK BOLEH PERNAH** melihat payload JSON mentah, error database, HTML gateway, atau pesan exception internal di komponen UI mana pun (Toast, Snackbar, Alert Banner, Dialog, Inline Input Error, maupun Empty/Error State).

---

## 1. Daftar Output yang Dilarang Keras Tampil di UI (Zero Technical Leak)

Segala bentuk string di bawah ini adalah **pelanggaran kritis** apabila sampai terlihat oleh pengguna:

1. **Payload JSON / Array Mentah**:
   - Contoh terlarang: `{"error":"Kode OTP salah","success":false}`, `{"message":"invalid token"}`, `[{"field":"email"}]`
2. **Error Database & Query SQL**:
   - Contoh terlarang: `ERROR: column pr.title does not exist (SQLSTATE 42703)`, `sql: no rows in result set`, `pq: duplicate key value violates unique constraint`
3. **HTML Error dari Proxy / CDN / Tunnel**:
   - Contoh terlarang: `<!DOCTYPE html><html>...502 Bad Gateway`, `Cloudflare Ray ID...`
4. **Exception Runtime, Jaringan, & Bahasa Pemrograman**:
   - Android/Kotlin: `retrofit2.HttpException: HTTP 500`, `java.net.UnknownHostException: Unable to resolve host`, `kotlinx.serialization.json.internal.JsonDecodingException`
   - Web/JS: `TypeError: Failed to fetch`, `TypeError: supabase.auth.updateUser is not a function`, `SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`
   - Golang/Upstream: `Post "https://api.resend.com/emails": context deadline exceeded`, body mentah dari Midtrans/Biteship/Cloudinary
5. **Stacktrace, Path File Server, atau Nama Tabel/Kolom Internal**.
6. **File Mentah & Dump Output**:
   - Pengguna dilarang menerima atau dipaksa mengunduh file mentah (seperti file `.json`, `.sql`, `.log`, `.txt`, `.tmp`, atau crash memory dump) saat terjadi kegagalan proses.
   - Endpoint maupun handler dilarang menghasilkan browser file download dialog saat permintaan gagal; wajib mengembalikan representasi visual anggun di halaman atau toast ter-sanitasi.
7. **Tautan Rusak & Navigasi 404 Tak Terkendali (Dead-End Notification Routing)**:
   - Dilarang keras menavigasikan pengguna ke rute yang belum terdaftar atau tautan relatif tak valid (seperti `order/ORD-xxx` tanpa leading slash atau rute yang tidak dikenali Next.js App Router).
   - Seluruh tautan notifikasi wajib melalui resolver kanonikal dengan failover aman ke dashboard.

---

## 2. Arsitektur Pertahanan Berlapis (3-Layer Defense-in-Depth)

Keamanan tampilan pesan error tidak boleh hanya bergantung pada satu sisi. Ketiga lapisan wajib menerapkan filter secara independen:

```
[Database / 3rd Party API]
        |
        v (Layer 1: Backend Sanitizer - Log detail teknis di server, kirim pesan bisnis bersih)
[Golang Fiber API Response: {"success": false, "code": "...", "error": "Pesan manusiawi"}]
        |
        v (Layer 2 & 3: Client Parser & Technical Leak Guard di Android / Web)
[Komponen UI: Toast / Snackbar / Banner / Inline Form Error dengan bahasa Indonesia yang jelas]
```

---

## 3. Standar Layer 1: Golang Backend (`mameko-backend`)

### A. Larangan `err.Error()` Langsung ke JSON Response
Dilarang mengembalikan `err.Error()` mentah dari driver PostgreSQL (`pgx`/`database/sql`), `json.Unmarshal`, `http.Client`, atau SDK pihak ketiga ke client:

```go
// SALAH (Membocorkan struktur tabel/SQL/upstream ke client):
if err != nil {
    return c.Status(500).JSON(fiber.Map{"error": err.Error()})
}
```

### B. Pola Wajib Helper `httperr` & Fiber `ErrorHandler`
Gunakan helper terpusat (`internal/utils/httperr`) dan global `fiber.Config{ErrorHandler: ...}`:
1. **Log di Server**: Catat error teknis lengkap menggunakan `log.Printf("[ERROR] %s %s: %v", c.Method(), c.Path(), err)` agar mudah diaudit via `docker logs mameko-api`.
2. **Kirim Pesan Ramah Pengguna**: Kembalikan pesan bahasa Indonesia yang sopan, spesifik terhadap aksi, dan bebas istilah teknis:

```go
// BENAR:
if err != nil {
    return httperr.Internal(c, "Gagal memuat daftar pesan. Silakan coba lagi.", err)
}
```

3. **Pemetaan Error Berdasarkan Kategori HTTP**:
   - `400 Bad Request`: Pesan validasi spesifik yang ditulis eksplisit oleh developer (misal: `"Format alamat email tidak valid."`). Jangan pernah meneruskan error `BodyParser` mentah seperti `unexpected end of JSON input`.
   - `401 Unauthorized`: `"Sesi Anda telah berakhir. Silakan masuk kembali."`
   - `403 Forbidden`: `"Anda tidak memiliki izin untuk mengakses fitur ini."`
   - `404 Not Found`: `"Data yang diminta tidak ditemukan."`
   - `409 Conflict`: Pesan konflik bisnis spesifik (misal: `"Email sudah terdaftar."`).
   - `429 Too Many Requests`: `"Terlalu banyak percobaan. Silakan tunggu beberapa saat lagi."`
   - `500 / 502 / 503`: `"Terjadi kendala pada layanan kami. Silakan coba beberapa saat lagi."`

---

## 4. Standar Layer 2: Android Native (`mameko-app`)

### A. Larangan Keras `errorBody()?.string()` Mentah ke `Exception`
Repository dilarang melempar body HTTP mentah langsung ke `Result.failure(Exception(rawBody))`:

```kotlin
// SALAH (Menyebabkan Snackbar menampilkan {"error":"...","success":false}):
if (!response.isSuccessful) {
    val raw = response.errorBody()?.string() ?: "Error"
    return Result.failure(Exception(raw))
}
```

### B. Pola Wajib `ApiErrorParser` + `UiText` + `strings.xml`
1. **Ekstraksi Terpusat (`ApiErrorParser`)**:
   - Parse field `error` atau `message` dari JSON body menggunakan `kotlinx.serialization` secara aman (`runCatching`).
   - Jalankan fungsi deteksi kebocoran teknis (`isTechnicalOrRawPayload(text)`):
     - Tolak string jika diawali/diakhiri `{...}` atau `[...]`, mengandung tag HTML (`<!DOCTYPE`, `<html`, `<body`), pola SQL (`SQLSTATE`, `pq:`, `pgx`, `sql:`, `syntax error`), nama exception (`Exception`, `Error:`, `TypeError`, `retrofit2`, `okhttp3`, `java.`, `kotlin.`, `kotlinx.`), URL mentah (`http://`, `https://`), atau kode mentah (`HTTP 500`, `status code`).
   - Jika pesan hasil ekstraksi aman dan ramah manusia, gunakan pesan tersebut; jika terdeteksi teknis atau kosong, petakan status HTTP (`400`, `401`, `403`, `404`, `408`, `429`, `500..599`) ke resource `R.string.err_*` di `res/values/strings.xml`.
2. **Pemetaan Exception Jaringan**:
   - `UnknownHostException` / `ConnectException` -> `UiText.StringResource(R.string.err_no_internet)`
   - `SocketTimeoutException` -> `UiText.StringResource(R.string.err_connection_timeout)`
   - `SerializationException` -> `UiText.StringResource(R.string.err_invalid_server_response)`
3. **Sabuk Pengaman Terakhir pada `UiText`**:
   - Pada `UiText.DynamicString(value)`, lakukan guard sanitasi sebelum dirender ke Compose agar bila ada kode lama yang tidak sengaja membungkus JSON mentah atau nama class exception, UI otomatis menggantinya dengan string fallback dari `strings.xml`.
4. **Kepatuhan Zero Hardcode**:
   - Seluruh pesan fallback di sisi Android wajib berada di `app/src/main/res/values/strings.xml` (mematuhi `mameko-values-and-database-integrity`).

---

## 5. Standar Layer 3: Next.js Web (`mameko-web`)

### A. Larangan `res.text()` atau `err.message` Tanpa Sanitasi
Komponen React dan helper API dilarang meneruskan `err.message` langsung ke `toast.error(...)` atau state `setError(...)` tanpa melewati fungsi sanitasi:

```tsx
// SALAH (Bisa memunculkan TypeError JS, HTML 502, atau JSON string):
catch (err: any) {
    toast.error(err.message);
}
```

### B. Pola Wajib `sanitizeUserError` + `src/data/ui/*.json`
1. **Gunakan `src/utils/errorSanitizer.ts` di Seluruh Pemanggilan API & Catch Block**:
   - `parseApiErrorResponse(res, fallbackMessage)`: membaca `content-type`, mengekstrak `data.error || data.message` bila valid JSON, dan mengabaikan HTML gateway (`502`/`504`).
   - `sanitizeUserError(err, fallbackMessage)`:
     - Jika `err` berupa string JSON (`{...}` / `[...]`), coba `JSON.parse` untuk mengambil field `error`/`message` di dalamnya; jika tidak ada atau masih teknis, kembalikan `fallbackMessage`.
     - Blokir seluruh pola teknis JS/Browser/DB (`Failed to fetch`, `NetworkError`, `Load failed`, `is not a function`, `Cannot read properties of`, `Unexpected token`, `SQLSTATE`, `ERROR:`, `pq:`, `<!DOCTYPE`, `HTTP 5`).
     - Petakan error koneksi (`Failed to fetch` / `NetworkError`) ke pesan koneksi internet dari `src/data/ui/common.json`.
2. **Kepatuhan Zero Hardcode Web**:
   - Seluruh teks fallback error wajib diambil dari `src/data/ui/common.json` atau file JSON fitur terkait (mematuhi `mameko-web-dev`).

### C. Mandat Next.js App Router Error Boundaries (`error.tsx` & `global-error.tsx`)
1. Setiap crash rendering atau error tak tertangani di tingkat komponen client/server **WAJIB** dicegah bocor ke layar browser menggunakan `src/app/error.tsx` dan `src/app/global-error.tsx`.
2. Halaman error boundary wajib:
   - Menyajikan desain visual editorial mewah berstandar Mameko (bukan default React error overlay).
   - Menghilangkan kode stacktrace dan detail exception dari mata pengguna.
   - Menyediakan tombol pemulihan interaktif ("Coba Lagi" via fungsi `reset()`) dan tautan kembali ke Beranda (`/`).
   - Mengambil seluruh copy teks dari `src/data/ui/common.json`.

### D. Standar Keamanan Link Notifikasi (Zero 404 Linking)
1. **Pencegahan Tautan Relatif Mentah**:
   - Dilarang langsung memanggil `router.push(notification.link)` tanpa normalisasi.
   - Pola format backend seperti `"order/" + orderNumber` wajib ditransformasikan melalui helper kanonikal `resolveCanonicalNotificationUrl` menjadi `/dashboard/order-detail?id=${orderNumber}` atau `/dashboard?tab=orders`.
2. **Fallback Safety Guard**:
   - Jika `link` bernilai `null`, kosong, atau tidak cocok dengan rute Next.js manapun, router wajib mengarahkan pengguna ke tab aman di `/dashboard` sesuai kategori notifikasi (bukan membiarkan router membuka path rusak yang memicu halaman 404).

---

## 6. Checklist Audit Wajib Sebelum Rilis

Sebelum menyatakan tugas selesai, pastikan seluruh poin berikut terpenuhi:
- [ ] Tidak ada `c.Status(...).JSON(fiber.Map{"error": err.Error()})` untuk error DB, serialisasi, jaringan, atau layanan pihak ketiga di `mameko-backend`.
- [ ] Global `ErrorHandler` pada Fiber aktif menangkap panic maupun error tak terduga dengan format manusiawi.
- [ ] Tidak ada `response.errorBody()?.string()` di `mameko-app` yang langsung dilempar ke `Exception(...)` tanpa melalui `ApiErrorParser`.
- [ ] `UiText` memiliki guard anti-JSON dan anti-exception sehingga komponen Compose mustahil merender `{...}` ke layar.
- [ ] Tidak ada `toast.error(err.message)` atau `setError(err.message)` mentah di `mameko-web` tanpa `sanitizeUserError(...)`.
- [ ] `src/app/error.tsx` dan `src/app/global-error.tsx` aktif dan terverifikasi menangkap unhandled error tanpa menampilkan dump teknis atau file mentah.
- [ ] Seluruh klik notifikasi (order, retur, promo, wallet) berhasil diarahkan ke rute kanonikal yang valid tanpa pernah memicu 404 Page Not Found.
- [ ] Saat internet diputus, server mati (`502`), atau input tidak valid (`400`/`401`/`429`), pesan yang muncul di layar selalu menggunakan bahasa Indonesia yang sopan, singkat, dan jelas langkah perbaikannya.
