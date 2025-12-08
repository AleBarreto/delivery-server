package com.barreto.deliveryscanner.data.repository

import com.barreto.deliveryscanner.data.remote.DeliveryApiClient
import com.barreto.deliveryscanner.data.remote.model.AdminLoginRequest
import com.barreto.deliveryscanner.data.remote.model.AdminLoginResponse

class AuthRepository(
    private val apiClient: DeliveryApiClient
) {

    suspend fun login(email: String, password: String): Result<AdminLoginResponse> {
        return runCatching {
            apiClient.getService().loginAdmin(AdminLoginRequest(email, password))
        }
    }

    fun currentBaseUrl(): String = apiClient.getCurrentConfig().baseUrl
}
