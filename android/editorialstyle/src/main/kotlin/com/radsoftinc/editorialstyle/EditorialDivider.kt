package com.radsoftinc.editorialstyle

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp

@Composable
fun EditorialDivider(modifier: Modifier = Modifier, verticalSpacing: Dp = EditorialSpacing.xLarge) {
    Box(
        modifier
            .padding(vertical = verticalSpacing)
            .fillMaxWidth()
            .height(EditorialMetrics.dividerHeight)
            .background(EditorialTheme.colors.borderSubtle),
    )
}
