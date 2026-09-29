package com.radsoftinc.editorialstyle

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

@Composable
fun EditorialEmptyState(
    icon: ImageVector,
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    actionTitle: String? = null,
    onAction: (() -> Unit)? = null,
) {
    val c = EditorialTheme.colors
    val type = EditorialTheme.typography
    val border = c.borderDefault
    Column(
        modifier
            .fillMaxWidth()
            .drawBehind {
                val w = 1.dp.toPx()
                drawRect(
                    border,
                    topLeft = Offset(w / 2, w / 2),
                    size = Size(size.width - w, size.height - w),
                    style = Stroke(w, pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 4.dp.toPx()))),
                )
            }
            .padding(vertical = 64.dp, horizontal = EditorialSpacing.xLarge),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(EditorialSpacing.small),
    ) {
        Icon(icon, null, Modifier.padding(bottom = EditorialSpacing.xxSmall).size(24.dp), tint = c.textFaint)
        Text(title, style = type.heading, color = c.textPrimary, textAlign = TextAlign.Center)
        if (subtitle != null) Text(subtitle, style = type.subtitle, color = c.textSecondary, textAlign = TextAlign.Center)
        if (actionTitle != null && onAction != null) {
            EditorialButton(
                actionTitle,
                onAction,
                Modifier.padding(top = EditorialSpacing.small).widthIn(max = 240.dp),
                style = EditorialButtonStyle.Secondary,
            )
        }
    }
}
