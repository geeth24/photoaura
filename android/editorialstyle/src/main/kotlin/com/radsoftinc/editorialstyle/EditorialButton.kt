package com.radsoftinc.editorialstyle

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp

enum class EditorialButtonStyle { Primary, Secondary, Ghost, Destructive }

/** Tap target that shrinks slightly while held, the editorial press feel. */
fun Modifier.editorialPress(enabled: Boolean = true, role: Role? = Role.Button, onClick: () -> Unit): Modifier = composed {
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    val scale by animateFloatAsState(
        if (pressed) EditorialMetrics.pressScale else 1f,
        tween(EditorialMetrics.pressDurationMillis),
        label = "press",
    )
    this
        .graphicsLayer { scaleX = scale; scaleY = scale }
        .clickable(interactionSource = source, indication = null, enabled = enabled, role = role, onClick = onClick)
}

@Composable
fun EditorialButton(
    title: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    style: EditorialButtonStyle = EditorialButtonStyle.Primary,
    isLoading: Boolean = false,
    isDisabled: Boolean = false,
    icon: ImageVector? = null,
) {
    val c = EditorialTheme.colors
    // disabled drops to a hollow outline, a clearer "not ready yet" than a washed-out fill
    val fill = when {
        isDisabled -> if (style == EditorialButtonStyle.Primary) Color.Transparent else c.surfaceElevated
        style == EditorialButtonStyle.Primary -> c.brand
        style == EditorialButtonStyle.Secondary -> c.surfaceElevated
        else -> Color.Transparent
    }
    val label = when {
        isDisabled -> c.textMuted
        style == EditorialButtonStyle.Primary -> c.background
        style == EditorialButtonStyle.Destructive -> c.error
        else -> c.textPrimary
    }
    val border = when {
        isDisabled -> c.borderDefault
        style == EditorialButtonStyle.Primary -> Color.Transparent
        style == EditorialButtonStyle.Destructive -> c.error.copy(alpha = 0.5f)
        else -> c.borderDefault
    }

    Row(
        modifier
            .fillMaxWidth()
            .editorialPress(enabled = !isDisabled && !isLoading, onClick = onClick)
            .background(fill)
            .border(EditorialMetrics.borderWidth, border)
            .padding(vertical = 14.dp, horizontal = 28.dp),
        horizontalArrangement = Arrangement.spacedBy(EditorialSpacing.xSmall, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (isLoading) {
            CircularProgressIndicator(Modifier.size(14.dp), color = label, strokeWidth = 2.dp)
        } else if (icon != null) {
            Icon(icon, null, Modifier.size(16.dp), tint = label)
        }
        Text(title.uppercase(), style = EditorialTheme.typography.button, color = label, maxLines = 1)
    }
}
