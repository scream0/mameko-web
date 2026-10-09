---
name: mameko-security-and-hardening
description: >-
  Standard and audit runbook for full-stack security across Mameko Android client and Golang backend
  (SQL injection prevention, cryptographic JWT signature validation, webhook authentication,
  Android backup & network security, and WebView hardening).
---

# Mameko Fundamental Security & Hardening Skill

This skill provides architectural standards, vulnerability audit runbooks, and remediation checklists for securing the Mameko e-commerce ecosystem across the native Android client (`mameko-app`) and the Go Fiber backend API (`xar-backend-go` / `mameko-backend`).

---

## 1. Core Security Commandments

1. **Zero Raw SQL Concatenation (SQLi Prohibition)**:
   - NEVER format or concatenate untrusted inputs into SQL strings using `fmt.Sprintf("... '%s' ...", val)` or `+ val +`.
   - All query arguments MUST use parameterized placeholders (`$1, $2, ...`) and pass values via `Query(query, args...)` or `Exec(query, args...)`.
   - For dynamic `IN (...)` clauses, generate indexed placeholders (`$1, $2, ...`) dynamically alongside an `args` slice.

2. **Strict Cryptographic JWT Signature Enforcement**:
   - NEVER bypass signature verification when environment secrets are missing or when unfamiliar algorithms are declared.
   - Explicitly reject `"alg": "none"` or unverified algorithms with `401 Unauthorized`.
   - Ensure `SUPABASE_JWT_SECRET` is non-empty before accepting HMAC-SHA256 tokens.
   - Asymmetric tokens (`ES256`, `RS256`) must be validated against public JWKS; unverified claims must never be trusted.
   - Always compare HMAC signatures using constant-time comparison (`hmac.Equal`) to prevent timing attacks.

3. **Authenticity of Webhooks and External Gateways**:
   - All inbound webhooks (Midtrans, Biteship, etc.) must verify cryptographic signatures or secret authorization tokens before updating orders or financial records.
   - Automated maintenance and cron routes (e.g. `/api/cron/auto-confirm`) must require a secret token header (`X-Cron-Key` or `Authorization: Bearer <CRON_SECRET>`) to prevent denial-of-service and state tampering.

4. **Android Client OS & Network Hardening**:
   - `android:allowBackup="false"` must be set in `AndroidManifest.xml` to prevent unencrypted extraction of app private data (DataStore auth tokens, cache, and Room DB) via ADB.
   - `android:usesCleartextTraffic="false"` must be explicitly enforced to mandate TLS 1.3 / HTTPS encryption.
   - Payment WebViews must disable local file access (`allowFileAccess = false`, `allowContentAccess = false`) and restrict navigation exclusively to trusted payment gateway domains (`*.midtrans.com`).

5. **Information Leakage & Error Sanitization**:
   - Never return internal database error messages (`err.Error()`, table names, or PostgreSQL syntax errors) in client HTTP responses. Return user-friendly, localized error messages while logging details securely on the server.

---

## 2. Backend Security Standards & Remediation Runbook

### A. Dynamic `IN (...)` Parameterization Pattern
When querying or updating multiple IDs dynamically:

**❌ DANGEROUS (Vulnerable to SQL Injection)**:
```go
// DO NOT DO THIS
var strIds []string
for _, id := range ids {
    strIds = append(strIds, fmt.Sprintf("'%s'", id)) // Attacker can inject ' OR '1'='1
}
query := fmt.Sprintf("UPDATE chats SET is_read = true WHERE id IN (%s)", strings.Join(strIds, ","))
config.DB.Exec(query)
```

**✅ SECURE (Parameterized Placeholders)**:
```go
if len(ids) == 0 {
    return nil
}
placeholders := make([]string, len(ids))
args := make([]interface{}, 0, len(ids)+2)
args = append(args, userID) // $1

for i, id := range ids {
    placeholders[i] = fmt.Sprintf("$%d", i+2)
    args = append(args, id)
}

query := fmt.Sprintf(
    `UPDATE chats SET is_read = true WHERE user_id = $1 AND sender_role = 'admin' AND id::text IN (%s)`,
    strings.Join(placeholders, ", "),
)
_, err := config.DB.Exec(query, args...)
```

### B. JWT Authentication Middleware Hardening (`internal/middleware/auth.go`)
```go
func verifySupabaseSignature(tokenString string) error {
    parts := strings.Split(tokenString, ".")
    if len(parts) != 3 {
        return fiber.NewError(fiber.StatusUnauthorized, "Malformed JWT structure")
    }

    headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
    if err != nil {
        headerBytes, err = base64.URLEncoding.DecodeString(parts[0])
    }
    var header JWTHeader
    if err != nil || json.Unmarshal(headerBytes, &header) != nil {
        return fiber.NewError(fiber.StatusUnauthorized, "Invalid JWT header")
    }

    alg := strings.ToUpper(strings.TrimSpace(header.Alg))
    if alg == "" || alg == "NONE" {
        return fiber.NewError(fiber.StatusUnauthorized, "Insecure or missing JWT algorithm")
    }

    secret := strings.TrimSpace(os.Getenv("SUPABASE_JWT_SECRET"))

    if alg == "HS256" {
        if secret == "" {
            log.Printf("[Security Alert] SUPABASE_JWT_SECRET is unset in backend environment!")
            return fiber.NewError(fiber.StatusInternalServerError, "Server authentication misconfiguration")
        }

        signingInput := parts[0] + "." + parts[1]
        mac := hmac.New(sha256.New, []byte(secret))
        mac.Write([]byte(signingInput))
        expectedSignature := mac.Sum(nil)

        actualSignature, err := base64.RawURLEncoding.DecodeString(parts[2])
        if err != nil {
            actualSignature, err = base64.URLEncoding.DecodeString(parts[2])
            if err != nil {
                return fiber.NewError(fiber.StatusUnauthorized, "Invalid JWT signature encoding")
            }
        }

        if !hmac.Equal(expectedSignature, actualSignature) {
            return fiber.NewError(fiber.StatusUnauthorized, "Invalid JWT cryptographic signature")
        }
        return nil
    }

    return fiber.NewError(fiber.StatusUnauthorized, "Unsupported JWT signing algorithm: " + alg)
}
```

### C. Webhook Verification Standards (`internal/controllers/webhooks.go`)
1. **Midtrans Webhook**:
   - Calculate SHA-512 over `order_id + status_code + gross_amount + server_key`.
   - Reject with `403 Forbidden` if `!strings.EqualFold(signatureKey, expectedSignature)`.
2. **Biteship Webhook**:
   - Check `X-Biteship-Key` or `Authorization: Bearer <SECRET>` header matching `BITESHIP_WEBHOOK_SECRET`.
   - If unconfigured in local development, emit prominent warning logs; in production, strictly reject unauthenticated requests.
3. **Internal Cron Endpoints**:
   - Require `X-Cron-Key: <CRON_SECRET>` or shared secret query parameter to execute `/api/cron/auto-confirm`.

---

## 3. Android Client Security Standards

### A. Manifest Security (`AndroidManifest.xml`)
```xml
<application
    android:name=".MamekoApplication"
    android:allowBackup="false"
    android:usesCleartextTraffic="false"
    ...>
```
- `android:allowBackup="false"`: Ensures `adb backup` cannot dump private application storage, SQLite databases, or DataStore preferences containing user session tokens.
- `android:usesCleartextTraffic="false"`: Blocks any unencrypted HTTP traffic from leaving the application.

### B. Payment WebView Hardening (`PaymentWebScreen.kt`)
When embedding payment gateway flows in Jetpack Compose WebViews:
```kotlin
AndroidView(
    modifier = Modifier.fillMaxSize(),
    factory = { ctx ->
        WebView(ctx).apply {
            // Security hardening settings
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                allowFileAccess = false
                allowContentAccess = false
                loadWithOverviewMode = true
                useWideViewPort = true
            }

            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                    val url = request?.url?.toString() ?: return false

                    // Restrict external navigation to whitelisted payment hosts
                    val uri = request.url
                    val host = uri.host ?: ""
                    val isAllowedHost = host.endsWith("midtrans.com") ||
                            host.endsWith("gopay.co.id") ||
                            host.endsWith("shopeepay.co.id")

                    // Allow native deep-link schemes for verified e-wallets
                    if (url.startsWith("gojek://") || url.startsWith("shopeepay://")) {
                        try {
                            ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                            return true
                        } catch (_: Exception) {
                            return false
                        }
                    }

                    // Callback interception
                    if (url.contains("status_code=200") || url.contains("finish")) {
                        onPaymentSuccess(orderId, orderNumber, totalAmount, false)
                        return true
                    }
                    
                    return false
                }
            }
        }
    }
)
```

---

## 4. Web Frontend Client Standards (Mameko Web / Next.js Static Export)

### A. Connection Pooling Architecture
- **Static Export Architecture**: `mameko-web` is built with `output: 'export'` (SSG/SPA) and deployed as static assets to Cloudflare Pages.
- **Centralized Database Pooling**: The web client does NOT maintain a Node.js server runtime or direct TCP database connections. All database transactions are routed to the central Golang backend API (`mameko-backend`), which handles the PgBouncer + Go connection pool (`MaxOpenConns=25`, `MaxIdleConns=15`).
- **Edge HTTP Multiplexing**: Browsers and Cloudflare Pages automatically reuse connections via HTTP/2 and HTTP/3 multiplexing.

### B. HTTP Security Headers on Cloudflare Pages (`public/_headers`)
Static sites on Cloudflare Pages must define OWASP security headers in `public/_headers`:
```
/*
  Content-Security-Policy: default-src 'self'; ...
  X-Frame-Options: SAMEORIGIN
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

### C. Client Environment Variable Safety
- ONLY variables prefixed with `NEXT_PUBLIC_` may be referenced in web source code.
- Private secrets (`DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MIDTRANS_SERVER_KEY`, `CLOUDINARY_API_SECRET`) must NEVER be exposed or prefixed with `NEXT_PUBLIC_`.
- Web API calls must attach `Authorization: Bearer <session.access_token>` to allow the Go backend to verify authentication cryptographically.

---

## 5. Periodic Security Audit Verification Checklist

Before shipping releases or merging pull requests:
- [ ] Run automated scan for `fmt.Sprintf` with SQL verbs: Ensure 0 raw string interpolations exist.
- [ ] Verify `SUPABASE_JWT_SECRET` is defined in production and staging environments.
- [ ] Verify `android:allowBackup="false"` is set in `app/src/main/AndroidManifest.xml`.
- [ ] Verify `android:usesCleartextTraffic="false"` is enforced.
- [ ] Verify `public/_headers` enforces complete OWASP headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`).
- [ ] Run `go vet ./...` and ensure zero static analysis errors.
- [ ] Verify error responses in controllers return sanitized messages to prevent database schema disclosure.

