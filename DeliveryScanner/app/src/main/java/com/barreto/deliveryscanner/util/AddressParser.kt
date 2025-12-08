package com.barreto.deliveryscanner.util

import android.graphics.Matrix
import android.graphics.Rect
import android.graphics.RectF
import com.barreto.deliveryscanner.domain.model.AddressDetection
import com.google.mlkit.vision.text.Text
import java.text.Normalizer

object AddressParser {

    private val streetKeywords = listOf("end", "end.", "endereco", "endereço", "rua", "r.", "avenida", "av", "av.", "logradouro")
    private val numberKeywords = listOf("núm", "num", "nº", "numero", "número", "n")
    private val neighborhoodKeywords = listOf("bairro", "bairr")

    private val streetPattern = buildPrefixPattern(streetKeywords)
    private val numberPattern = buildPrefixPattern(numberKeywords)
    private val neighborhoodPattern = buildPrefixPattern(neighborhoodKeywords)
    private val inlineNumberPattern = Regex("(?i)(?:n[úu]m\\.?|nº|numero|número|n)[\\s\\.:\\-]*([0-9]{1,5})")

    fun extractDetection(
        result: Text,
        sourceWidth: Int,
        sourceHeight: Int,
        rotationDegrees: Int
    ): AddressDetection? {
        val raw = result.text.trim()
        if (raw.isEmpty()) return null

        val lines = result.textBlocks.flatMap { block ->
            block.lines.map { line ->
                DetectedLine(
                    rawText = line.text.trim(),
                    normalized = normalize(line.text),
                    boundingBox = line.boundingBox
                )
            }
        }.filter { it.rawText.length > 2 }

        if (lines.isEmpty()) return null

        val matches = collectMatches(lines)
        val street = matches[FieldType.STREET]
        val number = matches[FieldType.NUMBER]
        val neighborhood = matches[FieldType.NEIGHBORHOOD]

        if (street == null || number == null || neighborhood == null) {
            return null
        }

        val addressLine = "${street.value}, ${number.value} - ${neighborhood.value}"
        val bounding = mergeRects(listOfNotNull(street.boundingBox, number.boundingBox, neighborhood.boundingBox))
            ?: return null

        val normalizedRect = normalizeRect(bounding, sourceWidth, sourceHeight, rotationDegrees) ?: return null
        val rotatedWidth = if (rotationDegrees % 180 == 0) sourceWidth else sourceHeight
        val rotatedHeight = if (rotationDegrees % 180 == 0) sourceHeight else sourceWidth

        return AddressDetection(
            addressLine = addressLine,
            rawText = raw,
            boundingBoxPreview = null,
            boundingBoxNormalized = normalizedRect,
            imageWidth = rotatedWidth,
            imageHeight = rotatedHeight
        )
    }

    private fun collectMatches(lines: List<DetectedLine>): Map<FieldType, FieldMatch> {
        val matches = mutableMapOf<FieldType, FieldMatch>()

        lines.forEach { line ->
            if (FieldType.STREET !in matches) {
                matchLine(line, streetPattern)?.let { matches[FieldType.STREET] = it }
            }
            if (FieldType.NUMBER !in matches) {
                matchNumber(line)?.let { matches[FieldType.NUMBER] = it }
            }
            if (FieldType.NEIGHBORHOOD !in matches) {
                matchLine(line, neighborhoodPattern)?.let { matches[FieldType.NEIGHBORHOOD] = it }
            }
        }

        return matches
    }

    private fun matchLine(line: DetectedLine, pattern: Regex): FieldMatch? {
        val match = pattern.find(line.normalized)
        val prefixLength = match?.groups?.get(1)?.range?.let { it.last + 1 } ?: return null
        val startIndex = prefixLength.coerceAtMost(line.rawText.length)
        val value = line.rawText
            .substring(startIndex)
            .trimStart(':', '-', '.', ' ')
            .trim()
        if (value.isEmpty()) return null
        return FieldMatch(value, line.boundingBox)
    }

    private fun matchNumber(line: DetectedLine): FieldMatch? {
        val prefixed = matchLine(line, numberPattern)
        if (prefixed != null) {
            val digits = prefixed.value.filter(Char::isDigit)
            if (digits.isNotEmpty()) {
                return prefixed.copy(value = digits)
            }
        }

        val inline = inlineNumberPattern.find(line.rawText)
        val digits = inline?.groupValues?.getOrNull(1)?.filter(Char::isDigit)
        return digits?.takeIf { it.isNotEmpty() }?.let { FieldMatch(it, line.boundingBox) }
    }

    private fun mergeRects(rects: List<Rect>): Rect? {
        if (rects.isEmpty()) return null
        return Rect(
            rects.minOf { it.left },
            rects.minOf { it.top },
            rects.maxOf { it.right },
            rects.maxOf { it.bottom }
        )
    }

    private fun normalizeRect(rect: Rect, sourceWidth: Int, sourceHeight: Int, rotationDegrees: Int): RectF? {
        if (sourceWidth <= 0 || sourceHeight <= 0) return null

        val width = sourceWidth.toFloat()
        val height = sourceHeight.toFloat()

        val normalized = RectF(
            rect.left / width,
            rect.top / height,
            rect.right / width,
            rect.bottom / height
        )

        val degrees = (rotationDegrees % 360 + 360) % 360
        if (degrees == 0) return normalized

        val matrix = Matrix().apply {
            setRotate(degrees.toFloat(), 0.5f, 0.5f)
        }
        val points = floatArrayOf(normalized.left, normalized.top, normalized.right, normalized.bottom)
        matrix.mapPoints(points)
        val left = minOf(points[0], points[2]).coerceIn(0f, 1f)
        val top = minOf(points[1], points[3]).coerceIn(0f, 1f)
        val right = maxOf(points[0], points[2]).coerceIn(0f, 1f)
        val bottom = maxOf(points[1], points[3]).coerceIn(0f, 1f)
        return RectF(left, top, right, bottom)
    }

    private fun buildPrefixPattern(keywords: List<String>): Regex {
        val escaped = keywords.joinToString("|") { Regex.escape(removeDiacritics(it.lowercase())) }
        return Regex("^\\s*((?:$escaped))[\\s\\.:\\-]*", RegexOption.IGNORE_CASE)
    }

    private fun normalize(text: String): String {
        return removeDiacritics(text.trim().lowercase())
    }

    private fun removeDiacritics(value: String): String {
        val normalized = Normalizer.normalize(value, Normalizer.Form.NFD)
        return normalized.replace("\\p{Mn}+".toRegex(), "")
    }

    private data class DetectedLine(
        val rawText: String,
        val normalized: String,
        val boundingBox: Rect?
    )

    private data class FieldMatch(
        val value: String,
        val boundingBox: Rect?
    )

    private enum class FieldType { STREET, NUMBER, NEIGHBORHOOD }
}
