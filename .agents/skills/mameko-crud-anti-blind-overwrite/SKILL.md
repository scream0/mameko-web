---
name: mameko-crud-anti-blind-overwrite
description: Mandatory development standard and code quality runbook for Mameko: Strict prohibition of blind overwrites on CRUD operations. Enforces Dynamic Partial Update Pattern across Golang backend (Go Fiber + pgx/stdlib), TypeScript Next.js web client, and Kotlin Android client so that updating a single field never overwrites, resets, or wipes other fields.
---

# Mameko CRUD Anti-Blind Overwrite Standard & Best Practices

## 1. Filosofi & Prinsip Mutlak

> **HUKUM UTAMA CRUD MAMEKO**:
> **Jika hanya 1 (satu) data atau field yang diubah oleh pengguna/klien, seluruh data dan field lainnya HARUS 100% dipreservasi dan DILARANG KERAS tertimpa atau ter-reset ke nilai default kosong (`""`, `0`, `false`, `null`, atau `[]`).**

### Larangan Keras (Anti-Patterns yang Dilarang)
1. **DILARANG Static Full-Row SQL Update** pada endpoint update/patch umum:
   ```sql
   -- CONTOH BURUK (DILARANG KERAS):
   UPDATE products SET
       name = $1, description = $2, category = $3, weight = $4,
       variants = $5::jsonb, status = $6, updated_at = NOW()
   WHERE id = $7;
   ```
   *Bahaya*: Jika pemanggil hanya ingin mengarsipkan produk (`status = "archived"`), query di atas akan menghapus `description`, me-reset `weight` ke default, dan **me-wipe seluruh `variants` menjadi array kosong `[]`**.
2. **DILARANG Mengisi Fallback Kosong ke Objek yang Tidak Diubah**:
   Di sisi frontend (Web / Android), dilarang mengirimkan `{}` atau `[]` untuk bagian formulir yang tidak disentuh pengguna pada saat submit parsial.
3. **DILARANG Blind Overwrite pada Kolom JSONB**:
   Menimpa objek JSONB (seperti `value`, `footer`, `contact`, `variants`) tanpa klausa perlindungan `COALESCE` atau `jsonb_set` bersyarat.

---

## 2. Arsitektur Backend (Golang Fiber + PostgreSQL)

Setiap endpoint pembaruan data (misal: `UpdateProduct`, `UpdateAddress`, `UpdateSettings`, `UpdateProfile`) WAJIB menerapkan **Dynamic Partial Update Pattern**.

### Pola Standar: Dynamic SQL Generator

```go
func UpdateEntity(c *fiber.Ctx) error {
	var rawReq map[string]interface{}
	if err := c.BodyParser(&rawReq); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid JSON payload"})
	}

	entityID := strings.TrimSpace(c.Params("id"))
	if entityID == "" {
		entityID, _ = rawReq["id"].(string)
	}

	updates := []string{}
	args := []interface{}{}
	argIdx := 1

	// 1. Text Field (String)
	if val, ok := rawReq["name"]; ok && val != nil {
		str := strings.TrimSpace(fmt.Sprintf("%v", val))
		if str != "" {
			updates = append(updates, fmt.Sprintf("name = $%d", argIdx))
			args = append(args, str)
			argIdx++
		}
	}

	// 2. Numeric Field (Float/Int)
	if val, ok := rawReq["weight"]; ok && val != nil {
		if num, err := strconv.ParseFloat(fmt.Sprintf("%v", val), 64); err == nil && num > 0 {
			updates = append(updates, fmt.Sprintf("weight = $%d", argIdx))
			args = append(args, num)
			argIdx++
		}
	}

	// 3. Boolean Flag (Pointer / Bool check)
	if val, ok := rawReq["is_active"].(bool); ok {
		updates = append(updates, fmt.Sprintf("is_active = $%d", argIdx))
		args = append(args, val)
		argIdx++
	}

	// 4. JSONB Array / Complex Object (CRITICAL: Only update if explicitly present!)
	if val, ok := rawReq["variants"]; ok && val != nil {
		b, err := json.Marshal(val)
		if err == nil && len(b) > 0 && string(b) != "null" {
			updates = append(updates, fmt.Sprintf("variants = $%d::jsonb", argIdx))
			args = append(args, string(b))
			argIdx++
		}
	}

	// 5. Cek apakah ada perubahan yang diminta
	if len(updates) == 0 {
		return c.JSON(fiber.Map{
			"success": true,
			"message": "Tidak ada perubahan data yang diminta",
		})
	}

	// 6. Selalu tambahkan updated_at
	updates = append(updates, "updated_at = NOW()")

	// 7. Eksekusi query dinamis
	args = append(args, entityID)
	query := fmt.Sprintf("UPDATE my_table SET %s WHERE id::text = $%d", strings.Join(updates, ", "), argIdx)

	res, err := config.DB.Exec(query, args...)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	// 8. Selalu kembalikan entitas segar yang lengkap dari database
	//    agar klien menerima state terkini, bukan payload parsial.
	return ReturnFreshEntity(c, entityID)
}
```

### Aturan Khusus untuk Kolom JSONB (Hierarchical Data)
Jika tabel memiliki kolom JSONB (seperti `store_config.value`):
- Jangan pernah menimpa root JSONB dengan hasil serialisasi parsial.
- Gunakan nested `jsonb_set` dengan klausa `COALESCE`:
  ```sql
  '{footer}', CASE 
      WHEN EXCLUDED.footer = '{}'::jsonb OR EXCLUDED.footer = 'null'::jsonb 
      THEN COALESCE(store_config.footer, store_config.value->'footer', '{}'::jsonb) 
      ELSE EXCLUDED.footer 
  END
  ```

---

## 3. Arsitektur Frontend Web (Next.js / TypeScript)

Pada form admin multi-tab atau form terpisah:
1. **Deep Merge Baseline State**:
   Sebelum mengirim form, pastikan payload mengambil baseline dari `initialData`/`rawSettings` dan hanya meng-override bagian yang memang diedit pengguna:
   ```ts
   // Helper untuk menjaga data yang tidak diedit
   const strictValue = (editedVal: any, ...fallbacks: any[]) => {
     if (editedVal !== undefined && editedVal !== null && String(editedVal).trim() !== "") return editedVal;
     for (const fb of fallbacks) {
       if (fb !== undefined && fb !== null && String(fb).trim() !== "") return fb;
     }
     return "";
   };
   ```
2. **Proteksi Array Kosong**:
   Jika user sedang mengedit tab Informasi Toko, form TIDAK BOLEH mengirimkan `links: []` atau `paymentMethods: []` untuk tab Footer. Gunakan nilai baseline yang sudah ada di memori.

---

## 4. Arsitektur Android Client (Kotlin / Compose)

1. **Serialization Non-Null**:
   Pada model DTO Retrofit untuk Request Update/Patch:
   - Gunakan tipe data nullable (`val name: String? = null`, `val status: String? = null`).
   - Pastikan serializer (Moshi / Gson) diatur agar tidak menserialisasi field bernilai `null` (`serializeNulls = false`).
2. **Dedicated Partial Use Cases**:
   - Jika ada aksi seperti *"Ubah Status Produk"*, buat UseCase khusus yang hanya mengirim `{ "productId": id, "status": newStatus }`.
   - Hindari mengambil seluruh objek UI State lalu mengirim ulang seluruh field ke backend jika hanya 1 field yang diubah.

---

## 5. Checklist Verifikasi Anti-Blind Overwrite

Sebelum sebuah fitur CRUD dinyatakan selesai, wajib melalui checklist berikut:
- [ ] **Uji Partial Update 1-Field**: Kirim request yang hanya berisi 1 field (misal: `{"status": "inactive"}`).
- [ ] **Verifikasi Preservasi**: Pastikan field-field lain (nama, deskripsi, gambar, varian, koordinat, relasi) tidak berubah sama sekali di database.
- [ ] **Uji Rollback Terisolasi**: Seluruh pengujian otomatis di live database wajib dieksekusi di dalam transaksi `ROLLBACK` (sesuai skill `mameko-zero-data-pollution-and-live-db-safety`).
- [ ] **Pembersihan Scratch Script**: Seluruh file test sementara langsung dihapus setelah pengujian selesai.
