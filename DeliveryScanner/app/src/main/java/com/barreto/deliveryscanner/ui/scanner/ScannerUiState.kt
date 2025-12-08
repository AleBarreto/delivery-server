package com.barreto.deliveryscanner.ui.scanner

import com.barreto.deliveryscanner.domain.model.AddressDetection

data class ScannerUiState(
    val scanStatus: ScanStatus = ScanStatus.Idle,
    val detection: AddressDetection? = null,
    val submissionState: SubmissionState = SubmissionState.Idle
)

sealed interface ScanStatus {
    data object Idle : ScanStatus
    data object Running : ScanStatus
}

sealed interface SubmissionState {
    data object Idle : SubmissionState
    data object Sending : SubmissionState
    data class Success(val message: String?) : SubmissionState
    data class Error(val errorMessage: String) : SubmissionState
}
