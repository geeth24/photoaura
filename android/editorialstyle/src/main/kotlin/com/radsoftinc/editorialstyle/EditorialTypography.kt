package com.radsoftinc.editorialstyle

import androidx.compose.runtime.Immutable
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp

object EditorialFonts {
    val serif = FontFamily(Font(R.font.dm_serif))

    // Outfit is one variable font; its default instance is Thin, so each weight pins the wght axis
    private fun outfit(w: Int) = Font(
        R.font.outfit,
        weight = FontWeight(w),
        variationSettings = FontVariation.Settings(FontVariation.weight(w)),
    )

    val sans = FontFamily(outfit(300), outfit(400), outfit(500), outfit(600), outfit(700))
}

@Immutable
class EditorialTypography(
    val serifFamily: FontFamily = EditorialFonts.serif,
    val sansFamily: FontFamily = EditorialFonts.sans,
) {
    object Size {
        val eyebrow = 11.sp
        val hint = 12.sp
        val caption = 13.sp
        val subtitle = 14.sp
        val body = 15.sp
        val bodyLarge = 17.sp
        val heading = 28.sp
        val display = 40.sp
    }

    object Tracking {
        val eyebrow = 3.5.sp
        val brand = 3.0.sp
        val button = 2.4.sp
        val headingTight = (-0.3).sp
        val none = 0.sp
    }

    object LineSpacing {
        val body = 6.sp
        val hint = 4.sp
        val heading = 2.sp
    }

    fun serif(size: TextUnit) = TextStyle(
        fontFamily = serifFamily,
        fontSize = size,
        lineHeight = size * 1.08f,
    )

    fun sans(size: TextUnit, weight: FontWeight = FontWeight.Normal) = TextStyle(
        fontFamily = sansFamily,
        fontSize = size,
        fontWeight = weight,
        lineHeight = size * 1.45f,
    )

    // Outfit's natural line box is 1.26em; iOS lineSpacing adds on top of that
    private fun sansSpaced(size: TextUnit, spacing: TextUnit) =
        sans(size).copy(lineHeight = (size.value * 1.26f + spacing.value).sp)

    /** Uppercase the text at the call site; Compose has no text case transform. */
    val eyebrow = sans(Size.eyebrow, FontWeight.SemiBold).copy(letterSpacing = Tracking.eyebrow)
    val brandMark = sans(Size.eyebrow, FontWeight.SemiBold).copy(letterSpacing = Tracking.brand)
    val heading = serif(Size.heading).copy(letterSpacing = Tracking.headingTight)
    val display = serif(Size.display).copy(letterSpacing = Tracking.headingTight)
    val subtitle = sansSpaced(Size.subtitle, LineSpacing.hint)
    val body = sansSpaced(Size.body, LineSpacing.body)
    val hint = sansSpaced(Size.hint, LineSpacing.hint)

    /** Small tracked caps for field labels, badges and chips. */
    fun label(size: TextUnit = 10.sp, tracking: TextUnit = 2.5.sp) =
        sans(size, FontWeight.Medium).copy(letterSpacing = tracking)

    // iOS sets button labels in the system face, so these use the platform default too
    val button = TextStyle(
        fontFamily = FontFamily.Default,
        fontSize = 12.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = Tracking.button,
    )
}
