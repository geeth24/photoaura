package com.radsoftinc.editorialstyle

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp

@Composable
fun EditorialCard(
    modifier: Modifier = Modifier,
    padding: PaddingValues = PaddingValues(
        horizontal = EditorialSpacing.cardPaddingHorizontal,
        vertical = EditorialSpacing.cardPaddingVertical,
    ),
    verticalArrangement: Arrangement.Vertical = Arrangement.spacedBy(EditorialSpacing.small),
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val c = EditorialTheme.colors
    Column(
        modifier
            .fillMaxWidth()
            .background(c.surfaceElevated)
            .border(EditorialMetrics.borderWidth, c.borderSubtle)
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(padding),
        verticalArrangement = verticalArrangement,
        content = content,
    )
}

/** A card with a tracked title bar (icon, title, optional trailing action) over its body. */
@Composable
fun EditorialPanel(
    title: String,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    action: (@Composable () -> Unit)? = null,
    verticalArrangement: Arrangement.Vertical = Arrangement.spacedBy(EditorialSpacing.medium),
    content: @Composable ColumnScope.() -> Unit,
) {
    val c = EditorialTheme.colors
    Column(modifier.fillMaxWidth().background(c.surfaceElevated).border(EditorialMetrics.borderWidth, c.borderSubtle)) {
        Row(
            Modifier
                .fillMaxWidth()
                .drawBehind {
                    val h = 1.dp.toPx()
                    drawLine(c.borderSubtle, Offset(0f, size.height - h / 2), Offset(size.width, size.height - h / 2), h)
                }
                .heightIn(min = 52.dp)
                .padding(horizontal = EditorialSpacing.medium, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (icon != null) Icon(icon, null, Modifier.padding(end = EditorialSpacing.xSmall).size(14.dp), tint = c.textMuted)
            Text(title.uppercase(), Modifier.weight(1f), style = EditorialTheme.typography.eyebrow, color = c.textMuted, maxLines = 1)
            action?.invoke()
        }
        Column(Modifier.padding(EditorialSpacing.medium), verticalArrangement = verticalArrangement, content = content)
    }
}
