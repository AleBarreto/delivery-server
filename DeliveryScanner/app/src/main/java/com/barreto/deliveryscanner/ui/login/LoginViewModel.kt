package com.barreto.deliveryscanner.ui.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.barreto.deliveryscanner.data.repository.AuthRepository
import com.barreto.deliveryscanner.di.ServiceLocator
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class LoginViewModel(
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    fun login(email: String, password: String) {
        if (email.isBlank() || password.isBlank()) {
            _uiState.value = LoginUiState(error = "Informe e-mail e senha.")
            return
        }

        _uiState.update { it.copy(loading = true, error = null, success = false) }

        viewModelScope.launch {
            authRepository.login(email.trim(), password)
                .onSuccess { response ->
                    ServiceLocator.updateToken(response.token)
                    _uiState.value = LoginUiState(success = true)
                }
                .onFailure { throwable ->
                    val message = throwable.message ?: "Falha ao entrar."
                    _uiState.value = LoginUiState(error = message)
                }
        }
    }

    fun consumeSuccess() {
        _uiState.update { it.copy(success = false) }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }

    class Factory(
        private val repository: AuthRepository
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            if (modelClass.isAssignableFrom(LoginViewModel::class.java)) {
                return LoginViewModel(repository) as T
            }
            throw IllegalArgumentException("Unknown ViewModel class")
        }
    }
}
