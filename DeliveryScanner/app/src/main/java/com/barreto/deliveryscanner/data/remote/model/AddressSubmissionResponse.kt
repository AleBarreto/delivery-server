package com.barreto.deliveryscanner.data.remote.model

data class AddressSubmissionResponse(
    val success: Boolean = false,
    val message: String? = null,
    val receiptId: String? = null
)
