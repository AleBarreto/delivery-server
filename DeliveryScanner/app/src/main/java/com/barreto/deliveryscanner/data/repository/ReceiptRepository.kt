package com.barreto.deliveryscanner.data.repository

import com.barreto.deliveryscanner.data.remote.DeliveryApiClient
import com.barreto.deliveryscanner.data.remote.model.AddressSubmissionRequest
import com.barreto.deliveryscanner.data.remote.model.AddressSubmissionResponse

class ReceiptRepository(
    private val apiClient: DeliveryApiClient
) {
    suspend fun submitReceipt(rawText: String, addressLine: String): Result<AddressSubmissionResponse> {
        return runCatching {
            val order = apiClient.getService().createOrder(
                AddressSubmissionRequest(
                    rawText = rawText,
                    addressLine = addressLine
                )
            )
            AddressSubmissionResponse(
                success = true,
                message = "Pedido criado",
                receiptId = order.id
            )
        }
    }
}
