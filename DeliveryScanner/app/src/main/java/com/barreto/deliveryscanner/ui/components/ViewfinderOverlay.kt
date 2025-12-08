package com.barreto.deliveryscanner.ui.components

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.util.AttributeSet
import android.view.View
import androidx.core.content.ContextCompat
import com.barreto.deliveryscanner.R

class ViewfinderOverlay @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : View(context, attrs) {

    private val scrimPaint = Paint().apply {
        style = Paint.Style.FILL
        color = ContextCompat.getColor(context, R.color.overlayScrim)
    }

    private val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = dp(3f)
        color = ContextCompat.getColor(context, android.R.color.white)
    }

    private val boxRect = RectF()

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        val width = width.toFloat()
        val height = height.toFloat()
        if (width == 0f || height == 0f) return

        updateBox(width, height)

        // scrim ao redor do box central
        canvas.drawRect(0f, 0f, width, boxRect.top, scrimPaint)
        canvas.drawRect(0f, boxRect.bottom, width, height, scrimPaint)
        canvas.drawRect(0f, boxRect.top, boxRect.left, boxRect.bottom, scrimPaint)
        canvas.drawRect(boxRect.right, boxRect.top, width, boxRect.bottom, scrimPaint)

        // borda do box central (somente guia visual)
        val radius = dp(12f)
        canvas.drawRoundRect(boxRect, radius, radius, borderPaint)
    }

    private fun updateBox(width: Float, height: Float) {
        val boxWidth = width * 0.82f
        val boxHeight = height * 0.36f
        val left = (width - boxWidth) / 2f
        val top = (height - boxHeight) / 2.2f
        boxRect.set(left, top, left + boxWidth, top + boxHeight)
    }

    // Mantido só pra não quebrar chamadas existentes, mas não faz nada visual
    fun setHighlight(rect: RectF?) {
        // no-op: não desenhamos mais highlight
        invalidate()
    }

    private fun dp(value: Float): Float =
        value * resources.displayMetrics.density
}
