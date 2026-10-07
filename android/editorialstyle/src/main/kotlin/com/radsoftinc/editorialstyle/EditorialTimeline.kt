package com.radsoftinc.editorialstyle

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Activity log on a hairline rail, newest first; the newest dot is filled. Pairs are (what, when). */
@Composable
fun EditorialTimeline(entries: List<Pair<String, String>>, modifier: Modifier = Modifier) {
    val c = EditorialTheme.colors
    val type = EditorialTheme.typography
    Column(modifier.fillMaxWidth()) {
        entries.forEachIndexed { i, (label, at) ->
            Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
                Box(Modifier.width(12.dp).fillMaxHeight()) {
                    Box(
                        Modifier.padding(start = 3.dp).width(1.dp).fillMaxHeight()
                            .background(c.borderSubtle),
                    )
                    Box(
                        Modifier.offset(y = 6.dp).size(7.dp)
                            .background(if (i == 0) c.brand else c.surfaceElevated)
                            .border(EditorialMetrics.borderWidth, if (i == 0) c.brand else c.borderStrong),
                    )
                }
                Column(
                    Modifier.padding(start = EditorialSpacing.small, bottom = if (i < entries.lastIndex) EditorialSpacing.medium else 0.dp),
                    verticalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    Text(label, style = type.sans(EditorialTypography.Size.caption), color = c.textPrimary)
                    Text(at, style = type.sans(11.sp), color = c.textFaint)
                }
            }
        }
    }
}
