package com.radsoftinc.editorialstyle

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Square initials tile, or whatever image the caller passes. */
@Composable
fun EditorialAvatar(
    fullName: String,
    modifier: Modifier = Modifier,
    size: Dp = 44.dp,
    image: (@Composable () -> Unit)? = null,
) {
    val c = EditorialTheme.colors
    val initials = fullName.split(" ").filter { it.isNotBlank() }.take(2).joinToString("") { it.take(1) }.uppercase()
    Box(modifier.size(size).background(c.brand.copy(alpha = 0.1f)), contentAlignment = Alignment.Center) {
        if (image != null) {
            image()
        } else {
            Text(
                initials.ifEmpty { "?" },
                style = EditorialTheme.typography.sans((size.value * 0.28f).sp, FontWeight.Medium).copy(letterSpacing = 1.2.sp),
                color = c.brand,
            )
        }
    }
}
