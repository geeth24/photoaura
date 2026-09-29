package com.radsoftinc.editorialstyle

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun EditorialProgressBar(
    progress: Float,
    modifier: Modifier = Modifier,
    stage: String? = null,
    detail: String? = null,
) {
    val c = EditorialTheme.colors
    val type = EditorialTheme.typography
    val shown by animateFloatAsState(progress.coerceIn(0f, 1f), tween(300), label = "progress")
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Box(Modifier.fillMaxWidth().height(2.dp).background(c.borderSubtle)) {
            Box(Modifier.fillMaxWidth(shown).fillMaxHeight().background(c.brand))
        }
        if (stage != null || detail != null) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (stage != null) Text(stage.uppercase(), style = type.label(tracking = 2.sp), color = c.textMuted)
                Spacer(Modifier.weight(1f))
                if (detail != null) Text(detail, style = type.sans(11.sp), color = c.textFaint)
            }
        }
    }
}
