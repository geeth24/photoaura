package com.radsoftinc.editorialstyle

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

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
