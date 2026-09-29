package com.radsoftinc.editorialstyle

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun <T> EditorialSegmentedControl(
    items: List<Pair<String, T>>,
    selection: T,
    onSelect: (T) -> Unit,
    modifier: Modifier = Modifier,
) {
    val c = EditorialTheme.colors
    val type = EditorialTheme.typography
    Row(modifier.fillMaxWidth().border(EditorialMetrics.borderWidth, c.borderDefault)) {
        items.forEachIndexed { i, (label, value) ->
            val active = value == selection
            Box(
                Modifier
                    .weight(1f)
                    .height(36.dp)
                    .background(if (active) c.surfaceElevated else Color.Transparent)
                    .clickable(role = Role.Tab) { onSelect(value) }
                    .padding(horizontal = EditorialSpacing.medium),
                contentAlignment = Alignment.Center,
            ) {
                Text(label.uppercase(), style = type.label(11.sp, 1.7.sp), color = if (active) c.brand else c.textMuted, maxLines = 1)
            }
            if (i < items.lastIndex) Box(Modifier.width(1.dp).height(36.dp).background(c.borderDefault))
        }
    }
}
