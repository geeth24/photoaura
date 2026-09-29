package com.radsoftinc.editorialstyle

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha

/** Pulsing placeholder block; size it with the modifier. */
@Composable
fun EditorialSkeleton(modifier: Modifier = Modifier) {
    val pulse = rememberInfiniteTransition(label = "skeleton")
    val a by pulse.animateFloat(1f, 0.6f, infiniteRepeatable(tween(1100), RepeatMode.Reverse), label = "pulse")
    Box(modifier.alpha(a).background(EditorialTheme.colors.surfaceElevated))
}
