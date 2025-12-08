package com.barreto.deliveryscanner.ui.scanner

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.view.CameraController
import androidx.camera.view.LifecycleCameraController
import androidx.core.content.ContextCompat
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.navigation.fragment.findNavController
import com.barreto.deliveryscanner.R
import com.barreto.deliveryscanner.databinding.FragmentScannerBinding
import com.barreto.deliveryscanner.di.ServiceLocator
import com.barreto.deliveryscanner.util.AddressParser
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.launch
import java.util.concurrent.Executors

class ScannerFragment : Fragment() {

    private var _binding: FragmentScannerBinding? = null
    private val binding get() = _binding!!

    private val viewModel: ScannerViewModel by activityViewModels {
        ScannerViewModel.Factory(ServiceLocator.receiptRepository)
    }

    private var textRecognizer: TextRecognizer? = null
    private var cameraController: LifecycleCameraController? = null
    private val cameraExecutor = Executors.newSingleThreadExecutor()

    private val permissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) startCamera() else showPermissionRationale()
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        textRecognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentScannerBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.scanButton.setOnClickListener {
            val detection = viewModel.uiState.value.detection
            if (detection != null) {
                navigateToResult()
            } else {
                checkPermissionAndStart()
            }
        }

        binding.settingsButton.setOnClickListener {
            ServerConfigBottomSheet().show(parentFragmentManager, ServerConfigBottomSheet.TAG)
        }

        checkAuthentication()

        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.uiState.collect { state ->
                    renderState(state)
                }
            }
        }
    }

    override fun onDestroyView() {
        cameraController?.clearImageAnalysisAnalyzer()
        binding.previewView.controller = null
        _binding = null
        super.onDestroyView()
    }

    override fun onDestroy() {
        textRecognizer?.close()
        cameraExecutor.shutdown()
        super.onDestroy()
    }

    override fun onResume() {
        super.onResume()
        checkAuthentication()
    }

    private fun checkAuthentication() {
        if (ServiceLocator.getApiConfig().token.isBlank()) {
            findNavController().navigate(R.id.action_scannerFragment_to_loginFragment)
        }
    }

    // ---------------- UI ----------------

    private fun renderState(state: ScannerUiState) {
        val detection = state.detection
        val isDetecting = state.scanStatus is ScanStatus.Running && detection == null

        binding.statusProgress.isVisible = isDetecting
        binding.statusText.text = when {
            detection != null -> getString(R.string.status_detected)
            isDetecting -> getString(R.string.status_detecting)
            else -> getString(R.string.scan_hint)
        }

        binding.scanButton.apply {
            text = when {
                detection != null -> getString(R.string.confirm_cta)
                isDetecting -> getString(R.string.status_detecting)
                else -> getString(R.string.scan_cta)
            }
            isEnabled = true
        }

        binding.viewfinderOverlay.setHighlight(null)

        binding.detectedAddressLabel.isVisible = detection != null
        binding.detectedAddressText.isVisible = detection != null
        binding.detectedAddressText.text = detection?.addressLine
        binding.instructionsText.isVisible = detection == null

        if (detection != null) {
            stopCamera()
        }
    }

    // ------------- Permissão -------------

    private fun checkPermissionAndStart() {
        when {
            ContextCompat.checkSelfPermission(
                requireContext(),
                Manifest.permission.CAMERA
            ) == PackageManager.PERMISSION_GRANTED -> startCamera()

            shouldShowRequestPermissionRationale(Manifest.permission.CAMERA) -> showPermissionRationale()

            else -> permissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    private fun showPermissionRationale() {
        Toast.makeText(
            requireContext(),
            R.string.camera_permission_rationale,
            Toast.LENGTH_LONG
        ).show()

        val intent = Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.fromParts("package", requireContext().packageName, null)
        )
        startActivity(intent)
    }

    // -------------- CameraX --------------

    private fun startCamera() {
        if (cameraController != null) {
            binding.previewView.controller = cameraController
            return
        }

        val controller = LifecycleCameraController(requireContext()).apply {
            cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA
            setEnabledUseCases(CameraController.IMAGE_ANALYSIS)

            setImageAnalysisAnalyzer(
                cameraExecutor,
                ImageAnalysis.Analyzer { imageProxy -> processImage(imageProxy) }
            )

            bindToLifecycle(viewLifecycleOwner)
        }

        cameraController = controller
        binding.previewView.controller = controller
        viewModel.startScanning()
    }

    private fun stopCamera() {
        cameraController?.clearImageAnalysisAnalyzer()
        cameraController = null
        binding.previewView.controller = null
    }

    // --------- OCR + mapeamento ---------

    private var lastOcrTimestamp = 0L

    @OptIn(ExperimentalGetImage::class)
    private fun processImage(imageProxy: ImageProxy) {
        if (viewModel.uiState.value.detection != null) {
            imageProxy.close()
            return
        }

        val now = System.currentTimeMillis()
        if (now - lastOcrTimestamp < 500) { // só processa 2x por segundo
            imageProxy.close()
            return
        }
        lastOcrTimestamp = now

        val mediaImage = imageProxy.image ?: run {
            imageProxy.close(); return
        }

        val recognizer = textRecognizer ?: run {
            imageProxy.close(); return
        }

        val rotation = imageProxy.imageInfo.rotationDegrees
        val inputImage = InputImage.fromMediaImage(mediaImage, rotation)

        recognizer.process(inputImage)
            .addOnSuccessListener { visionText ->
                val detection = AddressParser.extractDetection(
                    visionText,
                    mediaImage.width,
                    mediaImage.height,
                    rotation
                )
                if (detection != null) {
                    viewModel.onAddressDetected(detection)
                }
            }
            .addOnFailureListener {
                // best effort
            }
            .addOnCompleteListener {
                imageProxy.close()
            }
    }

    private fun navigateToResult() {
        findNavController().navigate(R.id.action_scannerFragment_to_resultFragment)
    }
}
