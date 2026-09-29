package com.radsoftinc.editorialstyle

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun EditorialFaceChip(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    name: String? = null,
    count: Int? = null,
    isActive: Boolean = false,
    image: @Composable () -> Unit,
) {
    val c = EditorialTheme.colors
    Column(
        modifier.width(72.dp).editorialPress(onClick = onClick),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Box(
            Modifier
                .size(72.dp)
                .then(
                    if (isActive) Modifier.shadow(14.dp, RectangleShape, ambientColor = c.brand, spotColor = c.brand) else Modifier,
                )
                .background(c.surfaceElevated)
                .clipToBounds()
                .border(if (isActive) 1.5.dp else 1.dp, if (isActive) c.brand else c.borderSubtle),
        ) { image() }
        Text(
            (name ?: "${count ?: 0}").uppercase(),
            style = EditorialTheme.typography.label(tracking = 1.5.sp),
            color = if (isActive) c.textPrimary else c.textMuted,
            maxLines = 1,
        )
    }
}
