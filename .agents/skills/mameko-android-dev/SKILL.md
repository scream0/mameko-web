---
name: mameko-android-dev
description: >-
  Expert guide and runbook for developing, refactoring, and verifying native Android
  features in Mameko (Kotlin + Jetpack Compose + Material 3) integrating with Golang API,
  Supabase Auth/Realtime, Room DB, Midtrans Snap SDK, and Biteship Logistics. Use whenever
  implementing, modifying, or testing Android client code in the Mameko codebase according to the PRD.
---

# Mameko Android Native Development Skill

This skill provides step-by-step procedures, architectural constraints, and standard patterns for building and maintaining the Mameko Android Native e-commerce application.

---

## 1. Clean Architecture Structure

All Android code in `app/src/main/java/com/mameko/` must strictly follow Clean Architecture with 3 isolated layers:

```
com.mameko/
├── presentation/          # UI Layer (Jetpack Compose, ViewModels, State)
│   ├── common/            # Reusable UI components (Buttons, TopBars, Shimmer, Dialogs)
│   ├── <feature>/         # Feature modules: auth, home, product_detail, cart, checkout, orders, wallet, profile, chat
│   │   ├── <Feature>Screen.kt
│   │   ├── <Feature>ViewModel.kt
│   │   ├── <Feature>UiState.kt
│   │   └── <Feature>UiEvent.kt
├── domain/                # Pure Kotlin Business Logic (No Android framework imports)
│   ├── model/             # Domain entities (immutable data classes)
│   ├── repository/        # Repository interfaces
│   └── usecase/           # Atomic business use cases (e.g. GetCartUseCase, RequestWithdrawalUseCase)
└── data/                  # Data Layer (Remote & Local implementations)
    ├── remote/            # Retrofit interfaces, DTOs, OkHttp interceptors
    ├── local/             # Room Database, DAO interfaces, Entity classes, DataStore
    └── repository/        # Repository implementations coordinating local & remote sources
```

---

## 2. Standard Development Workflow

When implementing any feature from the PRD:

### Step 1: Define Domain Models & Repository Interface
1. Create domain entity in `domain/model/<Entity>.kt`.
2. Define contract in `domain/repository/<Feature>Repository.kt` returning `Flow<Result<T>>` or `Result<T>`.
3. Create atomic UseCase in `domain/usecase/<Action>UseCase.kt`.

### Step 2: Implement Data Layer
1. Define DTOs in `data/remote/dto/` using `kotlinx.serialization` annotations (`@Serializable`, `@SerialName`).
2. Define API endpoints in `data/remote/api/<Feature>ApiService.kt`.
3. If local caching is required, create Room `@Entity` and `@Dao` in `data/local/`.
4. Implement the repository in `data/repository/<Feature>RepositoryImpl.kt` mapping DTOs/Entities to Domain Models.

### Step 3: Implement Presentation Layer
1. Define `UiState` representing data, loading flags, and error messages.
2. Define `UiEvent` sealed interface for user actions (e.g., clicks, submissions).
3. Implement `ViewModel` inheriting `androidx.lifecycle.ViewModel`:
   - Expose UI state via `StateFlow<UiState>`.
   - Collect flows using `viewModelScope`.
4. Implement Compose screen in `<Feature>Screen.kt`:
   - Stateless composables with hoisted state and lambda callbacks.
   - Use Material 3 (`androidx.compose.material3.*`).
   - Include interactive preview composables (`@Preview`).

### Step 4: Verification & Build
Always verify changes with Gradle commands:
```bash
./gradlew testDebugUnitTest
./gradlew assembleDebug
```

---

## 3. Networking & Backend API Conventions

- **Base URL**: Configured via build configuration or local properties.
- **Headers**:
  ```http
  Authorization: Bearer <Supabase_JWT_Token>
  Content-Type: application/json
  Accept: application/json
  ```
- **Response Format**:
  - Success response:
    ```json
    { "success": true, "data": { ... } }
    ```
  - Error response:
    ```json
    { "error": "Pesan error deskriptif" }
    ```
- **Auth Token Handling**:
  - Use an OkHttp `Interceptor` to attach the Bearer token retrieved from secure storage (`EncryptedDataStore`).
  - Handle 401 Unauthorized via `Authenticator` to trigger token refresh.

---

## 4. Third-Party Integrations Guide

### Midtrans Mobile SDK (Snap)
- Request `snap_token` from Golang endpoint `POST /api/user/orders`.
- Launch Snap flow using `MidtransSDK.getInstance().startPaymentUiFlow(activityContext, snapToken)`.
- Handle callback results (`TransactionResult.STATUS_SUCCESS`, `STATUS_PENDING`, `STATUS_FAILED`).

### Biteship Logistics
- Area search: `GET /api/biteship/areas?input={keyword}` with debounce 300ms.
- Shipping rates: `POST /api/ongkir` with destination area ID and weight.
- Realtime tracking: `POST /api/user/orders/{id}/sync-tracking`.

### Realtime Supabase & FCM Notifications
- FCM token registration: Send device token to `POST /api/user/notifications` on login.
- Deep links format: `mameko://orders/{id}` or `mameko://wallet`.

---

## 5. Supplementary References
- [API Contracts](file:///d:/Xar%20Project/mameko/.agents/skills/mameko-android-dev/references/api_contracts.md)
- [Architecture & Code Templates](file:///d:/Xar%20Project/mameko/.agents/skills/mameko-android-dev/references/architecture_guide.md)
- [Values & Database Integrity Standard](file:///d:/Xar%20Project/mameko-app/.agents/skills/mameko-values-and-database-integrity/SKILL.md)

---

## 6. Values & Database Integrity Mandate (Strict)
1. **Zero Hardcoded Strings**: All user-facing strings must reside in `res/values/strings.xml` and be consumed via `stringResource()` in Compose or `UiText` in ViewModels.
2. **Zero Static Mock Data**: All products, categories, vouchers, orders, banners, and settings must be dynamically queried from Supabase / Golang database. No in-memory dummy lists.
3. **Zero Hardcoded Spacing/Dimensions**: All padding, radii, and heights must use tokens from `Dimens.kt` (`Dimens.Spacing*`, `Dimens.ButtonHeight`, `Dimens.CardCorner`, etc.).
