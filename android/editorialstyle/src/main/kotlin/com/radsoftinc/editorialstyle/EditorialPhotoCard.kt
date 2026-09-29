package com.radsoftinc.editorialstyle

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Cover image cropped to a fixed aspect with the title set over a bottom scrim. */
@Composable
fun EditorialPhotoCard(
    title: String,
    modifier: Modifier = Modifier,
    caption: String? = null,
    aspect: Float = 4f / 3f,
    onClick: (() -> Unit)? = null,
    image: @Composable () -> Unit,
) {
    val c = EditorialTheme.colors
    val type = EditorialTheme.typography
    // the scrim is always dark to light, whatever the theme, because it sits on a photo
    val scrim = Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.35f), Color.Black.copy(alpha = 0.78f)))
    val shadow = Shadow(Color.Black.copy(alpha = 0.4f), Offset(0f, 1f), 6f)
    Box(
        modifier
            .fillMaxWidth()
            .aspectRatio(aspect)
            .then(if (onClick != null) Modifier.editorialPress(onClick = onClick) else Modifier)
            .background(c.surfaceElevated)
            .border(EditorialMetrics.borderWidth, c.borderSubtle),
    ) {
        Box(Modifier.fillMaxSize()) { image() }
        Box(Modifier.fillMaxSize().background(scrim))
        Column(
            Modifier.align(Alignment.BottomStart).padding(EditorialSpacing.small),
            verticalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            Text(
                title,
                style = type.serif(16.sp).copy(shadow = shadow),
                color = Color.White,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            if (caption != null) {
                Text(
                    caption.uppercase(),
                    style = type.sans(10.sp, FontWeight.SemiBold).copy(letterSpacing = 1.5.sp, shadow = shadow),
                    color = Color.White.copy(alpha = 0.78f),
                    maxLines = 1,
                )
            }
        }
    }
}
