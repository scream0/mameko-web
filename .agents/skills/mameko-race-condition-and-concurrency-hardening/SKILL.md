---
name: mameko-race-condition-and-concurrency-hardening
description: >-
  Comprehensive standard and audit runbook for preventing race conditions, state desynchronization,
  WebSocket lifecycle collisions, multi-tab token overwrites, and concurrency vulnerabilities across
  the Mameko ecosystem (Next.js 15 Web, Native WebSocket, Android Kotlin/Jetpack Compose, Coroutines,
  StateFlow, Room DB, Go Fiber backend, and Self-Hosted Docker PostgreSQL 16).
---

# Mameko Race Condition & Concurrency Hardening Standard

This skill documents the non-negotiable architectural laws and implementation patterns for preventing race conditions, concurrent state thrashing, WebSocket lifecycle collisions, and timing vulnerabilities across the entire Mameko ecosystem (Next.js 15 Web + Android Native Kotlin + Go Fiber + Self-Hosted Docker PostgreSQL 16).

---

## 1. Android Client Concurrency & State Laws

### Law 1: Atomic Guard on Financial & State-Changing Actions (Double-Tap Prevention)
Any action that creates an order, triggers payment, or performs non-idempotent operations **must** enforce an atomic guard before launching any coroutine:

1. **Synchronous State Flag Check**: Check both the boolean flag in state and the coroutine `Job` status.
2. **Synchronous UI State Mutation**: Set `isProcessing = true` **immediately** via synchronous `_uiState.update {}` before entering `viewModelScope.launch` or switching dispatchers.

```kotlin
// [CORRECT PATTERN] - In ViewModel
private var checkoutJob: Job? = null

fun processCheckout(onSuccess: (OrderTransaction) -> Unit) {
    val current = _uiState.value
    // 1. Synchronous Guard Check
    if (current.isProcessingPayment || checkoutJob?.isActive == true) {
        return
    }
    
    // 2. Immediate Synchronous State Mutation
    _uiState.update { it.copy(isProcessingPayment = true, errorMessage = null) }
    
    // 3. Launch Dedicated Job
    checkoutJob?.cancel()
    checkoutJob = viewModelScope.launch {
        createCheckoutUseCase(...).fold(
            onSuccess = { transaction ->
                _uiState.update { it.copy(isProcessingPayment = false) }
                onSuccess(transaction)
            },
            onFailure = { error ->
                _uiState.update { 
                    it.copy(
                        isProcessingPayment = false, 
                        errorMessage = error.localizedMessage 
                    ) 
                }
            }
        )
    }
}
```

In Jetpack Compose buttons:
```kotlin
// Button enabled state must reflect processing flag
Button(
    onClick = { viewModel.processCheckout(...) },
    enabled = !state.isProcessingPayment && state.canProceedToPayment
)
```

---

### Law 2: Debounced Mutations with Per-Entity Job Tracking
For high-frequency user interactions (such as Cart quantity `+`/`-`, Feed Like/Bookmark toggle, Wishlist add/remove):
1. **Immediate Optimistic UI Update**: Update the local `StateFlow` immediately so the UI remains ultra-fluid and responsive.
2. **Per-Entity Concurrent Job Tracker**: Use `ConcurrentHashMap<String, Job>()` to track in-flight network requests per entity ID.
3. **Cancellation & Debounce**: Cancel any pending in-flight request for that specific entity ID and apply a debounce (150ms–300ms) before hitting the remote API.
4. **Rollback on Error**: If the network request fails, roll back the state gracefully.

```kotlin
// [CORRECT PATTERN] - Per-Entity Debounce
private val quantityUpdateJobs = ConcurrentHashMap<String, Job>()

private fun changeQuantity(cartItemId: String, delta: Int) {
    val currentItem = _uiState.value.items.find { it.id == cartItemId } ?: return
    val targetQuantity = currentItem.quantity + delta
    if (delta > 0 && targetQuantity > currentItem.stock) {
        _uiState.update { it.copy(actionMessage = UiText.StringResource(R.string.cart_max_stock_reached)) }
        return
    }
    if (targetQuantity < 1) {
        requestRemove(cartItemId)
        return
    }

    // 1. Optimistic UI Update (Immediate)
    _uiState.update { state ->
        state.copy(
            items = state.items.map {
                if (it.id == cartItemId) it.copy(quantity = targetQuantity) else it
            }
        )
    }

    // 2. Debounce and serialize server updates
    quantityUpdateJobs[cartItemId]?.cancel()
    quantityUpdateJobs[cartItemId] = viewModelScope.launch {
        delay(150L) // Debounce rapid taps
        updateCartQuantityUseCase(cartItemId, targetQuantity)
    }
}
```

---

### Law 3: Zero Timestamp Collisions — Mandatory UUID for Local Identifiers
- **Strict Prohibition**: Never use `System.currentTimeMillis()` or `System.nanoTime()` alone to generate entity IDs (e.g., `"cart-item-${System.currentTimeMillis()}"` or `"direct-buy-${System.currentTimeMillis()}"`). Sequential user interactions or simultaneous background processes can generate identical timestamps within the same millisecond.
- **Mandatory Pattern**: Always use `java.util.UUID.randomUUID().toString()`:
```kotlin
// [CORRECT]
val newItem = CartItem(
    id = "cart-item-${java.util.UUID.randomUUID()}",
    productId = productId,
    ...
)
```

---

### Law 4: Bulletproof Composite Unique Keys in Compose LazyLists
- **Risk**: Bare `key = { it.id }` crashes the app with `IllegalArgumentException: Key was already used` if duplicate items exist from pagination, empty string IDs (`""`), or transient network retries.
- **Strict Law**: All `LazyColumn`, `LazyRow`, and `LazyVerticalGrid` collections **must** use composite unique keys combining the ID and item index via `itemsIndexed`:

```kotlin
// [CORRECT PATTERN]
itemsIndexed(
    items = productList,
    key = { index, item -> "${item.id.ifEmpty { "item" }}_$index" }
) { index, product ->
    ProductCard(product = product, ...)
}
```

---

### Law 5: Coroutine Lifecycle-Safe Loops (`while (isActive)`)
- **Strict Prohibition**: Never use `while (true)` inside coroutines or `LaunchedEffect` loops (tickers, carousels, presence heartbeats, notification pollers).
- **Mandatory Pattern**: Always use `while (isActive)` with `import kotlinx.coroutines.isActive` so that cancellation signals from ViewModel disposal or Compose unmounting are respected immediately.

```kotlin
// [CORRECT PATTERN]
fun startHeartbeat() {
    heartbeatJob?.cancel()
    heartbeatJob = viewModelScope.launch {
        while (isActive) {
            try {
                chatRepository.sendHeartbeat()
            } catch (_: Exception) {}
            delay(25000L)
        }
    }
}
```

---

### Law 6: Active Job Cancellation on Resource Switching / Search
When fetching search results or changing filter/category chips:
1. Always hold an active `Job` reference (e.g., `loadProductsJob: Job?`).
2. Cancel the prior job (`loadProductsJob?.cancel()`) before launching a new request.
3. This guarantees that an earlier, slower network response cannot overwrite a newer, faster network response with stale data.

---

## 2. Next.js Web & Realtime WebSocket Concurrency Laws

### Law 7: Per-Tab Session Isolation (`sessionStorage` Priority Over `localStorage`)
- **Risk**: `localStorage` is shared across all tabs of the same origin. When a developer or user opens Tab 1 as Customer and Tab 2 as Admin in the same browser, logging in on Tab 2 overwrites `localStorage.getItem("mameko_access_token")`. Subsequent `getSession()` calls or WebSocket reconnects in Tab 1 then read the Admin token, causing Tab 1's WebSocket to register under the wrong identity!
- **Strict Law**:
  1. `NativeAuthClient.saveSession()` **must** write `mameko_access_token`, `mameko_refresh_token`, and `mameko_user` to **both** `sessionStorage` (tab-isolated) and `localStorage` (initial cross-tab persistence).
  2. `NativeAuthClient.loadSessionFromStorage()` and `SharedRealtimeSocket.ensureConnected()` **must** read `sessionStorage.getItem("mameko_access_token")` **first** before falling back to `localStorage`, and immediately pin any fallback session into `sessionStorage` for that tab.
  3. If `SharedRealtimeSocket.ensureConnected()` detects that the active token has changed (`this.currentToken !== token`), it must cleanly disconnect the old socket and open a new WebSocket with the new token.

---

### Law 8: WebSocket Instance Reference Guard & Debounced Unregister (`SharedRealtimeSocket`)
- **Risk**: When `disconnect()` closes an old `WebSocket` (`ws1`) and `ensureConnected()` immediately opens a new `WebSocket` (`ws2`), `ws1`'s asynchronous `onclose` or `onerror` callback fires a few milliseconds later and resets `this.isConnecting = false` or clears `this.pingTimer` belonging to `ws2`. Additionally, React 19 StrictMode double-mount or tab transitions briefly drop `this.channels.size` to `0`, aborting an in-flight `WebSocket.CONNECTING` handshake if `disconnect()` runs synchronously.
- **Strict Law**:
  1. Capture the local socket reference `const ws = new WebSocket(wsUrl); this.ws = ws;` and guard **every** callback (`ws.onopen`, `ws.onmessage`, `ws.onclose`, `ws.onerror`) with `if (this.ws !== ws) return;` on its first line.
  2. In `unregister(ch)`, **never** call `this.disconnect()` synchronously when `this.channels.size === 0`. Always debounce disconnection by `1500ms` (`this.disconnectTimer`) and cancel the timer inside `register(ch)`.

```ts
// [CORRECT PATTERN] - Instance-Guarded WebSocket Lifecycle
const ws = new WebSocket(wsUrl);
this.ws = ws;

ws.onopen = () => {
  if (this.ws !== ws) return;
  this.isConnecting = false;
  // ...
};

ws.onclose = () => {
  if (this.ws !== ws) return;
  this.ws = null;
  this.isConnecting = false;
  // ...
};
```

---

### Law 9: Isolated `NativeRealtimeChannel` Instances (Zero Topic Collision)
- **Risk**: Returning a shared `NativeRealtimeChannel` from a `Map<string, NativeRealtimeChannel>` keyed by topic name causes two concurrently mounted components using the same topic (e.g., `AdminDashboard` and `AdminChatView` both using `"public:chats:presence"`) to clobber each other. When one component unmounts and calls `mamekoClient.removeChannel(ch)`, it unsubscribes and kills the active channel of the other component.
- **Strict Law**:
  1. `MamekoClientFacade.channel(topic)` **must** always return a new `NativeRealtimeChannel(topic)` instance tracked inside a `Set<NativeRealtimeChannel>`.
  2. `mamekoClient.removeChannel(ch)` **must** only unsubscribe and remove that exact `ch` instance (`this.activeChannels.delete(ch)`).
  3. Components **must never** iterate `mamekoClient.getChannels().find(c => c.topic === ...)` to forcibly remove channels created by other components.

---

### Law 10: Strict Event/Filter Matching & Anti-Jump State Diffing on Realtime Chat
- **Risk**: Dispatching `messages_read` (`eventType: "UPDATE"`) to an `event: "INSERT"` listener corrupts chat state with blank message bubbles. Replacing `messages` state on every background sync poll with a new array reference forces `useEffect([messages])` to scroll to the bottom even when no new message arrived.
- **Strict Law**:
  1. `NativeRealtimeChannel.dispatchMessage()` **must** validate `l.filter.table`, `l.filter.event` (`INSERT` vs `UPDATE` vs `*`), and `l.filter.filter` (`user_id=eq.<id>`).
  2. Background sync polls (`fetchMessages`) **must** compare `prev` and `fetchedData` (length, message `id`s, and `is_read` flags) and return `prev` unchanged if no data changed.
  3. Scroll-to-bottom effects in chat views **must** depend on `[messages.length, isTyping]` rather than the raw `messages` array reference.

---

## 3. Backend & Database Concurrency Laws

### Law 11: Row-Level Locking on Inventory (`SELECT FOR UPDATE`)
During checkout and stock deduction in Go Backend:
- Always use `SELECT ... FOR UPDATE` within a database transaction (`database/sql.Tx`) to lock target product/variant rows.
- Verify that `stock >= requested_quantity` under lock before executing `UPDATE products SET stock = stock - requested_quantity`.
- This prevents overselling when multiple users concurrently purchase the last stock unit.

### Law 12: Idempotent Payment Webhook Transitions & Realtime Read Broadcasts
- In webhook controllers (Midtrans / Biteship):
  - Orders already marked as `paid`, `settled`, or `cancelled` must not be mutated or have their stock deducted/restored a second time.
  - State-machine checks must gate every transition:
    ```go
    if existingOrder.PaymentStatus == "settled" && newStatus == "settled" {
        return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "already processed"})
    }
    ```
- In chat controllers (`UserMarkAsRead`, `AdminMarkAsRead`) and WebSocket `ChatHandler`:
  - Always broadcast read status updates via `websocket.GlobalHub.BroadcastReadStatus(userID, ...)` and forward `"typing"` events via `GlobalHub` so both User and Admin UIs stay synchronized in realtime without polling race conditions.
  - Exempt `/ws/*` and `/api/heartbeat` from the global anti-DDoS rate limiter in `cmd/api/main.go` so active realtime sessions never trigger HTTP `429 Too Many Requests`.

---

## 4. Pre-Commit Concurrency Audit Checklist

Before committing any feature or refactoring:
- [ ] Are `sessionStorage` and `localStorage` synchronized with `sessionStorage` priority in `NativeAuthClient` so multi-tab User + Admin sessions never overwrite each other?
- [ ] Are all `SharedRealtimeSocket` callbacks guarded with `if (this.ws !== ws) return;` and `unregister()` debounced by `1500ms`?
- [ ] Does `mamekoClient.channel(topic)` return an isolated `NativeRealtimeChannel` instance tracked in a `Set`?
- [ ] Do chat background syncs diff `prev` vs `fetchedData` before updating state, and do scroll effects depend on `messages.length`?
- [ ] Are all financial/checkout buttons guarded by both `isProcessingPayment` and `job?.isActive` / `useRef` lock?
- [ ] Are rapid user actions (likes, cart quantity, bookmarks) debounced with `ConcurrentHashMap<String, Job>` or `AbortController`?
- [ ] Are all local entity IDs generated with `UUID.randomUUID()` / `crypto.randomUUID()` instead of timestamp?
- [ ] Do all `LazyColumn`, `LazyRow`, and `LazyVerticalGrid` use `itemsIndexed` with composite keys `${id}_$index`?
- [ ] Are all recurring loops using `while (isActive)` (Kotlin) or cleaned-up `setInterval` (React `useEffect`)?
- [ ] Did `npx tsc --noEmit` and `npm test` (Web) or `.\gradlew compileDebugKotlin` and `.\gradlew testDebugUnitTest` (Android) pass with 100% success?
