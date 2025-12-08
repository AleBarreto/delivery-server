package com.barreto.deliveryscanner.data.remote.model

data class OrderResponse(
    val id: String,
    val address: String,
    val lat: Double?,
    val lng: Double?,
    val status: String?
)
