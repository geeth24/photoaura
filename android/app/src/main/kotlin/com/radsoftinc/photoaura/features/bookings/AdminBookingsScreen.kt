package com.radsoftinc.photoaura.features.bookings

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.outlined.OpenInNew
import androidx.compose.material.icons.automirrored.outlined.EventNote
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.radsoftinc.editorialstyle.EditorialEmptyState
import com.radsoftinc.editorialstyle.EditorialFilterChip
import com.radsoftinc.editorialstyle.EditorialLargeTitle
import com.radsoftinc.editorialstyle.EditorialSkeleton
import com.radsoftinc.editorialstyle.EditorialSpacing
import com.radsoftinc.editorialstyle.EditorialTextLink
import com.radsoftinc.editorialstyle.EditorialTheme
import com.radsoftinc.editorialstyle.EditorialTypography
import com.radsoftinc.photoaura.core.Api
import com.radsoftinc.photoaura.core.BookingSummary
import com.radsoftinc.photoaura.core.Store
import com.radsoftinc.photoaura.core.friendly

data class AdminBookingsState(val rows: List<BookingSummary>? = null, val loading: Boolean = true, val error: String? = null)

sealed interface AdminBookingsIntent {
    data object Load : AdminBookingsIntent
    data class Sync(val version: Int) : AdminBookingsIntent
    data class Loaded(val rows: List<BookingSummary>) : AdminBookingsIntent
    data class Failed(val m: String) : AdminBookingsIntent
}

class AdminBookingsStore : Store<AdminBookingsState, AdminBookingsIntent>(AdminBookingsState()) {
    private var synced = -1

    override fun send(intent: AdminBookingsIntent) {
        when (intent) {
            is AdminBookingsIntent.Sync -> if (intent.version != synced) {
                synced = intent.version
                send(AdminBookingsIntent.Load)
            }
            AdminBookingsIntent.Load -> {
                setState { copy(loading = true, error = null) }
                io { try { send(AdminBookingsIntent.Loaded(Api.bookings())) } catch (e: Exception) { send(AdminBookingsIntent.Failed(e.friendly())) } }
            }
            is AdminBookingsIntent.Loaded -> setState { copy(rows = intent.rows, loading = false) }
            is AdminBookingsIntent.Failed -> setState { copy(loading = false, error = intent.m) }
        }
    }
}

// the same buckets as the web list; counts come from one full load
private enum class Filter(val label: String, val match: (String) -> Boolean) {
    Active("Active", { it != "paid" && it != "cancelled" }),
    Awaiting("Awaiting client", { it == "sent" || it == "signed" || it == "delivered" }),
    Drafts("Drafts", { it == "draft" }),
    Paid("Paid", { it == "paid" }),
    Cancelled("Cancelled", { it == "cancelled" }),
    All("All", { true }),
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminBookingsScreen(
    onOpenBooking: (String) -> Unit,
    bottomPadding: Dp,
    store: AdminBookingsStore = viewModel(),
) {
    val s by store.state.collectAsStateWithLifecycle()
    val ctx = LocalContext.current
    var filter by rememberSaveable { mutableStateOf(Filter.Active) }
    LaunchedEffect(BookingSync.version) { store.send(AdminBookingsIntent.Sync(BookingSync.version)) }
    val top = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()
    val gutter = EditorialSpacing.screenGutter
    val rows = s.rows
    val counts = Filter.entries.associateWith { f -> rows?.count { f.match(it.status) } ?: 0 }
    val c = EditorialTheme.colors

    PullToRefreshBox(
        isRefreshing = s.loading && rows != null,
        onRefresh = { store.send(AdminBookingsIntent.Load) },
        modifier = Modifier.fillMaxSize().background(c.background),
    ) {
        LazyColumn(
            contentPadding = PaddingValues(top = top + EditorialSpacing.xLarge, bottom = bottomPadding + EditorialSpacing.xxxLarge),
            modifier = Modifier.fillMaxSize(),
        ) {
            item {
                Column(Modifier.padding(horizontal = gutter), verticalArrangement = Arrangement.spacedBy(EditorialSpacing.xSmall)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        EditorialLargeTitle("Bookings", Modifier.weight(1f))
                    }
                    Text(
                        if (rows == null) "Loading bookings…" else "${counts[Filter.Active]} active · ${counts[Filter.Awaiting]} waiting on a client",
                        style = EditorialTheme.typography.subtitle, color = c.textSecondary,
                    )
                    EditorialTextLink(
                        "New booking on the web", { ctx.openUrl("${Api.WEB}/bookings/new") },
                        icon = Icons.AutoMirrored.Outlined.OpenInNew,
                    )
                }
            }
            item {
                LazyRow(
                    contentPadding = PaddingValues(horizontal = gutter),
                    horizontalArrangement = Arrangement.spacedBy(EditorialSpacing.xSmall),
                    modifier = Modifier.padding(vertical = EditorialSpacing.medium),
                ) {
                    items(Filter.entries) { f ->
                        EditorialFilterChip(f.label, filter == f, { filter = f }, count = counts[f])
                    }
                }
            }
            val shown = rows?.filter { filter.match(it.status) }
            when {
                rows == null && s.error != null -> item {
                    EditorialEmptyState(
                        Icons.Outlined.Warning, "Couldn't load", Modifier.padding(horizontal = gutter),
                        subtitle = s.error, actionTitle = "Try again", onAction = { store.send(AdminBookingsIntent.Load) },
                    )
                }
                shown == null -> items(6) {
                    EditorialSkeleton(Modifier.padding(horizontal = gutter, vertical = 4.dp).fillMaxWidth().height(72.dp))
                }
                shown.isEmpty() -> item {
                    EditorialEmptyState(
                        Icons.AutoMirrored.Outlined.EventNote,
                        if (rows.isEmpty()) "No bookings yet" else "Nothing here",
                        Modifier.padding(horizontal = gutter),
                        subtitle = if (rows.isEmpty()) "Create one on the web and the client gets an agreement to sign." else "No bookings match this filter.",
                    )
                }
                else -> {
                    item { Box(Modifier.padding(horizontal = gutter).fillMaxWidth().height(1.dp).background(c.borderSubtle)) }
                    items(shown, key = { it.number }) { b -> AdminRow(b) { onOpenBooking(b.number) } }
                }
            }
        }
    }
}

@Composable
private fun AdminRow(b: BookingSummary, onClick: () -> Unit) {
    val c = EditorialTheme.colors
    val type = EditorialTheme.typography
    Column(Modifier.fillMaxWidth().clickable(onClick = onClick)) {
        Column(
            Modifier.padding(horizontal = EditorialSpacing.screenGutter, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(b.number, Modifier.weight(1f), style = type.label(11.sp, 1.sp), color = c.textMuted)
                StatusBadge(b.status)
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(b.client?.fullName.orEmpty(), style = type.sans(EditorialTypography.Size.body, FontWeight.Medium), color = c.textPrimary, maxLines = 1)
                    Text(
                        listOfNotNull(b.eventType, fmtDay(b.eventDate, long = false).ifEmpty { null }).joinToString(" · "),
                        style = type.sans(EditorialTypography.Size.caption), color = c.textMuted, maxLines = 1,
                    )
                }
                Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    val next = b.nextPayment
                    if (next != null) {
                        Text(money(next.amountCents), style = type.sans(EditorialTypography.Size.subtitle), color = if (next.due) c.brand else c.textSecondary)
                        Text("${next.label} · ${if (next.due) "due now" else "upcoming"}", style = type.sans(11.sp), color = c.textFaint, maxLines = 1)
                    } else {
                        Text(money(b.totalDueCents), style = type.sans(EditorialTypography.Size.subtitle), color = c.textSecondary)
                        Text("${money(b.paidCents)} paid", style = type.sans(11.sp), color = c.textFaint)
                    }
                }
                Icon(Icons.AutoMirrored.Outlined.KeyboardArrowRight, null, Modifier.padding(start = 6.dp).size(18.dp), tint = c.textFaint)
            }
        }
        Box(Modifier.padding(horizontal = EditorialSpacing.screenGutter).fillMaxWidth().height(1.dp).background(c.borderSubtle))
    }
}
