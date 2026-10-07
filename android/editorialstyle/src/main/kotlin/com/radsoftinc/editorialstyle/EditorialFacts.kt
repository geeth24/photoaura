package com.radsoftinc.editorialstyle

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** One figure in a stat grid: tracked label over a serif number, brand when it needs attention. */
data class EditorialStat(val label: String, val value: String, val emphasized: Boolean = false, val caption: String? = null)

/** Hairline-separated tiles, [columns] to a row, like the web's gap-px grids. */
@Composable
fun EditorialStatGrid(stats: List<EditorialStat>, modifier: Modifier = Modifier, columns: Int = 2, valueSize: Int = 24) {
    val c = EditorialTheme.colors
    val type = EditorialTheme.typography
    Column(modifier.fillMaxWidth().background(c.borderSubtle).border(EditorialMetrics.borderWidth, c.borderSubtle)) {
        stats.chunked(columns).forEachIndexed { r, row ->
            if (r > 0) Spacer(Modifier.height(1.dp))
            Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
                for (i in 0 until columns) {
                    if (i > 0) Spacer(Modifier.width(1.dp))
                    val s = row.getOrNull(i)
                    Column(
                        Modifier.weight(1f).fillMaxHeight().background(c.surfaceElevated).padding(horizontal = 14.dp, vertical = 14.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        if (s != null) {
                            Text(s.label.uppercase(), style = type.label(10.sp, 2.sp), color = c.textMuted, maxLines = 2)
                            Text(
                                s.value,
                                style = type.serif(valueSize.sp),
                                color = if (s.emphasized) c.brand else c.textPrimary,
                                maxLines = 1,
                            )
                            s.caption?.let { Text(it, style = type.sans(EditorialTypography.Size.hint), color = c.textFaint) }
                        }
                    }
                }
            }
        }
    }
}

/** A bordered stack of label / value cells for the facts of a thing (date, time, place…). */
@Composable
fun EditorialFacts(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    val c = EditorialTheme.colors
    Column(
        modifier.fillMaxWidth().background(c.borderSubtle).border(EditorialMetrics.borderWidth, c.borderSubtle),
        verticalArrangement = Arrangement.spacedBy(1.dp),
        content = content,
    )
}

@Composable
fun EditorialFact(label: String, modifier: Modifier = Modifier, value: @Composable () -> Unit) {
    val c = EditorialTheme.colors
    Column(
        modifier.fillMaxWidth().background(c.surfaceElevated).padding(horizontal = EditorialSpacing.medium, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(label.uppercase(), style = EditorialTheme.typography.label(10.sp, 2.sp), color = c.textMuted)
        value()
    }
}

@Composable
fun EditorialFact(label: String, value: String, modifier: Modifier = Modifier) {
    EditorialFact(label, modifier) {
        Text(value, style = EditorialTheme.typography.sans(EditorialTypography.Size.body), color = EditorialTheme.colors.textPrimary)
    }
}

/**
 * A line in a ledger: what it is on the left, the amount on the right, then a status
 * badge, what's been received and any row actions underneath.
 */
@Composable
fun EditorialLedgerRow(
    title: String,
    amount: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    detail: String? = null,
    note: String? = null,
    badge: (@Composable () -> Unit)? = null,
    actions: (@Composable () -> Unit)? = null,
) {
    val c = EditorialTheme.colors
    val type = EditorialTheme.typography
    Column(modifier.fillMaxWidth().padding(vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(title, style = type.sans(EditorialTypography.Size.body, FontWeight.Medium), color = c.textPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis)
                subtitle?.let { Text(it, style = type.sans(11.sp), color = c.textFaint) }
            }
            Spacer(Modifier.width(EditorialSpacing.small))
            Text(amount, style = type.serif(20.sp), color = c.textPrimary)
        }
        if (badge != null || detail != null) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                badge?.invoke()
                Spacer(Modifier.weight(1f))
                Text(detail ?: "—", style = type.sans(EditorialTypography.Size.caption), color = if (detail != null) c.textSecondary else c.textFaint, maxLines = 1)
            }
        }
        note?.let { Text(it, style = type.sans(11.sp), color = c.textFaint, maxLines = 2) }
        if (actions != null) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(EditorialSpacing.xSmall, Alignment.End)) { actions() }
        }
    }
}
