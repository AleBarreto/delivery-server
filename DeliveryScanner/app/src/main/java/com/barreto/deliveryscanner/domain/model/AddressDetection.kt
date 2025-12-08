package com.barreto.deliveryscanner.domain.model

import android.graphics.RectF

data class AddressDetection(
    val addressLine: String,
    val rawText: String,
    val boundingBoxPreview: RectF? = null,
    val boundingBoxNormalized: RectF? = null,
    val imageWidth: Int = 0,
    val imageHeight: Int = 0
)
