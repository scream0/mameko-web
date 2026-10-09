---
name: mameko-race-condition-and-concurrency-hardening
description: >-
  Comprehensive standard and audit runbook for preventing race conditions, state desynchronization,
  and concurrency vulnerabilities across the Mameko ecosystem (Android Kotlin/Jetpack Compose,
  Coroutines, StateFlow, Room DB, Go Fiber backend, and Supabase PostgreSQL).
---

# Mameko Race Condition & Concurrency Hardening Standard

This skill documents the non-negotiable architectural laws and implementation patterns for preventing race conditions, concurrent state thrashing, and timing vulnerabilities across the entire Mameko ecosystem (Android Native Kotlin + Go Fiber + Supabase PostgreSQL).

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

## 2. Backend & Database Concurrency Laws

### Law 7: Row-Level Locking on Inventory (`SELECT FOR UPDATE`)
During checkout and stock deduction in Go Backend:
- Always use `SELECT ... FOR UPDATE` within a database transaction (`database/sql.Tx`) to lock target product/variant rows.
- Verify that `stock >= requested_quantity` under lock before executing `UPDATE products SET stock = stock - requested_quantity`.
- This prevents overselling when multiple users concurrently purchase the last stock unit.

### Law 8: Idempotent Payment Webhook Transitions
- In webhook controllers (Midtrans / Biteship):
- Orders already marked as `paid`, `settled`, or `cancelled` must not be mutated or have their stock deducted/restored a second time.
- State-machine checks must gate every transition:
  ```go
  if existingOrder.PaymentStatus == "settled" && newStatus == "settled" {
      return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "already processed"})
  }
  ```

---

## 3. Pre-Commit Concurrency Audit Checklist

Before committing any feature or refactoring:
- [ ] Are all financial/checkout buttons guarded by both `isProcessingPayment` and `job?.isActive`?
- [ ] Are rapid user actions (likes, cart quantity, bookmarks) debounced with `ConcurrentHashMap<String, Job>`?
- [ ] Are all local entity IDs generated with `UUID.randomUUID()` instead of timestamp?
- [ ] Do all `LazyColumn`, `LazyRow`, and `LazyVerticalGrid` use `itemsIndexed` with composite keys `${id}_$index`?
- [ ] Are all recurring loops using `while (isActive)` instead of `while (true)`?
- [ ] Are prior network jobs cancelled when switching search queries or category filters?
- [ ] Did `.\gradlew compileDebugKotlin` and `.\gradlew testDebugUnitTest` pass with 100% success?
