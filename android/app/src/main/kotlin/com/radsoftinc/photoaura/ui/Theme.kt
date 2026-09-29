package com.radsoftinc.photoaura.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.radsoftinc.photoaura.R

// values mirror client/src/app/globals.css and the iOS EditorialColors, light and dark
@Immutable
data class AuraColors(
    val brand: Color,
    val background: Color,
    val surfaceElevated: Color,
    val surfaceCard: Color,
    val textPrimary: Color,
    val textSecondary: Color,
    val textMuted: Color,
    val textFaint: Color,
    val borderSubtle: Color,
    val borderDefault: Color,
    val error: Color = Color(0xFFF77575),
    val success: Color = Color(0xFF6BDB9E),
)

private val ink = Color(0xFF0A1A28)
private val moon = Color(0xFFEDF6FC)

val DarkAura = AuraColors(
    brand = Color(0xFF00A6FB),
    background = Color(0xFF030D14),
    surfaceElevated = Color(0xFF071E2E),
    surfaceCard = Color(0xFF0A2A3F),
    textPrimary = moon,
    textSecondary = moon.copy(alpha = 0.74f),
    textMuted = moon.copy(alpha = 0.60f),
    textFaint = moon.copy(alpha = 0.44f),
    borderSubtle = moon.copy(alpha = 0.12f),
    borderDefault = moon.copy(alpha = 0.20f),
)

val LightAura = AuraColors(
    brand = Color(0xFF0088D1),
    background = Color(0xFFF8FBFD),
    surfaceElevated = Color(0xFFFFFFFF),
    surfaceCard = Color(0xFFF0F5F9),
    textPrimary = ink,
    textSecondary = ink.copy(alpha = 0.78f),
    textMuted = ink.copy(alpha = 0.64f),
    textFaint = ink.copy(alpha = 0.46f),
    borderSubtle = ink.copy(alpha = 0.14f),
    borderDefault = ink.copy(alpha = 0.24f),
)

val LocalAura = staticCompositionLocalOf { DarkAura }

object Fonts {
    val serif = FontFamily(Font(R.font.dm_serif))

    private fun outfit(w: Int) = Font(
        R.font.outfit,
        weight = FontWeight(w),
        variationSettings = FontVariation.Settings(FontVariation.weight(w)),
    )
    val sans = FontFamily(outfit(300), outfit(400), outfit(500), outfit(600), outfit(700))
}

object Type {
    fun serif(size: Int) = TextStyle(fontFamily = Fonts.serif, fontSize = size.sp, lineHeight = (size * 1.08f).sp)
    fun sans(size: Int, weight: FontWeight = FontWeight.Normal) =
        TextStyle(fontFamily = Fonts.sans, fontSize = size.sp, fontWeight = weight, lineHeight = (size * 1.45f).sp)

    /** tracked uppercase label, the editorial eyebrow */
    fun eyebrow(size: Int = 10, tracking: TextUnit = 0.3.em) =
        TextStyle(fontFamily = Fonts.sans, fontSize = size.sp, fontWeight = FontWeight.Medium, letterSpacing = tracking)
}

@Composable
fun AuraTheme(content: @Composable () -> Unit) {
    val dark = isSystemInDarkTheme()
    val c = if (dark) DarkAura else LightAura
    val scheme = if (dark) darkColorScheme(
        primary = c.brand, background = c.background, surface = c.surfaceElevated,
        onBackground = c.textPrimary, onSurface = c.textPrimary, surfaceContainer = c.surfaceElevated,
    ) else lightColorScheme(
        primary = c.brand, background = c.background, surface = c.surfaceElevated,
        onBackground = c.textPrimary, onSurface = c.textPrimary, surfaceContainer = c.surfaceElevated,
    )
    CompositionLocalProvider(LocalAura provides c) {
        MaterialTheme(colorScheme = scheme, content = content)
    }
}

val aura: AuraColors @Composable get() = LocalAura.current
