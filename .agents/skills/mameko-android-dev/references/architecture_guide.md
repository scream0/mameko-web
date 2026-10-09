# Mameko Clean Architecture & Jetpack Compose Guide

This reference outlines code patterns and boilerplate structures for the 3-layer architecture used across all features in Mameko Android.

---

## 1. Domain Layer Boilerplate

### Domain Model:
```kotlin
package com.mameko.domain.model

data class Wallet(
    val balance: Double,
    val transactions: List<WalletTransaction>
)

data class WalletTransaction(
    val id: String,
    val type: String, // "credit" or "debit"
    val amount: Double,
    val description: String,
    val status: String,
    val createdAt: String
)
```

### Repository Interface:
```kotlin
package com.mameko.domain.repository

import com.mameko.domain.model.Wallet
import kotlinx.coroutines.flow.Flow

interface WalletRepository {
    fun getWallet(): Flow<Result<Wallet>>
    suspend fun requestWithdrawal(amount: Double, bankName: String, accountNumber: String, accountHolder: String): Result<Unit>
}
```

### Use Case:
```kotlin
package com.mameko.domain.usecase

import com.mameko.domain.model.Wallet
import com.mameko.domain.repository.WalletRepository
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class GetWalletUseCase @Inject constructor(
    private val repository: WalletRepository
) {
    operator fun invoke(): Flow<Result<Wallet>> = repository.getWallet()
}
```

---

## 2. Presentation Layer Boilerplate (MVI / MVVM)

### UI State:
```kotlin
package com.mameko.presentation.wallet

import com.mameko.domain.model.Wallet

data class WalletUiState(
    val isLoading: Boolean = false,
    val wallet: Wallet? = null,
    val errorMessage: String? = null
)
```

### UI Event:
```kotlin
package com.mameko.presentation.wallet

sealed interface WalletUiEvent {
    data object Refresh : WalletUiEvent
    data class SubmitWithdrawal(val amount: Double) : WalletUiEvent
    data object DismissError : WalletUiEvent
}
```

### ViewModel:
```kotlin
package com.mameko.presentation.wallet

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mameko.domain.usecase.GetWalletUseCase
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

class WalletViewModel @Inject constructor(
    private val getWalletUseCase: GetWalletUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(WalletUiState())
    val uiState = _uiState.asStateFlow()

    init {
        loadWallet()
    }

    fun onEvent(event: WalletUiEvent) {
        when (event) {
            is WalletUiEvent.Refresh -> loadWallet()
            is WalletUiEvent.DismissError -> _uiState.update { it.copy(errorMessage = null) }
            is WalletUiEvent.SubmitWithdrawal -> { /* Handle withdrawal */ }
        }
    }

    private fun loadWallet() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            getWalletUseCase().collect { result ->
                result.fold(
                    onSuccess = { wallet ->
                        _uiState.update { it.copy(isLoading = false, wallet = wallet, errorMessage = null) }
                    },
                    onFailure = { error ->
                        _uiState.update { it.copy(isLoading = false, errorMessage = error.localizedMessage) }
                    }
                )
            }
        }
    }
}
```

---

## 3. Compose Screen Pattern

```kotlin
@Composable
fun WalletScreen(
    viewModel: WalletViewModel,
    onNavigateToBankSettings: () -> Unit
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(title = { Text("Dompet Digital") })
        }
    ) { paddingValues ->
        Box(modifier = Modifier.fillMaxSize().padding(paddingValues)) {
            when {
                state.isLoading -> CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                state.errorMessage != null -> Text(text = state.errorMessage!!, color = MaterialTheme.colorScheme.error)
                state.wallet != null -> WalletContent(wallet = state.wallet!!, onEvent = viewModel::onEvent)
            }
        }
    }
}
```
