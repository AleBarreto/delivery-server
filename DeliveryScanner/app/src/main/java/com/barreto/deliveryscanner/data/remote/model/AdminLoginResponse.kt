package com.barreto.deliveryscanner.data.remote.model

data class AdminLoginResponse(
    val token: String,
    val admin: AdminInfo?
) {
    data class AdminInfo(
        val id: String?,
        val name: String?,
        val email: String?
    )
}
