package com.barreto.deliveryscanner.ui.scanner

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.barreto.deliveryscanner.data.repository.ReceiptRepository
import com.barreto.deliveryscanner.domain.model.AddressDetection
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class ScannerViewModel(
    private val repository: ReceiptRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(ScannerUiState())
    val uiState: StateFlow<ScannerUiState> = _uiState.asStateFlow()

    fun startScanning() {
        _uiState.value = ScannerUiState(scanStatus = ScanStatus.Running)
    }

    private var lastRawAddress: String? = null
    private var stableCount = 0

    fun onAddressDetected(detection: AddressDetection) {
        if (detection.addressLine == lastRawAddress) {
            stableCount++
        } else {
            lastRawAddress = detection.addressLine
            stableCount = 1
        }

        if (stableCount < 2) { // exige 2 leituras iguais
            return
        }

        _uiState.update {
            it.copy(
                scanStatus = ScanStatus.Idle,
                detection = detection,
                submissionState = SubmissionState.Idle
            )
        }
    }

    fun updateDetectedAddress(newAddress: String) {
        _uiState.update { state ->
            val current = state.detection ?: return@update state
            state.copy(detection = current.copy(addressLine = newAddress))
        }
    }

    fun submitDetectedAddress(overrideAddress: String? = null) {
        val detection = _uiState.value.detection ?: return
        val finalAddress = overrideAddress?.takeIf { it.isNotBlank() } ?: detection.addressLine
        if (finalAddress.isBlank()) return
        if (_uiState.value.submissionState is SubmissionState.Sending) return

        _uiState.update { it.copy(submissionState = SubmissionState.Sending) }

        viewModelScope.launch {
            repository.submitReceipt(
                rawText = detection.rawText,
                addressLine = finalAddress
            ).onSuccess { response ->
                _uiState.update {
                    it.copy(submissionState = SubmissionState.Success(response.message))
                }
            }.onFailure { throwable ->
                val friendlyMessage = throwable.message ?: "Erro inesperado"
                _uiState.update {
                    it.copy(submissionState = SubmissionState.Error(friendlyMessage))
                }
            }
        }
    }

    fun resetScan() {
        _uiState.value = ScannerUiState()
    }

    class Factory(
        private val repository: ReceiptRepository
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            if (modelClass.isAssignableFrom(ScannerViewModel::class.java)) {
                return ScannerViewModel(repository) as T
            }
            throw IllegalArgumentException("Unknown ViewModel class")
        }
    }
}
