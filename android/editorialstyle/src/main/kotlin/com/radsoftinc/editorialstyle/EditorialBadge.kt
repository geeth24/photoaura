package com.radsoftinc.editorialstyle

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
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

/** Small tracked label set straight on a photo: dark glass by default, a solid brand tag when it's news. */
@Composable
fun EditorialPhotoBadge(text: String, modifier: Modifier = Modifier, prominent: Boolean = false) {
    // brandDark keeps white text legible in both themes
    val fill = if (prominent) EditorialTheme.colors.brandDark else Color.Black.copy(alpha = 0.55f)
    // not uppercased, so a version reads "v2"
    Text(
        text,
        modifier
            .background(fill)
            .padding(horizontal = if (prominent) 8.dp else 5.dp, vertical = if (prominent) 4.dp else 2.dp),
        style = EditorialTheme.typography.label(if (prominent) 10.sp else 9.sp, if (prominent) 1.8.sp else 1.sp),
        color = Color.White,
        maxLines = 1,
    )
}
