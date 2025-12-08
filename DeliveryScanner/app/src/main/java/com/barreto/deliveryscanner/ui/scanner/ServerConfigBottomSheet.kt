package com.barreto.deliveryscanner.ui.scanner

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import com.barreto.deliveryscanner.databinding.BottomsheetServerConfigBinding
import com.barreto.deliveryscanner.di.ServiceLocator
import com.google.android.material.bottomsheet.BottomSheetDialogFragment

class ServerConfigBottomSheet : BottomSheetDialogFragment() {

    private var _binding: BottomsheetServerConfigBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = BottomsheetServerConfigBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val config = ServiceLocator.getApiConfig()
        binding.baseUrlInput.setText(config.baseUrl)
        binding.tokenInput.setText(config.token)

        binding.saveButton.setOnClickListener {
            val baseUrl = binding.baseUrlInput.text?.toString()?.trim().orEmpty()
            val token = binding.tokenInput.text?.toString()?.trim().orEmpty()
            if (baseUrl.isEmpty()) {
                binding.baseUrlInputLayout.error = "Informe a URL do servidor"
                return@setOnClickListener
            }
            binding.baseUrlInputLayout.error = null
            ServiceLocator.updateBaseUrl(baseUrl)
            ServiceLocator.updateToken(token)
            Toast.makeText(requireContext(), "Configuração salva.", Toast.LENGTH_SHORT).show()
            dismiss()
        }
    }

    override fun onDestroyView() {
        _binding = null
        super.onDestroyView()
    }

    companion object {
        const val TAG = "ServerConfigBottomSheet"
    }
}
