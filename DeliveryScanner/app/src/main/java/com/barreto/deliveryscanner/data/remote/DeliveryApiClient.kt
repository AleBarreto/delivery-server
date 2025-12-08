package com.barreto.deliveryscanner.data.remote

import com.barreto.deliveryscanner.data.preferences.ApiPreferences
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.atomic.AtomicReference

class DeliveryApiClient(
    private val preferences: ApiPreferences
) {

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BODY
    }

    private val authInterceptor = Interceptor { chain ->
        val original = chain.request()
        val builder = original.newBuilder()
            .header("Accept", "application/json")

        val token = preferences.getConfig().token
        if (token.isNotBlank()) {
            builder.header("Authorization", "Bearer $token")
        }

        chain.proceed(builder.build())
    }

    private val httpClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .addInterceptor(loggingInterceptor)
            .addInterceptor(authInterceptor)
            .build()
    }

    private val retrofitRef = AtomicReference<Retrofit?>()
    private val serviceRef = AtomicReference<DeliveryApiService?>()
    private val currentBaseUrl = AtomicReference<String?>(null)

    fun getService(): DeliveryApiService {
        val config = preferences.getConfig()
        if (serviceRef.get() == null || currentBaseUrl.get() != config.baseUrl) {
            synchronized(this) {
                if (serviceRef.get() == null || currentBaseUrl.get() != config.baseUrl) {
                    val retrofit = Retrofit.Builder()
                        .baseUrl(config.baseUrl)
                        .client(httpClient)
                        .addConverterFactory(GsonConverterFactory.create())
                        .build()
                    retrofitRef.set(retrofit)
                    currentBaseUrl.set(config.baseUrl)
                    serviceRef.set(retrofit.create(DeliveryApiService::class.java))
                }
            }
        }
        return serviceRef.get()!!
    }

    fun invalidateService() {
        synchronized(this) {
            retrofitRef.set(null)
            serviceRef.set(null)
            currentBaseUrl.set(null)
        }
    }

    fun getCurrentConfig() = preferences.getConfig()
}
