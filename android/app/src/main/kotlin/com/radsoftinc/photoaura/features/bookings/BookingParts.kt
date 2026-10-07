package com.radsoftinc.photoaura.features.bookings

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.OpenInNew
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.radsoftinc.editorialstyle.EditorialBadge
import com.radsoftinc.editorialstyle.EditorialBadgeTone
import com.radsoftinc.editorialstyle.EditorialButton
import com.radsoftinc.editorialstyle.EditorialButtonStyle
import com.radsoftinc.editorialstyle.EditorialCallout
import com.radsoftinc.editorialstyle.EditorialFact
import com.radsoftinc.editorialstyle.EditorialFacts
import com.radsoftinc.editorialstyle.EditorialLedgerRow
import com.radsoftinc.editorialstyle.EditorialMetrics
import com.radsoftinc.editorialstyle.EditorialSkeleton
import com.radsoftinc.editorialstyle.EditorialSpacing
import com.radsoftinc.editorialstyle.EditorialTextLink
import com.radsoftinc.editorialstyle.EditorialTheme
import com.radsoftinc.editorialstyle.EditorialTypography
import com.radsoftinc.photoaura.core.Api
import com.radsoftinc.photoaura.core.Booking
import com.radsoftinc.photoaura.core.BookingPayment
import com.radsoftinc.photoaura.core.Documents
import com.radsoftinc.photoaura.core.friendly
import kotlinx.coroutines.launch

@Composable
fun StatusBadge(status: String, modifier: Modifier = Modifier) {
    EditorialBadge(STATUS_LABEL[status] ?: status, modifier, tone = statusTone(status))
}

@Composable
fun PaymentBadge(state: String) {
    when (state) {
        "due" -> EditorialBadge("Due", tone = EditorialBadgeTone.Brand)
        "paid" -> Row(
            Modifier.border(EditorialMetrics.borderWidth, EditorialTheme.colors.borderDefault).padding(horizontal = 10.dp, vertical = 5.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Icon(Icons.Outlined.Check, null, Modifier.size(11.dp), tint = EditorialTheme.colors.textPrimary)
            Text("PAID", style = EditorialTheme.typography.label(tracking = 2.sp), color = EditorialTheme.colors.textPrimary)
        }
        else -> EditorialBadge("Upcoming", tone = EditorialBadgeTone.Muted)
    }
}

@Composable
fun InvoiceBadge(status: String) {
    when (status) {
        "due" -> EditorialBadge("Payment due", tone = EditorialBadgeTone.Brand)
        "paid" -> EditorialBadge("Paid in full", tone = EditorialBadgeTone.Solid)
        "cancelled" -> EditorialBadge("Cancelled", tone = EditorialBadgeTone.Danger)
        else -> EditorialBadge("Open", tone = EditorialBadgeTone.Neutral)
    }
}

/** Each stop opens in Google Maps, numbered when there's more than one, then directions through all of them. */
@Composable
fun StopsList(location: String?) {
    val ctx = LocalContext.current
    val c = EditorialTheme.colors
    val type = EditorialTheme.typography
    val stops = splitStops(location)
    if (stops.isEmpty()) {
        Text("TBD", style = type.sans(EditorialTypography.Size.body), color = c.textMuted)
        return
    }
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        stops.forEachIndexed { i, stop ->
            Row(
                Modifier.fillMaxWidth().clickable { ctx.openUrl(mapsSearch(stop)) }.padding(vertical = 2.dp),
                verticalAlignment = Alignment.Top,
            ) {
                if (stops.size > 1) {
                    Box(Modifier.padding(top = 2.dp).size(18.dp).background(c.brand), contentAlignment = Alignment.Center) {
                        Text("${i + 1}", style = type.label(10.sp, 0.sp), color = c.background)
                    }
                    Spacer(Modifier.width(EditorialSpacing.xSmall))
                }
                Text(stop, style = type.sans(EditorialTypography.Size.body), color = c.textPrimary)
            }
        }
        EditorialTextLink("Get directions", { ctx.openUrl(mapsDirections(stops)) }, icon = Icons.AutoMirrored.Outlined.OpenInNew)
    }
}

/** The API renders the map so the Maps key stays server-side; it wants the bearer token. Hidden if it fails. */
@Composable
fun StopsMap(stops: List<String>, modifier: Modifier = Modifier) {
    val usable = stops.filter { it.length > 5 }
    if (usable.isEmpty()) return
    val ctx = LocalContext.current
    var failed by remember(usable) { mutableStateOf(false) }
    var loaded by remember(usable) { mutableStateOf(false) }
    if (failed) return
    val url = Api.staticMapUrl(usable)
    Box(
        modifier
            .fillMaxWidth()
            .aspectRatio(640f / 240f)
            .background(EditorialTheme.colors.surfaceElevated)
            .border(EditorialMetrics.borderWidth, EditorialTheme.colors.borderSubtle),
    ) {
        if (!loaded) EditorialSkeleton(Modifier.fillMaxSize())
        AsyncImage(
            model = remember(url) {
                ImageRequest.Builder(ctx).data(url)
                    .apply { Api.token?.let { addHeader("Authorization", "Bearer $it") } }
                    .crossfade(true)
                    .build()
            },
            contentDescription = "Map of the event locations",
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop,
            onSuccess = { loaded = true },
            onError = { failed = true },
        )
    }
}

fun includesLine(b: Booking, withOvertime: Boolean = false): String {
    val r = b.pkg.revisions ?: 0
    val base = "${if (b.pkg.includesVideo) "Photos + video" else "Photos"} · $r revision ${if (r == 1) "round" else "rounds"}"
    val ot = b.pkg.overtimeRateCents
    return if (withOvertime && ot > 0) "$base · overtime ${money(ot / 2)}/30 min after 15 free" else base
}

/** Event, date, time, every stop, package and what's included, with the map underneath. */
@Composable
fun EventFacts(b: Booking, withOvertime: Boolean = false) {
    Column {
        EditorialFacts {
            EditorialFact("Event", b.event.type ?: "—")
            EditorialFact("Date", fmtDay(b.event.date).ifEmpty { "TBD" })
            EditorialFact("Time", timeRange(b.event.startTime, b.event.endTime))
            EditorialFact("Location") { StopsList(b.event.location) }
            EditorialFact("Package", packageLine(b.pkg.name, b.pkg.hours))
            EditorialFact("Includes", includesLine(b, withOvertime))
        }
        StopsMap(splitStops(b.event.location))
    }
}

private fun receivedLine(p: BookingPayment): String? {
    if (p.receivedCents <= 0) return null
    return listOfNotNull(
        if (p.receivedCents < p.amountCents) "${money(p.receivedCents)} received" else null,
        localDay(p.receivedAt).ifEmpty { null },
        p.method?.let { METHOD_LABEL[it] },
    ).joinToString(" · ").ifEmpty { null }
}

/** The payment schedule; the studio passes per-row actions. */
@Composable
fun PaymentsList(payments: List<BookingPayment>, actions: (@Composable (BookingPayment) -> Unit)? = null) {
    val c = EditorialTheme.colors
    Column(Modifier.fillMaxWidth()) {
        Box(Modifier.fillMaxWidth().height(1.dp).background(c.borderSubtle))
        payments.forEach { p ->
            EditorialLedgerRow(
                title = p.label,
                amount = money(p.amountCents),
                subtitle = if (p.percent != null) "${p.percent}% of the fee" else "Added to the final payment",
                detail = receivedLine(p),
                note = p.note,
                badge = { PaymentBadge(p.state) },
                actions = actions?.let { a -> { a(p) } },
            )
            Box(Modifier.fillMaxWidth().height(1.dp).background(c.borderSubtle))
        }
    }
}

/** Fetches a PDF with the session and opens it; the button spins while it downloads. */
@Composable
fun PdfButton(
    title: String,
    filename: String,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    style: EditorialButtonStyle = EditorialButtonStyle.Secondary,
    fetch: suspend () -> ByteArray,
) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    EditorialButton(title, {
        busy = true
        scope.launch {
            runCatching { Documents.openPdf(ctx, filename, fetch) }
                .onFailure { Toast.makeText(ctx, it.friendly(), Toast.LENGTH_LONG).show() }
            busy = false
        }
    }, modifier, style = style, isLoading = busy, icon = icon)
}

/** Eyebrow with the short brand rule, the web's section marker. */
@Composable
fun Eyebrow(text: String, modifier: Modifier = Modifier) {
    val c = EditorialTheme.colors
    Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(EditorialSpacing.small)) {
        Box(Modifier.width(48.dp).height(1.dp).background(c.brand))
        Text(text.uppercase(), style = EditorialTheme.typography.eyebrow, color = c.textMuted)
    }
}

/** "From your photographer" note. */
@Composable
fun DetailsNote(label: String, text: String) {
    EditorialCallout {
        Text(label.uppercase(), style = EditorialTheme.typography.label(10.sp, 2.sp), color = EditorialTheme.colors.textMuted)
        Text(text, style = EditorialTheme.typography.body, color = EditorialTheme.colors.textSecondary)
    }
}

@Composable
fun LoadingBlocks() {
    Column(verticalArrangement = Arrangement.spacedBy(EditorialSpacing.medium)) {
        EditorialSkeleton(Modifier.width(120.dp).height(12.dp))
        EditorialSkeleton(Modifier.fillMaxWidth().height(56.dp))
        EditorialSkeleton(Modifier.fillMaxWidth().height(120.dp))
        EditorialSkeleton(Modifier.fillMaxWidth().height(260.dp))
    }
}
