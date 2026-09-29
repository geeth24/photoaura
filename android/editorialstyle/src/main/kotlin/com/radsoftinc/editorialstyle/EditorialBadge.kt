package com.radsoftinc.editorialstyle

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

enum class EditorialBadgeTone { Neutral, Brand, Success, Warning, Danger, Muted }

@Composable
fun EditorialBadge(text: String, modifier: Modifier = Modifier, tone: EditorialBadgeTone = EditorialBadgeTone.Neutral) {
    val c = EditorialTheme.colors
    val (fg, border) = when (tone) {
        EditorialBadgeTone.Neutral -> c.textSecondary to c.borderDefault
        EditorialBadgeTone.Brand -> c.brand to c.borderAccent
        EditorialBadgeTone.Success -> c.success to c.success.copy(alpha = 0.4f)
        EditorialBadgeTone.Warning -> c.warning to c.warning.copy(alpha = 0.4f)
        EditorialBadgeTone.Danger -> c.error to c.error.copy(alpha = 0.4f)
        EditorialBadgeTone.Muted -> c.textMuted to c.borderDefault
    }
    Text(
        text.uppercase(),
        modifier.border(EditorialMetrics.borderWidth, border).padding(horizontal = 10.dp, vertical = 5.dp),
        style = EditorialTheme.typography.label(tracking = 2.sp),
        color = fg,
        maxLines = 1,
    )
}
