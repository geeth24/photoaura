package com.radsoftinc.editorialstyle

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

data class EditorialChip<T>(val label: String, val value: T, val count: Int? = null)

/** Single-select chips: uppercase, tracked, hairline border that turns brand when active. */
@Composable
fun <T> EditorialChipRow(
    chips: List<EditorialChip<T>>,
    selection: T,
    onSelect: (T) -> Unit,
    modifier: Modifier = Modifier,
) {
    val c = EditorialTheme.colors
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(EditorialSpacing.xSmall)) {
        chips.forEach { chip ->
            val active = chip.value == selection
            Row(
                Modifier
                    .border(EditorialMetrics.borderWidth, if (active) c.brand else c.borderDefault)
                    .semantics { selected = active }
                    .clickable(role = Role.Tab) { onSelect(chip.value) }
                    .padding(horizontal = 10.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(chip.label.uppercase(), style = EditorialTheme.typography.label(10.sp, 2.sp), color = if (active) c.brand else c.textSecondary, maxLines = 1)
                chip.count?.let { Text("$it", style = EditorialTheme.typography.label(10.sp, 1.sp), color = c.textFaint, maxLines = 1) }
            }
        }
    }
}
