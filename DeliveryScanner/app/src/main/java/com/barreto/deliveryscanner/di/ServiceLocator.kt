package com.barreto.deliveryscanner.di

import android.content.Context
import com.barreto.deliveryscanner.data.preferences.ApiPreferences
import com.barreto.deliveryscanner.data.remote.DeliveryApiClient
import com.barreto.deliveryscanner.data.repository.AuthRepository
import com.barreto.deliveryscanner.data.repository.ReceiptRepository

object ServiceLocator {
    private var initialized = false
    private lateinit var apiPreferences: ApiPreferences
    private val apiClient: DeliveryApiClient by lazy {
        checkInitialization()
        DeliveryApiClient(apiPreferences)
    }

    val receiptRepository: ReceiptRepository by lazy { ReceiptRepository(apiClient) }
    val authRepository: AuthRepository by lazy { AuthRepository(apiClient) }

    fun initialize(context: Context) {
        if (!initialized) {
            apiPreferences = ApiPreferences(context.applicationContext)
            initialized = true
        }
    }

    fun getApiConfig() = run {
        checkInitialization()
        apiPreferences.getConfig()
    }

    fun updateBaseUrl(baseUrl: String) {
        checkInitialization()
        apiPreferences.updateBaseUrl(baseUrl)
        apiClient.invalidateService()
    }

    fun updateToken(token: String) {
        checkInitialization()
        apiPreferences.updateToken(token)
    }

    private fun checkInitialization() {
        check(initialized) { "ServiceLocator.initialize(context) must be called before usage." }
    }
}
