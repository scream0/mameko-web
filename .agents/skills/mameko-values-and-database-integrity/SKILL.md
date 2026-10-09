---
name: mameko-values-and-database-integrity
description: >-
  HUKUM MUTLAK ARSITEKTUR MAMEKO: Larangan keras segala bentuk hardcode (TIDAK BOLEH ADA HARDCODE SAMA SEKALI,
  termasuk teks UI, warna harfiah Color.White/Color.Black/hex, dimensi dp/sp, dan static dummy in-memory mock data).
  Seluruh teks wajib di strings.xml (UiText/stringResource), seluruh warna wajib dari MaterialTheme.colorScheme &
  semanticColors dengan pasangan kontras yang valid (containerColor + onColor), seluruh dimensi dari Dimens.kt,
  dan seluruh data bisnis wajib dinamis dari Supabase PostgreSQL / Golang API.
---

# Mameko Values & Database Integrity Skill
## HUKUM MUTLAK: TIDAK BOLEH ADA HARDCODE SAMA SEKALI (Zero Hardcode Standard)

Dokumen ini adalah standar arsitektur wajib yang mengikat seluruh developer dan agen AI di proyek Mameko:
1. **Zero Hardcoded Strings**: Seluruh teks UI wajib berada di `app/src/main/res/values/strings.xml`.
2. **Zero Hardcoded Colors**: Dilarang keras menuliskan warna harfiah (`Color.White`, `Color.Black`, `Color.Red`, `Color(0xFF...)`) langsung di `@Composable` atau UI logic. Wajib menggunakan token tema resmi dan mematuhi prinsip pasangan warna kontras (`containerColor` + `onColor`).
3. **Zero Hardcoded Dimensions**: Seluruh ukuran spacing, padding, radius, dan elevation wajib menggunakan token dari `Dimens.kt`.
4. **Zero Static / Mock / Hardcoded Data**: Seluruh entitas dan state bisnis wajib dinamis dari database (Supabase PostgreSQL / Golang REST API). Dilarang keras menyuntikkan data dummy ke database live.

---

## 1. Zero Hardcoded Colors Standard (Warna & Sejenisnya)

### A. Larangan Keras (Strictly Forbidden)
- **DILARANG KERAS** menggunakan warna harfiah langsung di dalam kode Jetpack Compose atau styling:
  ```kotlin
  // ❌ PELANGGARAN FATAL:
  contentColor = Color.White
  tint = Color.Black
  background(Color(0xFF0F172A))
  border(1.dp, Color(0xFFE2E8F0))
  color = Color.Red
  ```
- **Bahaya Fatal Hardcoded Colors**:
  - Di **Dark Mode**, background permukaan sering kali berwarna gelap (`#15181E`) atau terang (`DarkPrimaryAccent = #F1F5F9`). Jika teks di-hardcode `Color.White` di atas komponen yang berwarna `primary` (yang di Dark Mode bernilai putih/slate terang), maka terjadi **Zero Contrast Bug (teks putih di atas latar putih, kontras 1:1, teks hilang sama sekali)**!

### B. Aturan Wajib Token Warna Resmi
Seluruh warna wajib merujuk ke token resmi sistem desain Mameko:
1. **MaterialTheme.colorScheme**:
   - `primary`, `onPrimary`, `primaryContainer`, `onPrimaryContainer`
   - `secondary`, `onSecondary`, `secondaryContainer`, `onSecondaryContainer` (Volcanic Amber Gold Mameko)
   - `surface`, `onSurface`, `surfaceVariant`, `onSurfaceVariant`
   - `background`, `onBackground`
   - `outline`, `outlineVariant`
   - `error`, `onError`, `errorContainer`, `onErrorContainer`
2. **MaterialTheme.semanticColors**:
   - Akses via `val semantics = MaterialTheme.semanticColors`
   - `semantics.success`, `semantics.successBg`, `semantics.successBorder`
   - `semantics.warning`, `semantics.warningBg`, `semantics.warningBorder`
   - `semantics.danger`, `semantics.dangerBg`, `semantics.dangerBorder`
   - `semantics.info`, `semantics.infoBg`, `semantics.infoBorder`
   - `semantics.favorite` (Love / Heart)
   - `semantics.searchIcon`
   - `semantics.starRating`
   - `semantics.noteTop`, `semantics.noteHeart`, `semantics.noteBase`

### C. Prinsip Pasangan Kontras Wajib (Container-Content Pairing)
Setiap kali mendefinisikan wadah visual berlatar warna (Badge, Button, Card, Chip, Surface, Banner), **WAJIB** memasangkan warna wadah dengan warna konten pasangannya:

| Wadah (`containerColor`) | Konten / Teks / Ikon (`contentColor` / `tint`) |
| :--- | :--- |
| `MaterialTheme.colorScheme.primary` | `MaterialTheme.colorScheme.onPrimary` |
| `MaterialTheme.colorScheme.secondary` | `MaterialTheme.colorScheme.onSecondary` |
| `MaterialTheme.colorScheme.error` | `MaterialTheme.colorScheme.onError` |
| `MaterialTheme.colorScheme.surface` | `MaterialTheme.colorScheme.onSurface` |
| `MaterialTheme.colorScheme.surfaceVariant` | `MaterialTheme.colorScheme.onSurfaceVariant` |
| `MaterialTheme.colorScheme.primaryContainer` | `MaterialTheme.colorScheme.onPrimaryContainer` |
| `MaterialTheme.colorScheme.secondaryContainer` | `MaterialTheme.colorScheme.onSecondaryContainer` |
| `MaterialTheme.colorScheme.errorContainer` | `MaterialTheme.colorScheme.onErrorContainer` |

**Contoh Penerapan Benar pada Badge**:
```kotlin
// ✅ BENAR & MEMATUHI WCAG AAA DI LIGHT & DARK MODE:
Badge(
    containerColor = MaterialTheme.colorScheme.secondary,
    contentColor = MaterialTheme.colorScheme.onSecondary,
    modifier = Modifier.border(1.5.dp, MaterialTheme.colorScheme.surface, CircleShape)
) {
    Text(
        text = "$count",
        style = MaterialTheme.typography.labelSmall,
        fontWeight = FontWeight.ExtraBold
    )
}
```

---

## 2. Zero Hardcoded Strings Standard

### Core Rules
- **No literal Indonesian or English user-facing strings** inside `@Composable` functions, ViewModels, or Repositories.
- **Compose Layer**: Always use `stringResource(R.string.<key>)` or `stringResource(R.string.<key>, *args)`.
- **ViewModel / Business Logic Layer**:
  - Never emit raw String messages like `actionMessage = "Berhasil disimpan"`.
  - Use [`UiText`](file:///d:/Xar%20Project/mameko-app/app/src/main/java/com/mameko/util/UiText.kt):
    ```kotlin
    // For localized string resources with optional arguments
    actionMessage = UiText.StringResource(R.string.product_add_to_cart_success, quantity)

    // For dynamic API error messages received from server
    actionMessage = error.localizedMessage?.let { UiText.DynamicString(it) } 
        ?: UiText.StringResource(R.string.common_error)
    ```
  - In Composables, unpack cleanly:
    ```kotlin
    val context = LocalContext.current
    LaunchedEffect(state.actionMessage) {
        state.actionMessage?.let { msg ->
            snackbarHostState.showSnackbar(msg.asString(context))
        }
    }
    ```

### Naming Conventions in `strings.xml`
- App & General: `common_<action/status>` (e.g., `common_save`, `common_cancel`, `common_retry`)
- Feature Modules:
  - Feed: `feed_<subfeature>`
  - Catalog: `catalog_<subfeature>`
  - Product Detail: `product_<subfeature>`
  - Cart: `cart_<subfeature>`
  - Orders: `order_<subfeature>`
  - Checkout: `checkout_<subfeature>`
  - Admin: `admin_<subfeature>`

---

## 3. Zero Hardcoded Dimensions Standard (Tokens Spacing, Corner, Elevation)

### Core Rules
- **DILARANG KERAS** menuliskan ukuran `.dp` atau `.sp` secara harfiah di file Compose (misal: `padding(16.dp)`, `height(52.dp)`).
- **Gunakan Token dari [`Dimens.kt`](file:///d:/Xar%20Project/mameko-app/app/src/main/java/com/mameko/theme/Dimens.kt)**:
  - Spacing & Gap: `Dimens.Spacing2`, `Dimens.Spacing4`, `Dimens.Spacing8`, `Dimens.Spacing12`, `Dimens.Spacing16`, `Dimens.Spacing20`, `Dimens.Spacing24`, `Dimens.Spacing32`, dsb.
  - Corner Radius: `Dimens.ChipCorner`, `Dimens.ButtonCorner`, `Dimens.CardCorner`, `Dimens.InputCorner`, `Dimens.DialogCorner`, `Dimens.RadiusFull`.
  - Elevation: `Dimens.ElevationNone`, `Dimens.ElevationSm`, `Dimens.ElevationMd`, `Dimens.ElevationLg`.
  - Tinggi Komponen: `Dimens.ButtonHeight`, `Dimens.InputHeight`, `Dimens.AppBarHeight`.

---

## 4. Zero Static / Dummy Data Standard (100% Database Driven)

### Core Rules
- **No In-Memory Dummy Lists**: Never create static lists like:
  ```kotlin
  // STRICTLY FORBIDDEN:
  val dummyProducts = listOf(Product(...), Product(...))
  val mockBanners = listOf(Banner("Promo 50%"), ...)
  ```
- **Strict Prohibition of Static Data Injection into Database (HUKUM MUTLAK)**:
  - Refer to dedicated mandatory skill: [`mameko-zero-data-pollution-and-live-db-safety`](file:///d:/Xar%20Project/mameko-app/.agents/skills/mameko-zero-data-pollution-and-live-db-safety/SKILL.md).
  - NEVER execute test scripts, migration scripts, or scratch code that writes hardcoded/dummy static strings (e.g. `"Mameko"`, `"admin@mameko.id"`, `"151"`, `"Jakarta Barat"`, `"12430"`) into live/production Supabase PostgreSQL tables.
  - **Prinsip Fetch-First Dynamic Data**: Jika perlu menguji suatu fungsi, WAJIB ambil data dinamis asli yang sedang berjalan di DB via `SELECT` terlebih dahulu, jangan pernah mengarang struct payload dummy dari nol!
  - Test scripts that verify queries or database connectivity MUST BE **Read-Only** (`SELECT`) or use isolated transactions that are explicitly rolled back (`BEGIN ... ROLLBACK`).
  - Never overwrite existing real business settings in `store_config` with arbitrary mock test payloads.
- **Strict Prohibition of Static Fallback Overrides in Partial Updates**:
  - In backend controllers (e.g. `UpdateSettings` in Go):
    - When handling partial updates (e.g. updating only banners or promos), NEVER overwrite unsupplied columns with hardcoded static strings (e.g. `req.BannerOrder = "..."`, `req.AppUpdateTitle = "..."`).
    - Use safe conditional updates (`CASE WHEN $1 <> '' THEN EXCLUDED... ELSE existing... END`) to ensure existing live database values are strictly preserved.
  - In Android ViewModels & Repositories:
    - Never let default in-memory model instances freeze or shadow real dynamic data fetched from the API.
- **Real Database Sourcing**:
  - **Products & Variants**: Fetched from `products` table via `GetProductsUseCase` / `GetProductDetailUseCase`.
  - **Promos & Banners**: Built dynamically from `store_config` (table `store_config`) and active `vouchers` (table `vouchers`).
  - **Vouchers**: Sourced from `user_vouchers` / `vouchers` tables.
  - **Orders & Tracking**: Sourced from `orders` and `order_items` tables via Golang API.
  - **Store Configurations**: Sourced from `store_config` (payment methods, bank details, contact WhatsApp, banner toggle).
  - **Customer Addresses**: Sourced from `addresses` table via `GetAddressesUseCase`.
- **Empty & Loading States**:
  - While fetching from DB: Show skeleton shimmer loaders ([`SkeletonLoading.kt`](file:///d:/Xar%20Project/mameko-app/app/src/main/java/com/mameko/presentation/common/SkeletonLoading.kt)).
  - If DB returns empty list: Display dedicated empty state with localized illustration & text, NEVER fall back to dummy mock data.

---

## 5. Post-Test Cleanup & Pre-Commit Verification Checklist

### Mandatory Cleanup Rule: "Hapus Semua Tes Jika Tes Passed"
- **Temporary Test & Scratch Cleanup**:
  - Immediately after all unit tests or scratch database verification scripts have executed and passed successfully (`BUILD SUCCESSFUL` / `PASSED`), **ALL temporary scratch test files, one-off test scripts, and test artifacts MUST BE DELETED**.
  - Temporary files such as `scratch/test_*.go`, `scratch/check_*.go`, temporary mock files, and scratch JS test runners must not remain in the workspace.

### Pre-Commit Verification Checklist
Before considering any Android or Backend task complete, run:
1. **Hardcode Strings Scan**: Verify no Indonesian / English text is hardcoded outside `strings.xml`.
2. **Hardcode Colors Scan**: Verify no `Color.White`, `Color.Black`, `Color.Red`, or raw hex `Color(0xFF...)` is hardcoded. Verify every container color is paired with its appropriate `onColor`.
3. **Hardcode Dimensions Scan**: Verify no raw `.dp` or `.sp` literals exist outside token files.
4. **Static Data Scan**: Verify no `listOf(...)` with dummy models exists in UI files, and no hardcoded static strings are being written to database tables.
5. **Automated Verification**:
   ```bash
   ./gradlew.bat compileDebugKotlin
   ./gradlew.bat testDebugUnitTest
   ```
   Both commands MUST exit with code 0 (BUILD SUCCESSFUL).
6. **Test Cleanup**: Ensure all temporary test scripts created during the task are deleted once passed.
