package com.barreto.deliveryscanner

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.barreto.deliveryscanner.databinding.ActivityMainBinding
import com.barreto.deliveryscanner.di.ServiceLocator

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ServiceLocator.initialize(applicationContext)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
    }
}
