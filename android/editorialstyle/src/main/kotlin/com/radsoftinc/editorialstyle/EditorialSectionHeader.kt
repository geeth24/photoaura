package com.radsoftinc.editorialstyle

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

@Composable
fun EditorialEyebrow(text: String, modifier: Modifier = Modifier, color: Color = EditorialTheme.colors.brand) {
    Text(text.uppercase(), modifier, style = EditorialTheme.typography.eyebrow, color = color)
}

enum class EditorialSectionHeaderStyle {
    /** display-size serif title */
    Page,

    /** heading-size serif title */
    Section,
}

@Composable
fun EditorialSectionHeader(
    modifier: Modifier = Modifier,
    title: String? = null,
    eyebrow: String? = null,
    subtitle: String? = null,
    style: EditorialSectionHeaderStyle = EditorialSectionHeaderStyle.Page,
) {
    val c = EditorialTheme.colors
    val type = EditorialTheme.typography
    Column(modifier, verticalArrangement = Arrangement.spacedBy(EditorialSpacing.small)) {
        if (eyebrow != null) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(EditorialSpacing.small)) {
                Box(Modifier.width(48.dp).height(1.dp).background(c.brand))
                EditorialEyebrow(eyebrow, color = c.textMuted)
            }
        }
        if (title != null) {
            Text(
                title,
                style = if (style == EditorialSectionHeaderStyle.Page) type.display else type.heading,
                color = c.textPrimary,
            )
        }
        if (subtitle != null) Text(subtitle, style = type.subtitle, color = c.textSecondary)
    }
}
