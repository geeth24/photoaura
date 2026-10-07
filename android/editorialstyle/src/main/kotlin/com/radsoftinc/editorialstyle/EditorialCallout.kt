package com.radsoftinc.editorialstyle

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * A note set apart by a coloured rule on the left: a locked-gallery notice, a message
 * from the photographer, a cancellation.
 */
@Composable
fun EditorialCallout(
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    title: String? = null,
    message: String? = null,
    accent: Color = EditorialTheme.colors.brand,
    content: @Composable ColumnScope.() -> Unit = {},
) {
    val c = EditorialTheme.colors
    val type = EditorialTheme.typography
    Row(
        modifier
            .fillMaxWidth()
            .height(IntrinsicSize.Min)
            .background(c.surfaceElevated)
            .border(EditorialMetrics.borderWidth, c.borderSubtle),
    ) {
        Box(Modifier.width(2.dp).fillMaxHeight().background(accent))
        Row(Modifier.padding(horizontal = EditorialSpacing.medium, vertical = 14.dp)) {
            if (icon != null) {
                Icon(icon, null, Modifier.padding(top = 2.dp, end = EditorialSpacing.small).size(16.dp), tint = accent)
            }
            Column(verticalArrangement = Arrangement.spacedBy(EditorialSpacing.xSmall)) {
                title?.let { Text(it, style = type.sans(EditorialTypography.Size.subtitle), color = c.textPrimary) }
                message?.let { Text(it, style = type.sans(EditorialTypography.Size.caption), color = c.textMuted) }
                content()
            }
        }
    }
}

/** Uppercase tracked text link, e.g. "Get directions" or "View booking". */
@Composable
fun EditorialTextLink(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, icon: ImageVector? = null, color: Color = EditorialTheme.colors.brand) {
    Row(
        modifier.editorialPress(onClick = onClick).padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(text.uppercase(), style = EditorialTheme.typography.label(10.sp, 2.sp), color = color)
        if (icon != null) Icon(icon, null, Modifier.size(12.dp), tint = color)
    }
}
