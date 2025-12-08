package com.barreto.deliveryscanner.ui.login

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.navigation.fragment.findNavController
import com.barreto.deliveryscanner.R
import com.barreto.deliveryscanner.databinding.FragmentLoginBinding
import com.barreto.deliveryscanner.di.ServiceLocator
import com.barreto.deliveryscanner.ui.scanner.ServerConfigBottomSheet
import kotlinx.coroutines.launch

class LoginFragment : Fragment() {

    private var _binding: FragmentLoginBinding? = null
    private val binding get() = _binding!!

    private val viewModel: LoginViewModel by viewModels {
        LoginViewModel.Factory(ServiceLocator.authRepository)
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentLoginBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        if (ServiceLocator.getApiConfig().token.isNotBlank()) {
            findNavController().navigate(R.id.action_loginFragment_to_scannerFragment)
            return
        }

        binding.loginButton.setOnClickListener {
            val email = binding.emailInput.text?.toString().orEmpty()
            val password = binding.passwordInput.text?.toString().orEmpty()
            binding.passwordInputLayout.error = null
            viewModel.login(email, password)
        }

        binding.configLink.setOnClickListener {
            ServerConfigBottomSheet().show(parentFragmentManager, ServerConfigBottomSheet.TAG)
        }

        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.uiState.collect { state ->
                    binding.loadingIndicator.isVisible = state.loading
                    binding.loginButton.isEnabled = !state.loading
                    state.error?.let {
                        binding.passwordInputLayout.error = it
                        Toast.makeText(requireContext(), it, Toast.LENGTH_SHORT).show()
                        viewModel.clearError()
                    }
                    if (state.success) {
                        viewModel.consumeSuccess()
                        findNavController().navigate(R.id.action_loginFragment_to_scannerFragment)
                    }
                }
            }
        }
    }

    override fun onDestroyView() {
        _binding = null
        super.onDestroyView()
    }
}
