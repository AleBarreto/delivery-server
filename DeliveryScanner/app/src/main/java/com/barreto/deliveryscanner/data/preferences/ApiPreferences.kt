package com.barreto.deliveryscanner.data.preferences

import android.content.Context
import com.barreto.deliveryscanner.BuildConfig

data class ApiConfig(
    val baseUrl: String,
    val token: String
)

class ApiPreferences(context: Context) {
    private val preferences = context.getSharedPreferences("delivery_api_prefs", Context.MODE_PRIVATE)

    fun getConfig(): ApiConfig {
        val defaultUrl = BuildConfig.API_BASE_URL
        val defaultToken = BuildConfig.API_TOKEN
        val baseUrl = preferences.getString(KEY_BASE_URL, defaultUrl)?.takeIf { it.isNotBlank() } ?: defaultUrl
        val token = preferences.getString(KEY_TOKEN, defaultToken)?.takeIf { it.isNotBlank() } ?: defaultToken
        return ApiConfig(baseUrl = ensureTrailingSlash(baseUrl), token = token)
    }

    fun updateBaseUrl(baseUrl: String) {
        preferences.edit()
            .putString(KEY_BASE_URL, ensureTrailingSlash(baseUrl))
            .apply()
    }

    fun updateToken(token: String) {
        preferences.edit()
            .putString(KEY_TOKEN, token)
            .apply()
    }

    private fun ensureTrailingSlash(url: String): String {
        val trimmed = url.trim()
        return if (trimmed.endsWith("/")) trimmed else "$trimmed/"
    }

    companion object {
        private const val KEY_BASE_URL = "base_url"
        private const val KEY_TOKEN = "api_token"
    }
}
