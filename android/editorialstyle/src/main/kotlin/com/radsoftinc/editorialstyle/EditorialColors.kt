package com.radsoftinc.editorialstyle

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color

// values follow client/src/app/globals.css, dark default + light
@Immutable
data class EditorialColors(
    val brand: Color,
    val brandLight: Color,
    val brandDark: Color,

    val background: Color,
    val surfaceElevated: Color,
    val surfaceCard: Color,
    val surfaceHover: Color,

    val textPrimary: Color,
    val textSecondary: Color,
    val textMuted: Color,
    val textFaint: Color,

    val borderSubtle: Color,
    val borderDefault: Color,
    val borderStrong: Color,
    val borderAccent: Color,

    val pressOverlay: Color,

    val success: Color = Color(0xFF6BDB9E),
    val warning: Color = Color(0xFFFAC966),
    val error: Color = Color(0xFFF77575),
) {
    companion object {
        private val ink = Color(0xFF0A1A28)
        private val moon = Color(0xFFEDF6FC)

        // the web's text alphas are too thin at arm's length on a phone, so each step is weighted up
        val Dark = EditorialColors(
            brand = Color(0xFF00A6FB),
            brandLight = Color(0xFF33BBFF),
            brandDark = Color(0xFF0088D1),
            background = Color(0xFF030D14),
            surfaceElevated = Color(0xFF071E2E),
            surfaceCard = Color(0xFF0A2A3F),
            surfaceHover = Color(0xFF0D3350),
            textPrimary = moon,
            textSecondary = moon.copy(alpha = 0.74f),
            textMuted = moon.copy(alpha = 0.60f),
            textFaint = moon.copy(alpha = 0.44f),
            borderSubtle = moon.copy(alpha = 0.12f),
            borderDefault = moon.copy(alpha = 0.20f),
            borderStrong = moon.copy(alpha = 0.30f),
            borderAccent = Color(0xFF00A6FB).copy(alpha = 0.35f),
            pressOverlay = moon.copy(alpha = 0.04f),
        )

        val Light = EditorialColors(
            brand = Color(0xFF0088D1),
            brandLight = Color(0xFF00A6FB),
            brandDark = Color(0xFF006FAB),
            background = Color(0xFFF8FBFD),
            surfaceElevated = Color(0xFFFFFFFF),
            surfaceCard = Color(0xFFF0F5F9),
            surfaceHover = Color(0xFFE4ECF2),
            textPrimary = ink,
            textSecondary = ink.copy(alpha = 0.78f),
            textMuted = ink.copy(alpha = 0.64f),
            textFaint = ink.copy(alpha = 0.46f),
            borderSubtle = ink.copy(alpha = 0.14f),
            borderDefault = ink.copy(alpha = 0.24f),
            borderStrong = ink.copy(alpha = 0.36f),
            borderAccent = Color(0xFF0088D1).copy(alpha = 0.35f),
            pressOverlay = ink.copy(alpha = 0.04f),
        )
    }
}
