package com.barreto.deliveryscanner.ui.login

data class LoginUiState(
    val loading: Boolean = false,
    val error: String? = null,
    val success: Boolean = false
)
