package com.radsoftinc.photoaura.features.bookings

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.automirrored.outlined.ReceiptLong
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.automirrored.outlined.Undo
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Block
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Collections
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.Draw
import androidx.compose.material.icons.outlined.Email
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.LockOpen
import androidx.compose.material.icons.outlined.LocalShipping
import androidx.compose.material.icons.outlined.Phone
import androidx.compose.material.icons.outlined.Place
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.SelectableDates
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.radsoftinc.editorialstyle.EditorialBadge
import com.radsoftinc.editorialstyle.EditorialBadgeTone
import com.radsoftinc.editorialstyle.EditorialButton
import com.radsoftinc.editorialstyle.EditorialButtonStyle
import com.radsoftinc.editorialstyle.EditorialCallout
import com.radsoftinc.editorialstyle.EditorialCompactButton
import com.radsoftinc.editorialstyle.EditorialConfirmSheet
import com.radsoftinc.editorialstyle.EditorialEmptyState
import com.radsoftinc.editorialstyle.EditorialFieldKind
import com.radsoftinc.editorialstyle.EditorialMetrics
import com.radsoftinc.editorialstyle.EditorialOptionTile
import com.radsoftinc.editorialstyle.EditorialPanel
import com.radsoftinc.editorialstyle.EditorialSheet
import com.radsoftinc.editorialstyle.EditorialSpacing
import com.radsoftinc.editorialstyle.EditorialStat
import com.radsoftinc.editorialstyle.EditorialStatGrid
import com.radsoftinc.editorialstyle.EditorialSteps
import com.radsoftinc.editorialstyle.EditorialTextField
import com.radsoftinc.editorialstyle.EditorialTextLink
import com.radsoftinc.editorialstyle.EditorialTheme
import com.radsoftinc.editorialstyle.EditorialTimeline
import com.radsoftinc.editorialstyle.EditorialTopBar
import com.radsoftinc.editorialstyle.EditorialTopBarHeight
import com.radsoftinc.editorialstyle.EditorialTypography
import com.radsoftinc.photoaura.core.Api
import com.radsoftinc.photoaura.core.Booking
import com.radsoftinc.photoaura.core.BookingPayment
import com.radsoftinc.photoaura.core.Store
import com.radsoftinc.photoaura.core.friendly
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale

data class AdminBookingState(
    val number: String = "",
    val booking: Booking? = null,
    val loading: Boolean = true,
    val error: String? = null,
    // which action is in flight, so only its button spins
    val busy: String? = null,
    val toast: String? = null,
)

sealed interface AdminBookingIntent {
    data class Load(val number: String) : AdminBookingIntent
    data object Refresh : AdminBookingIntent
    data class Loaded(val b: Booking) : AdminBookingIntent
    data class Failed(val m: String) : AdminBookingIntent

    /** Every mutation returns the whole booking, so the screen just swaps it in. */
    data class Act(
        val key: String,
        val call: suspend () -> Booking,
        val done: (Booking) -> String,
        val onOk: () -> Unit = {},
    ) : AdminBookingIntent

    data class Acted(val b: Booking, val message: String, val onOk: () -> Unit) : AdminBookingIntent
    data class ActFailed(val m: String) : AdminBookingIntent
    data object ToastShown : AdminBookingIntent
}

class AdminBookingStore : Store<AdminBookingState, AdminBookingIntent>(AdminBookingState()) {
    override fun send(intent: AdminBookingIntent) {
        when (intent) {
            is AdminBookingIntent.Load -> {
                if (current.number == intent.number && current.booking != null) return
                setState { copy(number = intent.number) }
                send(AdminBookingIntent.Refresh)
            }
            AdminBookingIntent.Refresh -> {
                val n = current.number
                setState { copy(loading = true, error = null) }
                io { try { send(AdminBookingIntent.Loaded(Api.booking(n))) } catch (e: Exception) { send(AdminBookingIntent.Failed(e.friendly())) } }
            }
            is AdminBookingIntent.Loaded -> setState { copy(booking = intent.b, loading = false) }
            is AdminBookingIntent.Failed -> setState { copy(loading = false, error = intent.m) }
            is AdminBookingIntent.Act -> {
                if (current.busy != null) return
                setState { copy(busy = intent.key) }
                io {
                    try {
                        val b = intent.call()
                        send(AdminBookingIntent.Acted(b, intent.done(b), intent.onOk))
                    } catch (e: Exception) {
                        send(AdminBookingIntent.ActFailed(e.friendly()))
                    }
                }
            }
            is AdminBookingIntent.Acted -> {
                BookingSync.changed()
                setState { copy(booking = intent.b, busy = null, toast = intent.message) }
                intent.onOk()
            }
            is AdminBookingIntent.ActFailed -> setState { copy(busy = null, toast = intent.m) }
            AdminBookingIntent.ToastShown -> setState { copy(toast = null) }
        }
    }
}

private sealed interface Confirm {
    data object Send : Confirm
    data object Deliver : Confirm
    data class Undo(val p: BookingPayment) : Confirm
    data class Remove(val p: BookingPayment) : Confirm
}

@Composable
fun AdminBookingScreen(
    number: String,
    onBack: () -> Unit,
    onOpenAlbum: (slug: String, name: String) -> Unit,
    store: AdminBookingStore = viewModel(key = "booking-$number"),
) {
    LaunchedEffect(number) { store.send(AdminBookingIntent.Load(number)) }
    val s by store.state.collectAsStateWithLifecycle()
    val ctx = LocalContext.current
    var confirm by remember { mutableStateOf<Confirm?>(null) }
    var receiving by remember { mutableStateOf<BookingPayment?>(null) }
    var overtime by remember { mutableStateOf(false) }
    var charge by remember { mutableStateOf(false) }
    var contract by remember { mutableStateOf(false) }

    LaunchedEffect(s.toast) {
        s.toast?.let { Toast.makeText(ctx, it, Toast.LENGTH_LONG).show(); store.send(AdminBookingIntent.ToastShown) }
    }

    val top = WindowInsets.statusBars.asPaddingValues().calculateTopPadding() + EditorialTopBarHeight
    Box(Modifier.fillMaxSize().background(EditorialTheme.colors.background)) {
        LazyColumn(
            contentPadding = PaddingValues(start = EditorialSpacing.screenGutter, end = EditorialSpacing.screenGutter, top = top, bottom = 120.dp),
            verticalArrangement = Arrangement.spacedBy(EditorialSpacing.large),
            modifier = Modifier.fillMaxSize(),
        ) {
            val b = s.booking
            when {
                b == null && s.error != null -> item {
                    EditorialEmptyState(
                        Icons.Outlined.WarningAmber, "Booking not found",
                        subtitle = s.error, actionTitle = "Try again", onAction = { store.send(AdminBookingIntent.Refresh) },
                    )
                }
                b == null -> item { LoadingBlocks() }
                else -> {
                    val cancelled = b.cancelled
                    val canSend = b.status == "draft" || b.status == "sent"
                    item { Header(b) }
                    if (!cancelled && canSend) {
                        item {
                            EditorialButton(
                                if (b.status == "draft") "Send to client" else "Resend", { confirm = Confirm.Send },
                                icon = Icons.AutoMirrored.Outlined.Send, isLoading = s.busy == "send",
                            )
                        }
                    }
                    item {
                        when {
                            cancelled -> EditorialCallout(
                                icon = Icons.Outlined.Block,
                                title = "Cancelled ${fmtStamp(b.cancelledAt)}".trim(),
                                message = b.cancelReason,
                                accent = EditorialTheme.colors.error,
                            )
                            b.status == "draft" -> DraftNote("Draft — ${b.client.first} hasn't seen this yet. Send it when the details look right.")
                            else -> EditorialSteps(CLIENT_STEPS, stepsDone(b.status))
                        }
                    }
                    item {
                        PaymentsPanel(
                            b, s.busy,
                            onReceive = { receiving = it },
                            onUndo = { confirm = Confirm.Undo(it) },
                            onRemove = { confirm = Confirm.Remove(it) },
                            onOvertime = { overtime = true },
                            onCharge = { charge = true },
                        )
                    }
                    item { AgreementPanel(b, onView = { contract = true }) }
                    item { GalleryPanel(b, s.busy, onOpenAlbum, onDeliver = { confirm = Confirm.Deliver }) }
                    item { ClientPanel(b) }
                    item {
                        EditorialPanel("Event", icon = Icons.Outlined.Place) {
                            EventFacts(b, withOvertime = true)
                            b.detailsForClient?.takeIf { it.isNotBlank() }?.let { DetailsNote("For the client", it) }
                        }
                    }
                    b.notesInternal?.takeIf { it.isNotBlank() }?.let { notes ->
                        item {
                            EditorialPanel("Internal notes", icon = Icons.Outlined.Lock) {
                                Text(notes, style = EditorialTheme.typography.body, color = EditorialTheme.colors.textSecondary)
                            }
                        }
                    }
                    if (b.timeline.isNotEmpty()) {
                        item {
                            EditorialPanel("Activity", icon = Icons.Outlined.History) {
                                EditorialTimeline(b.timeline.reversed().map { it.label to fmtStamp(it.at) })
                            }
                        }
                    }
                }
            }
        }
        EditorialTopBar(onBack = onBack)
    }

    val b = s.booking ?: return
    when (val c = confirm) {
        Confirm.Send -> EditorialConfirmSheet(
            title = if (b.status == "draft") "Send the agreement to ${b.client.first}?" else "Resend to ${b.client.first}?",
            message = "${b.client.email} gets an email with a sign-in link to review and sign.",
            icon = Icons.AutoMirrored.Outlined.Send,
            primaryLabel = if (b.status == "draft") "Send" else "Resend",
            onConfirm = {
                store.send(AdminBookingIntent.Act("send", { Api.sendBooking(b.number) }, { r ->
                    if (r.emailSent == false) "Saved, but the email didn't go out. Try Resend." else "Agreement sent to ${r.client.email}"
                }))
            },
            onDismissRequest = { confirm = null },
        )
        Confirm.Deliver -> {
            val finalDue = b.payments.filter { it.kind == "final" || it.kind == "extra" }.sumOf { it.amountCents - it.receivedCents }
            EditorialConfirmSheet(
                title = "Deliver the gallery preview to ${b.client.first}?",
                message = "${b.client.first} gets an email with the gallery link and the final payment due (${money(finalDue)}). Downloads stay locked until it's received.",
                icon = Icons.Outlined.LocalShipping,
                primaryLabel = "Deliver",
                onConfirm = {
                    store.send(AdminBookingIntent.Act("deliver", { Api.markDelivered(b.number) }, { "Gallery preview sent to ${b.client.first}" }))
                },
                onDismissRequest = { confirm = null },
            )
        }
        is Confirm.Undo -> EditorialConfirmSheet(
            title = "Undo this receipt?",
            message = "Clears the ${money(c.p.receivedCents)} recorded for the ${c.p.label.lowercase()}. No email is sent, and the booking may move back a step.",
            icon = Icons.AutoMirrored.Outlined.Undo,
            primaryLabel = "Undo receipt",
            dismissLabel = "Keep it",
            isDestructive = true,
            onConfirm = {
                store.send(AdminBookingIntent.Act("undo-${c.p.id}", { Api.undoPayment(b.number, c.p.id) }, { "${c.p.label} receipt undone" }))
            },
            onDismissRequest = { confirm = null },
        )
        is Confirm.Remove -> EditorialConfirmSheet(
            title = "Remove this charge?",
            message = "${c.p.label} (${money(c.p.amountCents)}) comes off the final payment.",
            icon = Icons.Outlined.Close,
            primaryLabel = "Remove charge",
            dismissLabel = "Keep it",
            isDestructive = true,
            onConfirm = {
                store.send(AdminBookingIntent.Act("remove-${c.p.id}", { Api.removeCharge(b.number, c.p.id) }, { "${c.p.label} removed" }))
            },
            onDismissRequest = { confirm = null },
        )
        null -> {}
    }

    receiving?.let { p ->
        MarkReceivedSheet(p, b.client.fullName, saving = s.busy == "receive", onDismiss = { receiving = null }) { cents, method, date, note ->
            store.send(
                AdminBookingIntent.Act(
                    "receive",
                    { Api.receivePayment(b.number, p.id, cents, method, date, note) },
                    { "${p.label} received · receipt emailed to ${b.client.first}" },
                    onOk = { receiving = null },
                ),
            )
        }
    }
    if (overtime) {
        OvertimeSheet(b.pkg.overtimeRateCents, saving = s.busy == "overtime", onDismiss = { overtime = false }) { label, cents ->
            store.send(
                AdminBookingIntent.Act(
                    "overtime", { Api.addCharge(b.number, label, cents) },
                    { "Overtime added · ${money(cents)} with the final payment" }, onOk = { overtime = false },
                ),
            )
        }
    }
    if (charge) {
        AddChargeSheet(saving = s.busy == "charge", onDismiss = { charge = false }) { label, cents ->
            store.send(
                AdminBookingIntent.Act(
                    "charge", { Api.addCharge(b.number, label, cents) },
                    { "$label added to the final payment" }, onOk = { charge = false },
                ),
            )
        }
    }
    if (contract) {
        EditorialSheet({ contract = false }, title = if (b.contract.signed) "Signed agreement" else if (b.contract.sentAt != null) "Agreement as sent" else "Agreement preview") {
            Text(
                if (b.contract.signed) "Exactly what ${b.contract.signedName} signed on ${fmtStamp(b.contract.signedAt)}." else "This is what the client reads before signing.",
                style = EditorialTheme.typography.subtitle, color = EditorialTheme.colors.textSecondary,
            )
            ContractView(b.contract.markdown.orEmpty(), Modifier.verticalScroll(rememberScrollState()))
        }
    }
}

@Composable
private fun Header(b: Booking) {
    val c = EditorialTheme.colors
    Column(verticalArrangement = Arrangement.spacedBy(EditorialSpacing.small)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(EditorialSpacing.small)) {
            Text(b.number, style = EditorialTheme.typography.label(12.sp, 1.sp), color = c.textMuted)
            StatusBadge(b.status)
        }
        Text(b.client.fullName.ifBlank { "No client" }, style = EditorialTheme.typography.display, color = c.textPrimary)
        Text(
            listOfNotNull(b.event.type, fmtDay(b.event.date).ifEmpty { null }, packageLine(b.pkg.name, b.pkg.hours, short = true)).joinToString(" · "),
            style = EditorialTheme.typography.subtitle, color = c.textSecondary,
        )
    }
}

@Composable
private fun DraftNote(text: String) {
    val border = EditorialTheme.colors.borderDefault
    Text(
        text,
        Modifier
            .fillMaxWidth()
            .drawBehind {
                val w = 1.dp.toPx()
                drawRect(
                    border, topLeft = Offset(w / 2, w / 2), size = Size(size.width - w, size.height - w),
                    style = Stroke(w, pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 4.dp.toPx()))),
                )
            }
            .padding(horizontal = EditorialSpacing.medium, vertical = 14.dp),
        style = EditorialTheme.typography.subtitle, color = EditorialTheme.colors.textSecondary,
    )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun PaymentsPanel(
    b: Booking,
    busy: String?,
    onReceive: (BookingPayment) -> Unit,
    onUndo: (BookingPayment) -> Unit,
    onRemove: (BookingPayment) -> Unit,
    onOvertime: () -> Unit,
    onCharge: () -> Unit,
) {
    val cancelled = b.cancelled
    EditorialPanel("Payments", icon = Icons.Outlined.CalendarMonth) {
        val open = !cancelled && b.status != "paid"
        if (b.status != "draft" || open) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(EditorialSpacing.xSmall), verticalArrangement = Arrangement.spacedBy(EditorialSpacing.xSmall)) {
                if (b.status != "draft") {
                    InvoiceCompact(b.number)
                }
                if (open) {
                    EditorialCompactButton("Overtime", onOvertime, icon = Icons.Outlined.Schedule)
                    EditorialCompactButton("Add charge", onCharge, icon = Icons.Outlined.Add)
                }
            }
        }
        EditorialStatGrid(
            listOf(
                EditorialStat("Total fee", money(b.money.totalFee)),
                EditorialStat("Extras", money(b.money.extras)),
                EditorialStat("Paid", money(b.money.paid)),
                EditorialStat("Balance", money(b.money.balance), emphasized = b.money.balance > 0),
            ),
            valueSize = 22,
        )
        PaymentsList(b.payments, actions = if (cancelled) null else { p ->
            if (p.receivedCents > 0) {
                if (p.state != "paid") {
                    EditorialCompactButton("Mark received", { onReceive(p) }, style = if (p.state == "due") EditorialButtonStyle.Primary else EditorialButtonStyle.Secondary)
                }
                EditorialCompactButton("Undo", { onUndo(p) }, icon = Icons.AutoMirrored.Outlined.Undo, style = EditorialButtonStyle.Ghost, isLoading = busy == "undo-${p.id}")
            } else {
                EditorialCompactButton("Mark received", { onReceive(p) }, style = if (p.state == "due") EditorialButtonStyle.Primary else EditorialButtonStyle.Secondary)
                if (p.kind == "extra") {
                    EditorialCompactButton(
                        null, { onRemove(p) }, icon = Icons.Outlined.Close, style = EditorialButtonStyle.Ghost,
                        isLoading = busy == "remove-${p.id}", contentDescription = "Remove ${p.label}",
                    )
                }
            }
        })
        Text(
            "Total due ${money(b.money.totalDue)}. Retainer, event-day and final are 10/40/50 of the fee; extras ride with the final.",
            style = EditorialTheme.typography.hint, color = EditorialTheme.colors.textMuted,
        )
    }
}

@Composable
private fun InvoiceCompact(number: String) {
    val ctx = LocalContext.current
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    EditorialCompactButton("Invoice", {
        busy = true
        scope.launch {
            runCatching { com.radsoftinc.photoaura.core.Documents.openPdf(ctx, "INV-$number.pdf") { Api.invoicePdf(number) } }
                .onFailure { Toast.makeText(ctx, it.friendly(), Toast.LENGTH_LONG).show() }
            busy = false
        }
    }, icon = Icons.AutoMirrored.Outlined.ReceiptLong, isLoading = busy)
}

@Composable
private fun AgreementPanel(b: Booking, onView: () -> Unit) {
    val c = EditorialTheme.colors
    val type = EditorialTheme.typography
    EditorialPanel("Agreement", icon = Icons.Outlined.Draw) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                when {
                    b.contract.signed -> "Signed by ${b.contract.signedName}"
                    b.contract.sentAt != null -> "Waiting for signature"
                    else -> "Not sent yet"
                },
                style = type.serif(22.sp), color = c.textPrimary,
            )
            Text(
                when {
                    b.contract.signed -> fmtStamp(b.contract.signedAt) + (b.contract.signedIp?.let { " · $it" } ?: "")
                    b.contract.sentAt != null -> "Sent ${fmtStamp(b.contract.sentAt)} to ${b.client.email}"
                    else -> "Preview it, then send it from the top of the page."
                },
                style = type.sans(EditorialTypography.Size.caption), color = c.textSecondary,
            )
            b.contract.hash?.let {
                Text("v${b.contract.version ?: "?"} · sha256 ${it.take(16)}…", style = type.sans(11.sp), color = c.textFaint, maxLines = 1)
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(EditorialSpacing.xSmall)) {
            if (!b.contract.markdown.isNullOrBlank()) {
                EditorialButton(if (b.contract.signed) "View" else "Preview", onView, style = EditorialButtonStyle.Secondary, icon = Icons.Outlined.Visibility)
            }
            PdfButton(
                if (b.contract.signed) "Signed PDF" else "Draft PDF",
                "${b.number}-agreement${if (b.contract.signed) "" else "-draft"}.pdf",
                icon = Icons.Outlined.Download,
            ) { Api.contractPdf(b.number, preview = !b.contract.signed) }
        }
    }
}

@Composable
private fun GalleryPanel(b: Booking, busy: String?, onOpenAlbum: (String, String) -> Unit, onDeliver: () -> Unit) {
    val c = EditorialTheme.colors
    val type = EditorialTheme.typography
    val a = b.album
    val canDeliver = (b.status == "booked" || b.status == "event_complete") && a != null
    EditorialPanel(
        "Gallery", icon = Icons.Outlined.Collections,
        action = a?.let {
            {
                if (it.locked) {
                    EditorialBadge("Preview · locked", tone = EditorialBadgeTone.Brand)
                } else {
                    EditorialBadge("Unlocked", tone = EditorialBadgeTone.Neutral)
                }
            }
        },
    ) {
        if (a == null) {
            Text(
                "No gallery yet. Linking one puts it in preview mode, so downloads stay locked until the final payment. Link or create it on the web.",
                style = type.sans(EditorialTypography.Size.caption), color = c.textSecondary,
            )
            return@EditorialPanel
        }
        Row(Modifier.fillMaxWidth().clickable { onOpenAlbum(a.slug, a.name) }, verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(a.name, style = type.serif(22.sp), color = c.textPrimary, maxLines = 1)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(if (a.locked) Icons.Outlined.Lock else Icons.Outlined.LockOpen, null, Modifier.padding(end = 6.dp).size(12.dp), tint = c.textMuted)
                    Text(
                        when {
                            a.locked -> "Watermarked previews. Downloads unlock with the final payment."
                            b.unlockedAt != null -> "Full resolution since ${fmtStamp(b.unlockedAt)}"
                            else -> "Full resolution, downloads open."
                        },
                        style = type.sans(EditorialTypography.Size.caption), color = c.textSecondary,
                    )
                }
            }
            Icon(Icons.AutoMirrored.Outlined.ArrowForward, "Open album", Modifier.padding(start = 8.dp).size(18.dp), tint = c.textFaint)
        }
        if (!b.cancelled && canDeliver) {
            EditorialButton("Mark gallery delivered", onDeliver, icon = Icons.Outlined.LocalShipping, isLoading = busy == "deliver")
        }
    }
}

@Composable
private fun ClientPanel(b: Booking) {
    val ctx = LocalContext.current
    val c = EditorialTheme.colors
    val type = EditorialTheme.typography
    EditorialPanel("Client", icon = Icons.Outlined.Email, verticalArrangement = Arrangement.spacedBy(EditorialSpacing.small)) {
        Text(b.client.fullName, style = type.sans(EditorialTypography.Size.bodyLarge), color = c.textPrimary)
        if (b.client.email.isNotBlank()) {
            ContactLine(Icons.Outlined.Email, b.client.email) { ctx.openUrl("mailto:${b.client.email}") }
        }
        b.client.phone?.takeIf { it.isNotBlank() }?.let { phone ->
            ContactLine(Icons.Outlined.Phone, phone) { ctx.openUrl("tel:$phone") }
        }
    }
}

@Composable
private fun ContactLine(icon: androidx.compose.ui.graphics.vector.ImageVector, text: String, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, Modifier.size(14.dp), tint = EditorialTheme.colors.textFaint)
        Spacer(Modifier.width(EditorialSpacing.xSmall))
        Text(text, style = EditorialTheme.typography.sans(EditorialTypography.Size.caption), color = EditorialTheme.colors.textSecondary)
    }
}

// MARK: - sheets

private val METHODS = listOf("zelle", "cash", "check", "other")
private val pickerDay = DateTimeFormatter.ofPattern("EEE, MMM d, yyyy", Locale.US)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MarkReceivedSheet(
    p: BookingPayment,
    clientName: String,
    saving: Boolean,
    onDismiss: () -> Unit,
    onSubmit: (cents: Long, method: String, date: String, note: String?) -> Unit,
) {
    val c = EditorialTheme.colors
    val type = EditorialTheme.typography
    var amount by remember { mutableStateOf(String.format(Locale.US, "%.2f", p.outstanding / 100.0)) }
    var method by remember { mutableStateOf("zelle") }
    var date by remember { mutableStateOf(LocalDate.now()) }
    var note by remember { mutableStateOf("") }
    var picking by remember { mutableStateOf(false) }
    val cents = parseCents(amount)

    EditorialSheet(onDismiss, title = p.label, verticalArrangement = Arrangement.spacedBy(EditorialSpacing.large)) {
        Text("${money(p.amountCents)} due from $clientName. They get an emailed receipt.", style = type.subtitle, color = c.textSecondary)
        EditorialTextField(
            amount, { amount = it }, "0.00", label = "Amount received", kind = EditorialFieldKind.Decimal, prefix = "$",
            isError = cents == null && amount.isNotBlank(),
        )
        Column(verticalArrangement = Arrangement.spacedBy(EditorialSpacing.xSmall)) {
            Text("METHOD", style = type.label(), color = c.textMuted)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                METHODS.forEach { m ->
                    EditorialOptionTile(METHOD_LABEL[m] ?: m, method == m, { method = m }, Modifier.weight(1f))
                }
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(EditorialSpacing.xSmall)) {
            Text("DATE RECEIVED", style = type.label(), color = c.textMuted)
            Row(
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp)
                    .background(c.surfaceElevated)
                    .border(EditorialMetrics.borderWidth, c.borderDefault)
                    .clickable { picking = true }
                    .padding(horizontal = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(date.format(pickerDay) + if (date == LocalDate.now()) " · today" else "", Modifier.weight(1f), style = type.sans(EditorialTypography.Size.body), color = c.textPrimary)
                Icon(Icons.Outlined.CalendarMonth, "Pick a date", Modifier.size(18.dp), tint = c.textMuted)
            }
        }
        EditorialTextField(
            note, { note = it }, if (method == "check") "Check #" else "Zelle confirmation, who paid…", label = "Note (optional)",
        )
        Column(verticalArrangement = Arrangement.spacedBy(EditorialSpacing.small)) {
            EditorialButton(
                "Record ${cents?.let(::money) ?: "payment"}",
                { cents?.let { onSubmit(it, method, date.toString(), note.trim().ifEmpty { null }) } },
                isLoading = saving, isDisabled = cents == null,
            )
            EditorialButton("Cancel", onDismiss, style = EditorialButtonStyle.Ghost)
        }
    }

    if (picking) {
        // the picker works in UTC midnights; a received date can't be in the future
        val today = LocalDate.now()
        val state = rememberDatePickerState(
            initialSelectedDateMillis = date.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli(),
            selectableDates = object : SelectableDates {
                override fun isSelectableDate(utcTimeMillis: Long) =
                    !Instant.ofEpochMilli(utcTimeMillis).atZone(ZoneOffset.UTC).toLocalDate().isAfter(today)
            },
        )
        DatePickerDialog(
            onDismissRequest = { picking = false },
            confirmButton = {
                TextButton({
                    state.selectedDateMillis?.let { date = Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate() }
                    picking = false
                }) { Text("OK") }
            },
            dismissButton = { TextButton({ picking = false }) { Text("Cancel") } },
        ) { DatePicker(state) }
    }
}

// the contract gives the first 15 minutes free, then bills in 30-minute blocks
private val OVERTIME_BLOCKS = listOf(30, 60, 90, 120)

private fun minutesLabel(m: Int): String = when {
    m < 60 -> "$m min"
    m == 60 -> "1 hr"
    m % 60 == 0 -> "${m / 60} hrs"
    else -> "${m / 60.0} hrs"
}

@Composable
private fun OvertimeSheet(hourlyCents: Long, saving: Boolean, onDismiss: () -> Unit, onSubmit: (label: String, cents: Long) -> Unit) {
    val c = EditorialTheme.colors
    var minutes by remember { mutableStateOf(30) }
    val block = hourlyCents / 2
    val cents = block * (minutes / 30)
    EditorialSheet(onDismiss, title = "Add overtime") {
        Text(
            "The first 15 minutes past the end time are free. After that it's ${money(block)} per 30 minutes, due with the final payment.",
            style = EditorialTheme.typography.subtitle, color = c.textSecondary,
        )
        Column(verticalArrangement = Arrangement.spacedBy(EditorialSpacing.xSmall)) {
            OVERTIME_BLOCKS.chunked(2).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(EditorialSpacing.xSmall)) {
                    row.forEach { m ->
                        EditorialOptionTile(minutesLabel(m), minutes == m, { minutes = m }, Modifier.weight(1f), subtitle = money(block * (m / 30)))
                    }
                }
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(EditorialSpacing.small)) {
            EditorialButton("Add ${money(cents)}", { onSubmit("Overtime (${minutesLabel(minutes)})", cents) }, isLoading = saving, isDisabled = block <= 0)
            EditorialButton("Cancel", onDismiss, style = EditorialButtonStyle.Ghost)
        }
    }
}

@Composable
private fun AddChargeSheet(saving: Boolean, onDismiss: () -> Unit, onSubmit: (label: String, cents: Long) -> Unit) {
    var label by remember { mutableStateOf("") }
    var amount by remember { mutableStateOf("") }
    val cents = parseCents(amount)
    EditorialSheet(onDismiss, title = "Add a charge") {
        Text("An add-on, like extra prints. It's due with the final payment.", style = EditorialTheme.typography.subtitle, color = EditorialTheme.colors.textSecondary)
        EditorialTextField(label, { label = it }, "Second photographer", label = "Description")
        EditorialTextField(amount, { amount = it }, "0.00", label = "Amount", kind = EditorialFieldKind.Decimal, prefix = "$")
        Column(verticalArrangement = Arrangement.spacedBy(EditorialSpacing.small)) {
            EditorialButton(
                "Add ${cents?.let(::money) ?: "charge"}",
                { if (cents != null && label.isNotBlank()) onSubmit(label.trim(), cents) },
                isLoading = saving, isDisabled = cents == null || label.isBlank(),
            )
            EditorialButton("Cancel", onDismiss, style = EditorialButtonStyle.Ghost)
        }
    }
}
