package com.radsoftinc.photoaura.features.bookings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material.icons.automirrored.outlined.ReceiptLong
import androidx.compose.material.icons.outlined.Draw
import androidx.compose.material.icons.outlined.EventAvailable
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.radsoftinc.editorialstyle.EditorialButton
import com.radsoftinc.editorialstyle.EditorialButtonStyle
import com.radsoftinc.editorialstyle.EditorialMetrics
import com.radsoftinc.editorialstyle.EditorialSpacing
import com.radsoftinc.editorialstyle.EditorialTheme
import com.radsoftinc.editorialstyle.EditorialTypography
import com.radsoftinc.editorialstyle.editorialPress
import com.radsoftinc.photoaura.core.BookingSummary
import java.time.LocalDate

/** The booking worth surfacing on home: something to sign, then something to pay, then the next event. */
fun pickHomeBooking(rows: List<BookingSummary>): BookingSummary? {
    val today = LocalDate.now()
    val upcoming = rows
        .filter { it.status != "cancelled" && it.status != "draft" && !(day(it.eventDate) ?: today).isBefore(today) }
        .sortedBy { it.eventDate.orEmpty() }
    return rows.firstOrNull { it.action == "sign" } ?: rows.firstOrNull { it.action == "pay" } ?: upcoming.firstOrNull()
}

private data class CardView(val icon: ImageVector, val eyebrow: String, val title: String, val body: String, val cta: String)

@Composable
fun BookingCard(b: BookingSummary, onOpen: () -> Unit) {
    val c = EditorialTheme.colors
    val type = EditorialTheme.typography
    val n = daysUntil(b.eventDate)
    val whenText = when {
        n == null -> ""
        n == 0L -> "Today"
        n == 1L -> "Tomorrow"
        n > 1 -> "In $n days"
        else -> ""
    }
    val next = b.nextPayment
    val v = when {
        b.action == "sign" -> CardView(
            Icons.Outlined.Draw, "Action needed", "Review and sign your agreement",
            "${b.eventType} · ${fmtDay(b.eventDate)}. Your date is held once it's signed and the retainer arrives.", "Review & sign",
        )
        b.action == "pay" && next != null -> CardView(
            Icons.AutoMirrored.Outlined.ReceiptLong, "Payment due", "${next.label} · ${money(next.amountCents)}",
            "${b.eventType} · ${fmtDay(b.eventDate)}. Zelle, cash, or check.", "How to pay",
        )
        else -> CardView(
            Icons.Outlined.EventAvailable, if (whenText.isNotEmpty()) "Coming up · $whenText" else "Coming up", b.eventType ?: "Your booking",
            "${fmtDay(b.eventDate)} · ${b.packageName.orEmpty()}", "View booking",
        )
    }
    val urgent = b.action != null
    Row(
        Modifier
            .fillMaxWidth()
            .height(IntrinsicSize.Min)
            .editorialPress(onClick = onOpen)
            .background(c.surfaceElevated)
            .border(EditorialMetrics.borderWidth, if (urgent) c.borderAccent else c.borderSubtle),
    ) {
        Box(Modifier.width(2.dp).fillMaxHeight().background(c.brand))
        Column(Modifier.padding(EditorialSpacing.large), verticalArrangement = Arrangement.spacedBy(EditorialSpacing.medium)) {
            Row(verticalAlignment = Alignment.Top) {
                Box(Modifier.size(44.dp).background(c.brand.copy(alpha = 0.12f)), contentAlignment = Alignment.Center) {
                    Icon(v.icon, null, Modifier.size(20.dp), tint = c.brand)
                }
                Spacer(Modifier.width(EditorialSpacing.medium))
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(v.eyebrow.uppercase(), style = type.label(10.sp, 3.sp), color = c.brand)
                    Text(v.title, style = type.serif(24.sp), color = c.textPrimary)
                    Text(v.body, style = type.sans(EditorialTypography.Size.caption), color = c.textSecondary)
                }
            }
            EditorialButton(v.cta, onOpen, style = if (urgent) EditorialButtonStyle.Primary else EditorialButtonStyle.Secondary)
        }
    }
}
