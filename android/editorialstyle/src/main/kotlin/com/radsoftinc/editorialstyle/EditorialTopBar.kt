package com.radsoftinc.editorialstyle

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

val EditorialTopBarHeight = 64.dp

/** Floating back and action buttons over a scrolling screen, fading so content slides under. */
@Composable
fun EditorialTopBar(
    onBack: (() -> Unit)?,
    modifier: Modifier = Modifier,
    action: (() -> Unit)? = null,
    actionIcon: ImageVector? = null,
    actionLabel: String? = null,
) {
    val bg = EditorialTheme.colors.background
    Box(
        modifier
            .fillMaxWidth()
            .background(Brush.verticalGradient(listOf(bg, bg.copy(alpha = 0.85f), bg.copy(alpha = 0f))))
            .statusBarsPadding()
            .height(EditorialTopBarHeight)
            .padding(horizontal = EditorialSpacing.medium),
    ) {
        if (onBack != null) {
            RoundButton(Icons.AutoMirrored.Outlined.ArrowBack, "Back", Modifier.align(Alignment.CenterStart), onBack)
        }
        if (action != null && actionIcon != null) {
            RoundButton(actionIcon, actionLabel ?: "", Modifier.align(Alignment.CenterEnd), action, accent = true)
        }
    }
}

@Composable
private fun RoundButton(icon: ImageVector, label: String, modifier: Modifier, onClick: () -> Unit, accent: Boolean = false) {
    val c = EditorialTheme.colors
    Box(
        modifier.size(44.dp).clip(CircleShape).background(c.surfaceCard).clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { Icon(icon, label, Modifier.size(20.dp), tint = if (accent) c.brand else c.textPrimary) }
}

/** The big serif page title at the top of a tab. */
@Composable
fun EditorialLargeTitle(text: String, modifier: Modifier = Modifier) {
    Text(
        text,
        modifier,
        style = EditorialTheme.typography.serif(38.sp).copy(letterSpacing = (-0.5).sp),
        color = EditorialTheme.colors.textPrimary,
    )
}
