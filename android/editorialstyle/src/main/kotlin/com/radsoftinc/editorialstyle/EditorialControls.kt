package com.radsoftinc.editorialstyle

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Filter chip with an optional count, brand-outlined when selected. */
@Composable
fun EditorialFilterChip(label: String, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier, count: Int? = null) {
    val c = EditorialTheme.colors
    val type = EditorialTheme.typography
    Row(
        modifier
            .height(36.dp)
            .border(EditorialMetrics.borderWidth, if (selected) c.brand else c.borderDefault)
            .clickable(role = Role.Tab, onClick = onClick)
            .padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(EditorialSpacing.xSmall),
    ) {
        Text(label.uppercase(), style = type.label(10.sp, 2.sp), color = if (selected) c.brand else c.textSecondary, maxLines = 1)
        if (count != null) Text("$count", style = type.label(10.sp, 0.sp), color = c.textFaint)
    }
}

/** One choice in a small grid (payment method, overtime length), with an optional second line. */
@Composable
fun EditorialOptionTile(title: String, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier, subtitle: String? = null) {
    val c = EditorialTheme.colors
    val type = EditorialTheme.typography
    Column(
        modifier
            .border(EditorialMetrics.borderWidth, if (selected) c.brand else c.borderDefault)
            .background(if (selected) c.brand.copy(alpha = 0.10f) else Color.Transparent)
            .clickable(role = Role.RadioButton, onClick = onClick)
            .padding(horizontal = EditorialSpacing.xSmall, vertical = if (subtitle != null) 12.dp else 11.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(
            title,
            style = type.sans(EditorialTypography.Size.subtitle, FontWeight.Medium),
            color = if (selected) (if (subtitle == null) c.brand else c.textPrimary) else c.textSecondary,
            maxLines = 1,
        )
        subtitle?.let { Text(it, style = type.sans(11.sp), color = c.textMuted, maxLines = 1) }
    }
}

/** Square checkbox with its label beside it; the whole row toggles. */
@Composable
fun EditorialCheckbox(checked: Boolean, onCheckedChange: (Boolean) -> Unit, label: String, modifier: Modifier = Modifier) {
    val c = EditorialTheme.colors
    Row(
        modifier.fillMaxWidth().clickable(role = Role.Checkbox) { onCheckedChange(!checked) }.padding(vertical = 4.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Box(
            Modifier
                .padding(top = 1.dp)
                .size(22.dp)
                .background(if (checked) c.brand else Color.Transparent)
                .border(EditorialMetrics.borderWidth, if (checked) c.brand else c.borderStrong),
            contentAlignment = Alignment.Center,
        ) {
            if (checked) Icon(Icons.Filled.Check, null, Modifier.size(16.dp), tint = c.background)
        }
        Spacer(Modifier.width(EditorialSpacing.small))
        Text(label, style = EditorialTheme.typography.sans(EditorialTypography.Size.body), color = c.textPrimary)
    }
}

/** A value to copy by hand (a Zelle address, a memo) with its own Copy button. */
@Composable
fun EditorialCopyField(label: String, value: String, copied: Boolean, onCopy: () -> Unit, modifier: Modifier = Modifier) {
    val c = EditorialTheme.colors
    val type = EditorialTheme.typography
    Row(
        modifier
            .fillMaxWidth()
            .background(c.background)
            .border(EditorialMetrics.borderWidth, c.borderDefault)
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(label.uppercase(), style = type.label(9.sp, 2.sp), color = c.textFaint)
            Text(value, style = type.sans(EditorialTypography.Size.subtitle), color = c.textPrimary, maxLines = 1)
        }
        Spacer(Modifier.width(EditorialSpacing.small))
        Row(
            Modifier
                .height(32.dp)
                .border(EditorialMetrics.borderWidth, if (copied) c.brand else c.borderDefault)
                .clickable(onClick = onCopy)
                .padding(horizontal = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            if (copied) Icon(Icons.Filled.Check, null, Modifier.size(12.dp), tint = c.brand)
            Text(if (copied) "COPIED" else "COPY", style = type.label(10.sp, 1.8.sp), color = if (copied) c.brand else c.textSecondary)
        }
    }
}

/** The small bordered button for row actions (Mark received, Undo), sized to its label. */
@Composable
fun EditorialCompactButton(
    title: String?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: androidx.compose.ui.graphics.vector.ImageVector? = null,
    style: EditorialButtonStyle = EditorialButtonStyle.Secondary,
    isLoading: Boolean = false,
    contentDescription: String? = null,
) {
    val c = EditorialTheme.colors
    val (fill, fg, border) = when (style) {
        EditorialButtonStyle.Primary -> Triple(c.brand, c.background, c.brand)
        EditorialButtonStyle.Secondary -> Triple(Color.Transparent, c.textSecondary, c.borderDefault)
        EditorialButtonStyle.Ghost -> Triple(Color.Transparent, c.textMuted, Color.Transparent)
        EditorialButtonStyle.Destructive -> Triple(Color.Transparent, c.error, c.error.copy(alpha = 0.4f))
    }
    Row(
        modifier
            .height(36.dp)
            .background(fill)
            .border(EditorialMetrics.borderWidth, border)
            .clickable(enabled = !isLoading, role = Role.Button, onClickLabel = contentDescription, onClick = onClick)
            .padding(horizontal = if (title == null) 9.dp else 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        if (isLoading) {
            androidx.compose.material3.CircularProgressIndicator(Modifier.size(12.dp), color = fg, strokeWidth = 1.5.dp)
        } else if (icon != null) {
            Icon(icon, contentDescription, Modifier.size(14.dp), tint = fg)
        }
        if (title != null) Text(title.uppercase(), style = EditorialTheme.typography.label(10.sp, 1.8.sp).copy(fontWeight = FontWeight.SemiBold), color = fg, maxLines = 1)
    }
}
