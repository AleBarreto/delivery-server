package com.barreto.deliveryscanner.data.remote

import com.barreto.deliveryscanner.data.remote.model.AddressSubmissionRequest
import com.barreto.deliveryscanner.data.remote.model.AddressSubmissionResponse
import com.barreto.deliveryscanner.data.remote.model.AdminLoginRequest
import com.barreto.deliveryscanner.data.remote.model.AdminLoginResponse
import com.barreto.deliveryscanner.data.remote.model.OrderResponse
import retrofit2.http.Body
import retrofit2.http.POST

interface DeliveryApiService {
    @POST("auth/admin/login")
    suspend fun loginAdmin(@Body payload: AdminLoginRequest): AdminLoginResponse

    @POST("orders")
    suspend fun createOrder(
        @Body payload: AddressSubmissionRequest
    ): OrderResponse
}
