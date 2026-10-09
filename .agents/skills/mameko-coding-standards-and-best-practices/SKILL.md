---
name: mameko-coding-standards-and-best-practices
description: >-
  Mandatory development standard and code quality runbook for Mameko: Best practices for
  coroutine concurrency, lifecycle safety, anti-flicker UI state management, non-blocking
  interceptors, distinct pull-to-refresh states, clean error propagation, and robust API contracts.
  Use whenever writing, reviewing, refactoring, or auditing code across Mameko Android and Backend.
---

# Mameko Coding Standards & Best Practices Skill

This skill defines non-negotiable software engineering standards and best practices for the Mameko codebase across native Android (Kotlin + Jetpack Compose) and Backend (Golang Fiber + Supabase).

---

## 1. Concurrency & Coroutine Lifecycle Guarantees

### Rule 1.1: Mandatory `try ... catch ... finally` in ViewModels
Every asynchronous network or repository operation inside a ViewModel coroutine **must** be wrapped in a `try ... catch ... finally` block. Loading and refreshing state flags (`isLoading`, `isRefreshing`, `isSaving`, etc.) must **always** be guaranteed to reset in the `finally` block so UI spinners never freeze or hang.

```kotlin
// [CORRECT PATTERN]
fun loadData(isRefresh: Boolean = false) {
    loadJob?.cancel()
    loadJob = viewModelScope.launch {
        _uiState.update { 
            it.copy(
                isLoading = !isRefresh && it.items.isEmpty(),
                isRefreshing = isRefresh,
                errorMessage = null
            ) 
        }
        try {
            val result = useCase()
            result.onSuccess { data ->
                _uiState.update { it.copy(items = data) }
            }.onFailure { err ->
                _uiState.update { it.copy(errorMessage = err.localizedMessage) }
            }
        } catch (e: Exception) {
            if (e !is CancellationException) {
                _uiState.update { it.copy(errorMessage = e.localizedMessage) }
            }
        } finally {
            _uiState.update { it.copy(isLoading = false, isRefreshing = false) }
        }
    }
}
```

### Rule 1.2: Active Job Cancellation on Re-trigger
Before launching a fetch for the same resource, always cancel the preceding active job (`job?.cancel()`). This avoids race conditions where an earlier slow request overwrites a newer fast response.

### Rule 1.3: Reactive Deduplication with `distinctUntilChanged()`
When collecting `Flow` or `StateFlow` from DataStore, repositories, or auth managers, always append `.distinctUntilChanged()` or verify state changes before triggering expensive network calls. Never invoke identical fetches repeatedly on redundant flow emissions.

### Rule 1.4: Strict Prohibition of `runBlocking` in Interceptors
OkHttp worker threads must **never** be blocked with `runBlocking` on disk I/O, DataStore, or lock-contended resources.
- Always use `@Volatile` in-memory cached tokens in `TokenManager`.
- Interceptors must fetch tokens non-blocking via `tokenManager.getCachedToken()` in $O(1)$ time.

### Rule 1.5: Atomic Guard on Financial & Non-Idempotent Actions (Double-Tap Prevention)
Every checkout, order creation, or payment submission must enforce an atomic guard:
- Check both state flag and active job: `if (_uiState.value.isProcessingPayment || checkoutJob?.isActive == true) return`
- Mutate state to `isProcessing = true` **synchronously** before launching the coroutine or switching dispatchers.
- Button enabled state must reflect: `enabled = !state.isProcessingPayment && state.canProceedToPayment`.

### Rule 1.6: Debounced Mutations with Per-Entity Job Tracking
For high-frequency user interactions (Cart quantity `+`/`-`, Feed Like/Bookmark toggle, Wishlist add/remove):
- Update `_uiState` optimistically and immediately for zero-latency UI response.
- Track in-flight jobs in a `ConcurrentHashMap<String, Job>()` keyed by item/post ID.
- Cancel previous pending jobs for that specific ID and apply a 150ms–300ms debounce before executing network calls.
- Roll back optimistically updated state if the remote call fails.

### Rule 1.7: Bulletproof Composite Keys in LazyLists (`itemsIndexed`)
Never use bare `key = { it.id }` in `LazyColumn`, `LazyRow`, or `LazyVerticalGrid`.
Always use `itemsIndexed` with composite unique keys:
`key = { index, item -> "${item.id.ifEmpty { "item" }}_$index" }`
This prevents fatal `IllegalArgumentException: Key was already used` crashes on empty IDs or pagination duplicates.

### Rule 1.8: Mandatory `while (isActive)` for Coroutine Loops
Never use `while (true)` in ViewModel coroutines or `LaunchedEffect` loops (heartbeats, carousels, pollers). Always use `while (isActive)` with `import kotlinx.coroutines.isActive` to guarantee immediate cancellation on lifecycle cleanup.

---

## 2. Jetpack Compose State & Anti-Flicker Best Practices

### Rule 2.1: Absolute Separation of `isRefreshing` vs `isLoading`
- `isLoading`: Indicates initial screen loading or content placeholder state.
- `isRefreshing`: Indicates an active user-initiated pull-to-refresh swipe gesture.
- **NEVER** bind `PullToRefreshBox(isRefreshing = state.isLoading)`. It causes top refresh spinners to stay permanently stuck on initial screen load.
- Always bind `PullToRefreshBox(isRefreshing = state.isRefreshing)`.

### Rule 2.2: Single-Screen Refresh Independence
Never combine refresh flags from multiple ViewModels into a single screen's `PullToRefreshBox` (e.g., `isRefreshing = state.isRefreshing || otherState.isRefreshing`).
- Each screen's pull-to-refresh spinner must close as soon as that screen's primary data finishes refreshing.
- Auxiliary data from other ViewModels may refresh in the background independently without holding the screen's refresh indicator hostage.

### Rule 2.3: Anti-Flicker Skeleton Pattern
A shimmer or skeleton placeholder must **only** appear when:
1. `state.isLoading == true`, **AND**
2. `state.data == null` (or `isEmpty()`).

When coroutines cancel or transient re-fetches occur, the UI must **never** flash back and forth between skeleton and empty content. Preserve existing data in state while re-fetching.

### Rule 2.4: Elimination of Duplicate Lifecycle Effects
Do not add redundant `LaunchedEffect(Unit)` triggers in `@Composable` screens if:
- The ViewModel already initializes data in `init {}`.
- Another `LaunchedEffect(isLoggedIn)` or `LaunchedEffect(key)` already handles entry fetch.
Redundant lifecycle triggers cause thundering herds and screen flickering.

---

## 3. Backend API & Cryptographic Contract Standards

### Rule 3.1: Multi-Algorithm JWT Verification (`HS256` & `ES256`)
In Golang API middleware:
- Legacy Supabase tokens use `HS256` (HMAC-SHA256 with `SUPABASE_JWT_SECRET`).
- Modern Supabase Auth tokens default to asymmetric `ES256` (ECDSA P-256).
- The middleware must verify both:
  - `HS256`: Verify HMAC signature against `SUPABASE_JWT_SECRET`.
  - `ES256`: Verify ECDSA signature against Supabase project JWKS (`/.well-known/jwks.json`) with an in-memory 1-hour public key cache.
- Algorithm `none` or mismatched signatures must be strictly rejected with HTTP 401.

### Rule 3.2: Parameterized SQL & Graceful Error Handling
- Never concatenate raw user input into SQL strings. Always use `$1, $2, ...` parameterized queries with `database/sql`.
- Return clean, structured JSON responses:
  ```json
  {
    "success": false,
    "error": "Pesan error ramah pengguna",
    "data": null
  }
  ```

### Rule 3.3: Strict Prohibition of Blind Overwrites on CRUD (Dynamic Partial Updates)
- Every update endpoint across Backend Go (`product.go`, `address.go`, `settings.go`, `user.go`) **must** adhere to the **Dynamic Partial Update Pattern** (see skill `mameko-crud-anti-blind-overwrite`).
- If a client only submits 1 field, all other fields **must** remain 100% intact in the database.
- It is strictly forbidden to use static full-row updates that default omitted fields to empty strings, zero, or empty arrays (`variants = []`, `description = ""`, etc.).

---

## 4. Quality Gate & Pre-Commit Verification Checklist

Before considering any Android or Backend modification complete, execute this mandatory 5-point verification:

1. **Backend Auth Test**: Run API test script against `/api/user/profile` using an authentic token to verify HTTP 200 OK and correct JSON payload.
2. **Android Compilation**: Run `.\gradlew compileDebugKotlin` and verify `BUILD SUCCESSFUL` (0 errors).
3. **Android Unit Tests**: Run `.\gradlew testDebugUnitTest` and verify all tests pass.
4. **No Hardcoded Strings**: Verify all new strings are referenced via `R.string.*` in `strings.xml`.
5. **No Static Dummies**: Verify all business entities are backed by dynamic network/database models.
