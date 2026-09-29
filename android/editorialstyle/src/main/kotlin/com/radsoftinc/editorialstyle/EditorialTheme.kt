package com.radsoftinc.editorialstyle

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf

val LocalEditorialColors = staticCompositionLocalOf { EditorialColors.Dark }
val LocalEditorialTypography = staticCompositionLocalOf { EditorialTypography() }
val LocalEditorialSpacing = staticCompositionLocalOf { EditorialSpacing }

object EditorialTheme {
    val colors: EditorialColors
        @Composable @ReadOnlyComposable get() = LocalEditorialColors.current
    val typography: EditorialTypography
        @Composable @ReadOnlyComposable get() = LocalEditorialTypography.current
    val spacing: EditorialSpacing
        @Composable @ReadOnlyComposable get() = LocalEditorialSpacing.current
}

@Composable
fun EditorialTheme(darkTheme: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    val c = if (darkTheme) EditorialColors.Dark else EditorialColors.Light
    // material pieces (sheets, pull to refresh, nav bar) read these
    val scheme = if (darkTheme) {
        darkColorScheme(
            primary = c.brand, background = c.background, surface = c.surfaceElevated,
            onBackground = c.textPrimary, onSurface = c.textPrimary, surfaceContainer = c.surfaceElevated,
            error = c.error,
        )
    } else {
        lightColorScheme(
            primary = c.brand, background = c.background, surface = c.surfaceElevated,
            onBackground = c.textPrimary, onSurface = c.textPrimary, surfaceContainer = c.surfaceElevated,
            error = c.error,
        )
    }
    val typography = remember { EditorialTypography() }
    CompositionLocalProvider(
        LocalEditorialColors provides c,
        LocalEditorialTypography provides typography,
        LocalEditorialSpacing provides EditorialSpacing,
    ) {
        MaterialTheme(colorScheme = scheme, content = content)
    }
}
