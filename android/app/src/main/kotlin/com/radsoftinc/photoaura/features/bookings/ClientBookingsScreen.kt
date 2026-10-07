package com.radsoftinc.photoaura.features.bookings

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.outlined.EventBusy
import androidx.compose.material.icons.automirrored.outlined.ReceiptLong
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.radsoftinc.editorialstyle.EditorialCard
import com.radsoftinc.editorialstyle.EditorialEmptyState
import com.radsoftinc.editorialstyle.EditorialEyebrow
import com.radsoftinc.editorialstyle.EditorialLargeTitle
import com.radsoftinc.editorialstyle.EditorialSegmentedControl
import com.radsoftinc.editorialstyle.EditorialSkeleton
import com.radsoftinc.editorialstyle.EditorialSpacing
import com.radsoftinc.editorialstyle.EditorialStat
import com.radsoftinc.editorialstyle.EditorialStatGrid
import com.radsoftinc.editorialstyle.EditorialTextLink
import com.radsoftinc.editorialstyle.EditorialTheme
import com.radsoftinc.editorialstyle.EditorialTypography
import com.radsoftinc.photoaura.core.Api
import com.radsoftinc.photoaura.core.BookingSummary
import com.radsoftinc.photoaura.core.MyInvoice
import com.radsoftinc.photoaura.core.Store
import com.radsoftinc.photoaura.core.friendly
import java.time.LocalDate

data class ClientBookingsState(
    val bookings: List<BookingSummary>? = null,
    val invoices: List<MyInvoice>? = null,
    val loading: Boolean = true,
    val error: String? = null,
)

sealed interface ClientBookingsIntent {
    data object Load : ClientBookingsIntent
    data class Sync(val version: Int) : ClientBookingsIntent
    data class Loaded(val b: List<BookingSummary>, val i: List<MyInvoice>) : ClientBookingsIntent
    data class Failed(val m: String) : ClientBookingsIntent
}

class ClientBookingsStore : Store<ClientBookingsState, ClientBookingsIntent>(ClientBookingsState()) {
    private var synced = -1

    override fun send(intent: ClientBookingsIntent) {
        when (intent) {
            is ClientBookingsIntent.Sync -> if (intent.version != synced) {
                synced = intent.version
                send(ClientBookingsIntent.Load)
            }
            ClientBookingsIntent.Load -> {
                setState { copy(loading = true, error = null) }
                io {
                    try {
                        send(ClientBookingsIntent.Loaded(Api.myBookings(), Api.myInvoices()))
                    } catch (e: Exception) {
                        send(ClientBookingsIntent.Failed(e.friendly()))
                    }
                }
            }
            is ClientBookingsIntent.Loaded -> setState { copy(bookings = intent.b, invoices = intent.i, loading = false) }
            is ClientBookingsIntent.Failed -> setState { copy(loading = false, error = intent.m) }
        }
    }
}

private enum class Pane(val label: String) { Bookings("Bookings"), Invoices("Invoices") }

/** The client's Bookings tab: their bookings, and the invoices for them one tap over. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ClientBookingsScreen(
    onOpenBooking: (String) -> Unit,
    bottomPadding: Dp,
    store: ClientBookingsStore = viewModel(),
) {
    val s by store.state.collectAsStateWithLifecycle()
    var pane by rememberSaveable { mutableStateOf(Pane.Bookings) }
    LaunchedEffect(BookingSync.version) { store.send(ClientBookingsIntent.Sync(BookingSync.version)) }
    val top = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()
    val gutter = EditorialSpacing.screenGutter

    PullToRefreshBox(
        isRefreshing = s.loading && s.bookings != null,
        onRefresh = { store.send(ClientBookingsIntent.Load) },
        modifier = Modifier.fillMaxSize().background(EditorialTheme.colors.background),
    ) {
        LazyColumn(
            contentPadding = PaddingValues(start = gutter, end = gutter, top = top + EditorialSpacing.xLarge, bottom = bottomPadding + EditorialSpacing.xxxLarge),
            verticalArrangement = Arrangement.spacedBy(EditorialSpacing.small),
            modifier = Modifier.fillMaxSize(),
        ) {
            item { EditorialLargeTitle(if (pane == Pane.Bookings) "Your bookings" else "Invoices") }
            item {
                EditorialSegmentedControl(
                    Pane.entries.map { it.label to it },
                    selection = pane,
                    onSelect = { pane = it },
                    modifier = Modifier.padding(vertical = EditorialSpacing.xSmall),
                )
            }
            when {
                s.bookings == null && s.error != null -> item {
                    EditorialEmptyState(
                        Icons.Outlined.Warning, "Couldn't load",
                        subtitle = s.error, actionTitle = "Try again", onAction = { store.send(ClientBookingsIntent.Load) },
                    )
                }
                s.bookings == null -> items(3) { EditorialSkeleton(Modifier.fillMaxWidth().height(150.dp)) }
                pane == Pane.Bookings -> bookingsPane(s.bookings!!, onOpenBooking)
                else -> invoicesPane(s.invoices.orEmpty(), onOpenBooking)
            }
        }
    }
}

private fun isPast(b: BookingSummary): Boolean =
    b.status == "cancelled" || (day(b.eventDate) ?: LocalDate.now()).isBefore(LocalDate.now())

private fun LazyListScope.bookingsPane(rows: List<BookingSummary>, onOpen: (String) -> Unit) {
    if (rows.isEmpty()) {
        item {
            EditorialEmptyState(
                Icons.Outlined.EventBusy, "No bookings yet",
                subtitle = "When your photographer sends an agreement, it shows up here.",
            )
        }
        return
    }
    // upcoming soonest first; past (and cancelled) most recent first
    val upcoming = rows.filterNot(::isPast).sortedBy { it.eventDate.orEmpty() }
    val past = rows.filter(::isPast).sortedByDescending { it.eventDate.orEmpty() }
    item {
        Text(
            "${upcoming.size} upcoming · ${past.size} past",
            style = EditorialTheme.typography.subtitle, color = EditorialTheme.colors.textSecondary,
        )
    }
    listOf("Upcoming" to upcoming, "Past" to past).filter { it.second.isNotEmpty() }.forEach { (label, list) ->
        item { EditorialEyebrow(label, Modifier.padding(top = EditorialSpacing.medium), color = EditorialTheme.colors.textMuted) }
        items(list, key = { it.number }) { b -> ClientBookingCard(b) { onOpen(b.number) } }
    }
}

@Composable
private fun ClientBookingCard(b: BookingSummary, onClick: () -> Unit) {
    val c = EditorialTheme.colors
    val type = EditorialTheme.typography
    val next = b.nextPayment
    EditorialCard(padding = PaddingValues(EditorialSpacing.large), onClick = onClick, verticalArrangement = Arrangement.spacedBy(EditorialSpacing.medium)) {
        Row(verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(b.number, style = type.label(10.sp, 2.5.sp), color = c.textMuted)
                Text(b.eventType ?: "Booking", style = type.serif(24.sp), color = c.textPrimary)
                Text(fmtDay(b.eventDate), style = type.sans(EditorialTypography.Size.caption), color = c.textSecondary)
            }
            StatusBadge(b.status)
        }
        Spacer(Modifier.fillMaxWidth().height(1.dp).background(c.borderSubtle))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                when {
                    b.status == "cancelled" -> "This booking was cancelled"
                    b.action == "sign" -> "Review and sign your agreement"
                    next != null -> "${next.label} · ${money(next.amountCents)}${if (next.due) " due now" else ""}"
                    else -> "${money(b.paidCents)} of ${money(b.totalDueCents)} paid"
                },
                Modifier.weight(1f),
                style = type.sans(EditorialTypography.Size.caption),
                color = if (b.action != null) c.brand else c.textMuted,
            )
            Icon(Icons.AutoMirrored.Outlined.ArrowForward, null, Modifier.size(16.dp), tint = c.textFaint)
        }
    }
}

private fun LazyListScope.invoicesPane(rows: List<MyInvoice>, onOpenBooking: (String) -> Unit) {
    val live = rows.filter { it.status != "cancelled" }
    val balance = live.sumOf { it.balanceCents }
    item {
        Text(
            when {
                rows.isEmpty() -> "Nothing billed yet."
                balance > 0 -> "${money(balance)} outstanding across ${plural(rows.size, "invoice")}"
                else -> "You're all paid up. Thank you!"
            },
            style = EditorialTheme.typography.subtitle, color = EditorialTheme.colors.textSecondary,
        )
    }
    if (rows.isEmpty()) {
        item {
            EditorialEmptyState(
                Icons.AutoMirrored.Outlined.ReceiptLong, "No invoices yet",
                subtitle = "Each booking gets an invoice once your photographer sends the agreement.",
            )
        }
        return
    }
    item {
        EditorialStatGrid(
            listOf(
                EditorialStat("Billed", money(live.sumOf { it.totalCents })),
                EditorialStat("Paid", money(live.sumOf { it.paidCents })),
                EditorialStat("Balance", money(balance), emphasized = balance > 0),
            ),
            Modifier.padding(vertical = EditorialSpacing.xSmall),
            columns = 3,
            valueSize = 18,
        )
    }
    items(rows, key = { it.invoiceNumber }) { r -> InvoiceCard(r) { onOpenBooking(r.bookingNumber) } }
}

@Composable
private fun InvoiceCard(r: MyInvoice, onOpenBooking: () -> Unit) {
    val c = EditorialTheme.colors
    val type = EditorialTheme.typography
    val cancelled = r.status == "cancelled"
    EditorialCard(padding = PaddingValues(EditorialSpacing.large), verticalArrangement = Arrangement.spacedBy(EditorialSpacing.medium)) {
        Row(verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(r.invoiceNumber, style = type.sans(EditorialTypography.Size.body, androidx.compose.ui.text.font.FontWeight.Medium), color = c.textPrimary)
                EditorialTextLink("Booking ${r.bookingNumber}", onOpenBooking, color = c.textMuted)
            }
            InvoiceBadge(r.status)
        }
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(r.eventType ?: "", style = type.sans(EditorialTypography.Size.body), color = c.textPrimary)
            Text(fmtDay(r.eventDate), style = type.sans(EditorialTypography.Size.caption), color = c.textMuted)
            val next = r.nextPayment
            if (r.status == "due" && next != null) {
                Text("${next.label} · ${money(next.amountCents)} due now", style = type.sans(EditorialTypography.Size.caption), color = c.brand)
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(EditorialSpacing.medium)) {
            listOf("Total" to r.totalCents, "Paid" to r.paidCents, "Balance" to r.balanceCents).forEach { (label, v) ->
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(label.uppercase(), style = type.label(10.sp, 2.sp), color = c.textMuted)
                    Text(
                        money(v),
                        style = type.sans(EditorialTypography.Size.subtitle).copy(textDecoration = if (cancelled) TextDecoration.LineThrough else null),
                        color = when {
                            cancelled -> c.textFaint
                            label == "Balance" && v > 0 -> c.brand
                            else -> c.textPrimary
                        },
                    )
                }
            }
        }
        PdfButton("Download PDF", "INV-${r.bookingNumber}.pdf", icon = Icons.AutoMirrored.Outlined.ReceiptLong) { Api.myInvoicePdf(r.bookingNumber) }
    }
}
