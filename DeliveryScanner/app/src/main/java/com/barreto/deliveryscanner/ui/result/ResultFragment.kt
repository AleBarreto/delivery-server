package com.barreto.deliveryscanner.ui.result

import android.os.Bundle
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.view.isVisible
import androidx.core.widget.addTextChangedListener
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.navigation.fragment.findNavController
import com.barreto.deliveryscanner.R
import com.barreto.deliveryscanner.databinding.FragmentResultBinding
import com.barreto.deliveryscanner.di.ServiceLocator
import com.barreto.deliveryscanner.ui.scanner.ScanStatus
import com.barreto.deliveryscanner.ui.scanner.ScannerViewModel
import com.barreto.deliveryscanner.ui.scanner.SubmissionState
import kotlinx.coroutines.launch

class ResultFragment : Fragment() {

    private var _binding: FragmentResultBinding? = null
    private val binding get() = _binding!!

    private val viewModel: ScannerViewModel by activityViewModels {
        ScannerViewModel.Factory(ServiceLocator.receiptRepository)
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentResultBinding.inflate(inflater, container, false)
        return binding.root
    }

    private var suppressTextWatcher = false
    private var addressWatcher: TextWatcher? = null

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.rescanButton.setOnClickListener {
            viewModel.resetScan()
            findNavController().popBackStack(R.id.scannerFragment, false)
        }

        binding.sendButton.setOnClickListener {
            val currentText = binding.addressInput.text?.toString()
            viewModel.submitDetectedAddress(currentText)
        }

        addressWatcher = binding.addressInput.addTextChangedListener { editable ->
            if (suppressTextWatcher) return@addTextChangedListener
            val text = editable?.toString().orEmpty()
            viewModel.updateDetectedAddress(text)
        }

        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.uiState.collect { state ->
                    val detection = state.detection
                    suppressTextWatcher = true
                    if (detection != null) {
                        if (binding.addressInput.text?.toString() != detection.addressLine) {
                            binding.addressInput.setText(detection.addressLine)
                            binding.addressInput.setSelection(detection.addressLine.length)
                        }
                    } else {
                        binding.addressInput.setText("")
                    }
                    suppressTextWatcher = false

                    binding.addressInputLayout.error = when (val submission = state.submissionState) {
                        is SubmissionState.Error -> submission.errorMessage
                        else -> null
                    }

                    val statusText = when (val submission = state.submissionState) {
                        is SubmissionState.Sending -> getString(R.string.status_sending)
                        is SubmissionState.Success -> submission.message ?: getString(R.string.status_success)
                        is SubmissionState.Error -> submission.errorMessage
                        else -> getString(R.string.status_detected)
                    }

                    binding.statusText.text = statusText
                    binding.addressCard.isVisible = detection != null

                    val isSending = state.submissionState is SubmissionState.Sending
                    binding.sendProgress.isVisible = isSending
                    binding.sendButton.isEnabled = detection != null && !isSending && detection.addressLine.isNotBlank()

                    if (detection == null && state.scanStatus is ScanStatus.Idle) {
                        findNavController().popBackStack()
                    }
                }
            }
        }
    }

    override fun onDestroyView() {
        addressWatcher?.let { binding.addressInput.removeTextChangedListener(it) }
        addressWatcher = null
        _binding = null
        super.onDestroyView()
    }
}
