---
name: mameko-owasp-top-10
description: >-
  Comprehensive OWASP Top 10 (2021) and OWASP Mobile Top 10 (2024) security standard,
  audit checklist, and defensive runbook for the Mameko ecosystem (Android Jetpack Compose,
  Go Fiber backend, Supabase PostgreSQL, Midtrans, and Biteship). Use whenever designing,
  auditing, refactoring, or reviewing code for security vulnerabilities.
---

# Mameko OWASP Top 10 Security & Hardening Standard

This skill establishes the mandatory security rules, automated audit checklists, and defensive programming standards for the **Mameko** ecosystem based on the **OWASP Top 10: 2021** (API & Web) and **OWASP Mobile Top 10: 2024**.

---

## 1. Ten Pillars of Mameko Security (OWASP Top 10: 2021)

### A01:2021 – Broken Access Control
**Requirement**: Enforce strict server-side authorization at every endpoint and prevent Insecure Direct Object References (IDOR).
1. **Route Middleware Segregation**:
   - Public: `/api/products`, `/api/categories`, `/api/banners`, `/api/vouchers`.
   - User Authenticated: `/api/cart`, `/api/profile`, `/api/addresses`, `/api/orders`, `/api/checkout` MUST use `middleware.RequireAuth()`.
   - Admin Protected: `/api/admin/*` MUST use `middleware.RequireAdmin()`.
2. **Anti-IDOR Rule (Actor Claim Overwrite)**:
   - NEVER trust a `user_id` supplied in the request body or JSON payload.
   - ALWAYS overwrite `req.UserID = actor.ID` where `actor` is extracted from the cryptographically verified JWT token (`c.Locals("user")`).
   - All mutations and sensitive queries MUST scope by `WHERE user_id = $1`.
3. **Database Row-Level Security (RLS)**:
   - Ensure Supabase tables have RLS enabled (`ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;`) so direct client queries via anon key cannot bypass business rules.

---

### A02:2021 – Cryptographic Failures
**Requirement**: Protect data in transit and rest with modern, audited cryptography.
1. **Enforce HTTPS / TLS 1.3**:
   - Android client MUST enforce `android:usesCleartextTraffic="false"` in `AndroidManifest.xml`.
   - All external API endpoints (Midtrans, Biteship, Cloudinary) MUST strictly use HTTPS.
2. **Constant-Time Comparison for Signatures**:
   - When verifying HMAC signatures or secrets, ALWAYS use `crypto/subtle` or `hmac.Equal(expectedMAC, actualSig)` to prevent timing side-channel attacks.
3. **Webhook Signatures**:
   - Midtrans webhook MUST verify SHA-512 `hash(order_id + status_code + gross_amount + ServerKey)`.
   - Biteship webhook MUST verify `X-Biteship-Secret` against the environment secret.
4. **Android Sensitive Storage**:
   - Auth tokens and sensitive keys in Android MUST be stored in private DataStore or `EncryptedSharedPreferences`. Never log or hardcode credentials.

---

### A03:2021 – Injection (SQLi, Command, Intent)
**Requirement**: Completely eliminate untrusted data interpretation in interpreters.
1. **Zero Raw SQL String Concatenation**:
   - NEVER use `fmt.Sprintf` or `+` to embed user input into SQL commands.
   - ALWAYS use parameterized placeholders (`$1, $2, ...`) paired with variadic `args...` slices.
   - Dynamic `IN (...)` queries must generate safe indexed placeholders:
     ```go
     placeholders := make([]string, len(ids))
     args := make([]interface{}, len(ids))
     for i, id := range ids {
         placeholders[i] = fmt.Sprintf("$%d", i+1)
         args[i] = id
     }
     query := fmt.Sprintf("SELECT * FROM items WHERE id IN (%s)", strings.Join(placeholders, ", "))
     rows, err := db.Query(query, args...)
     ```
2. **Android Room DAOs**:
   - Room queries must exclusively use named parameters: `@Query("SELECT * FROM cart_items WHERE user_id = :userId")`.
3. **Android Intent & FileProvider Injection**:
   - `FileProvider` and BroadcastReceivers MUST have `android:exported="false"` unless explicitly designed for public inter-app communication.

---

### A04:2021 – Insecure Design (Business Logic & Race Conditions)
**Requirement**: Defend against architectural race conditions, inventory exhaustion, and state corruption.
1. **Anti-Overselling Concurrency Lock**:
   - During checkout transactions in `order.go`, row-level locking MUST be used:
     `SELECT stock FROM product_variants WHERE id = $1 FOR UPDATE`.
   - If stock is insufficient, transaction is rolled back and HTTP 409 Conflict returned.
2. **Direct Buy (Beli Langsung) Isolation**:
   - "Beli Langsung" MUST bypass the permanent cart database and use in-memory transient data to prevent cart pollution and accidental cart clearing.
3. **Idempotency**:
   - Critical payment and order creation endpoints SHOULD support idempotency keys to handle duplicate network retries safely.

---

### A05:2021 – Security Misconfiguration
**Requirement**: Keep server and client configurations minimal, hardened, and locked down.
1. **HTTP Security Headers**:
   - Go Fiber must activate `helmet.New()` for security headers:
     - `X-Content-Type-Options: nosniff`
     - `X-Frame-Options: SAMEORIGIN`
     - `X-XSS-Protection: 0` (or `1; mode=block`)
2. **CORS Hardening**:
   - Restrict allowed origins to verified development and production domains (e.g. `localhost`, production web app). Never use open wildcard `AllowOrigins: "*"` for authenticated credentialed routes.
3. **Android Client Hardening**:
   - `android:allowBackup="false"` to prevent unauthorized extraction via ADB backup.
   - Payment `WebView` must disable file access:
     ```kotlin
     settings.allowFileAccess = false
     settings.allowContentAccess = false
     ```
   - Whitelist allowed hosts in WebView navigation (`*.midtrans.com`, `*.gopay.co.id`, `*.shopeepay.co.id`).

---

### A06:2021 – Vulnerable and Outdated Components
**Requirement**: Continuously track and remediate dependency vulnerabilities.
1. **Go Backend**:
   - Audit dependencies using `go list -m -u all` and run `govulncheck ./...`.
2. **Android Client**:
   - Keep Gradle plugins and AndroidX/Jetpack libraries updated to actively supported versions.
3. **Zero Deprecated Cryptographic Libraries**:
   - Use standard library `crypto/hmac`, `crypto/sha512`, `crypto/subtle`.

---

### A07:2021 – Identification and Authentication Failures
**Requirement**: Thwart brute-force attacks, credential stuffing, and session hijacks.
1. **Multi-Tier Rate Limiting in Fiber**:
   - Global API: 120 requests/minute.
   - Auth & OTP routes (`/api/auth/*`): **5 requests per 2 minutes** per IP.
   - Checkout creation: **10 orders per minute**.
2. **Strict Algorithm Validation**:
   - Rejection of `"alg": "none"` in JWT tokens.
   - Token signature validation MUST fail if secret is empty or malformed.
3. **Session Revocation**:
   - Ensure refresh tokens can be invalidated upon logout or password reset via Supabase Auth.

---

### A08:2021 – Software and Data Integrity Failures
**Requirement**: Ensure code and critical event inputs cannot be forged or tampered with.
1. **Webhook Integrity Verification**:
   - Webhook endpoints must reject unauthenticated requests before reading or modifying database state.
   - Cron endpoints (`/api/cron/*`) must enforce `CRON_SECRET_KEY` via `X-Cron-Key` header.
2. **Android APK Signing**:
   - Production releases must use APK Signature Scheme v2/v3 with secure release keys never checked into Git.

---

### A09:2021 – Security Logging and Monitoring Failures
**Requirement**: Log actionable security telemetry without leaking sensitive credentials.
1. **Sanitized Logging**:
   - NEVER log full JWT tokens, passwords, OTPs, or CVVs in stdout or Android Logcat.
2. **Middleware Telemetry**:
   - Fiber `logger.New()` logs method, path, status, latency, and client IP.
   - Fiber `recover.New()` catches panics and returns safe HTTP 500 without exposing stack traces to end users.
3. **Alerting Triggers**:
   - Spikes in HTTP 401/403 or 429 must trigger monitoring alerts.

---

### A10:2021 – Server-Side Request Forgery (SSRF)
**Requirement**: Prevent backend servers from being used as proxies to access internal networks.
1. **Controlled Egress**:
   - External HTTP requests in Go backend must only target fixed, pre-configured base URLs (Midtrans API, Biteship API, Cloudinary).
2. **Prohibit Arbitrary User URLs**:
   - Endpoints must NEVER accept arbitrary target URLs from client input for server-side downloading without strict protocol and IP-range validation.

---

## 2. OWASP Mobile Top 10 (2024) Quick Reference

| OWASP Mobile Ref | Category | Mameko Implementation Standard |
| :--- | :--- | :--- |
| **M1** | Improper Credential Usage | Store tokens in private encrypted storage; no hardcoded API secrets in APK. |
| **M2** | Inadequate Supply Chain | Audit Gradle dependencies; use official Google and MavenCentral repositories. |
| **M3** | Insecure Authentication | Supabase Auth JWT with automatic refresh rotation and backend rate limits. |
| **M4** | Insufficient Validation | Strict Kotlinx Serialization / Gson type validation; ViewModel boundary sanitation. |
| **M5** | Insecure Communication | Mandate `usesCleartextTraffic="false"`; enforce TLS 1.3 encryption. |
| **M6** | Inadequate Privacy | Request minimal permissions (`INTERNET`, `ACCESS_NETWORK_STATE` only). |
| **M7** | Insufficient Binary Protection | Enable R8 / ProGuard shrinking and obfuscation on release builds. |
| **M8** | Security Misconfiguration | `allowBackup="false"`, `exported="false"` on non-launcher activities and receivers. |
| **M9** | Insecure Data Storage | Room DB in private sandbox (`/data/data/com.mameko/...`); no cache leaks to SD card. |
| **M10** | Insufficient Cryptography | Standard Android Keystore, AES-GCM, and TLS encryption. |

---

## 3. Fast Security Audit Runbook

### A. Quick SQL Injection Audit (Backend)
Run this pattern scan to ensure no raw string formatting exists in SQL queries:
```bash
# Verify all SQL queries in controllers use parameter placeholders
grep -rn "SELECT\|INSERT\|UPDATE\|DELETE" internal/controllers/ | grep -v "\$"
```

### B. Quick Android Manifest Security Check
Verify hardening attributes in `app/src/main/AndroidManifest.xml`:
```bash
grep "allowBackup\|usesCleartextTraffic\|exported" app/src/main/AndroidManifest.xml
```
*Expected*:
- `android:allowBackup="false"`
- `android:usesCleartextTraffic="false"`
- `android:exported="false"` for all internal receivers, providers, and services.

### C. JWT & Auth Middleware Verification Test
Verify `internal/middleware/auth.go`:
- Checks `hmac.Equal`.
- Checks `alg != "none"`.
- Checks `secret != ""`.
- Overwrites user context in `c.Locals("user", user)`.
