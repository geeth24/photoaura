package com.radsoftinc.editorialstyle

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Numbered progress through a fixed set of steps: the first [done] are checked,
 * the one after is "next" unless [active] is false (a cancelled flow has no next).
 */
@Composable
fun EditorialSteps(steps: List<String>, done: Int, modifier: Modifier = Modifier, active: Boolean = true) {
    val c = EditorialTheme.colors
    val type = EditorialTheme.typography
    Column(modifier.fillMaxWidth().background(c.borderSubtle).border(EditorialMetrics.borderWidth, c.borderSubtle)) {
        steps.forEachIndexed { i, label ->
            val isDone = i < done
            val isNext = i == done && active
            if (i > 0) Spacer(Modifier.height(1.dp))
            Row(
                Modifier.fillMaxWidth().height(IntrinsicSize.Min).background(if (isNext) c.surfaceCard else c.surfaceElevated),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    Modifier.width(2.dp).fillMaxHeight().background(
                        when {
                            isDone -> c.brand
                            isNext -> c.brand.copy(alpha = 0.4f)
                            else -> Color.Transparent
                        },
                    ),
                )
                Row(Modifier.padding(horizontal = 14.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier
                            .size(24.dp)
                            .background(if (isDone) c.brand else Color.Transparent)
                            .border(
                                EditorialMetrics.borderWidth,
                                when {
                                    isDone || isNext -> c.brand
                                    else -> c.borderDefault
                                },
                            ),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (isDone) {
                            Icon(Icons.Filled.Check, null, Modifier.size(14.dp), tint = c.background)
                        } else {
                            Text("${i + 1}", style = type.label(10.sp, 0.sp), color = if (isNext) c.brand else c.textFaint)
                        }
                    }
                    Spacer(Modifier.width(EditorialSpacing.small))
                    Text(
                        label.uppercase(),
                        style = type.label(11.sp, 2.sp),
                        color = when {
                            isDone -> c.textPrimary
                            isNext -> c.brand
                            else -> c.textFaint
                        },
                    )
                }
            }
        }
    }
}
