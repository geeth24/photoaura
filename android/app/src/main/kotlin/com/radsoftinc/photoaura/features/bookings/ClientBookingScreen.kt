package com.radsoftinc.photoaura.features.bookings

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.automirrored.outlined.ReceiptLong
import androidx.compose.material.icons.outlined.ArrowDownward
import androidx.compose.material.icons.outlined.Block
import androidx.compose.material.icons.outlined.Collections
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.Draw
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Payments
import androidx.compose.material.icons.outlined.PhoneIphone
import androidx.compose.material.icons.outlined.AccountBalance
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.radsoftinc.editorialstyle.EditorialButton
import com.radsoftinc.editorialstyle.EditorialCallout
import com.radsoftinc.editorialstyle.EditorialCard
import com.radsoftinc.editorialstyle.EditorialCheckbox
import com.radsoftinc.editorialstyle.EditorialCopyField
import com.radsoftinc.editorialstyle.EditorialEmptyState
import com.radsoftinc.editorialstyle.EditorialFieldKind
import com.radsoftinc.editorialstyle.EditorialMetrics
import com.radsoftinc.editorialstyle.EditorialSpacing
import com.radsoftinc.editorialstyle.EditorialStat
import com.radsoftinc.editorialstyle.EditorialStatGrid
import com.radsoftinc.editorialstyle.EditorialSteps
import com.radsoftinc.editorialstyle.EditorialTextField
import com.radsoftinc.editorialstyle.EditorialTextLink
import com.radsoftinc.editorialstyle.EditorialTheme
import com.radsoftinc.editorialstyle.EditorialTopBar
import com.radsoftinc.editorialstyle.EditorialTopBarHeight
import com.radsoftinc.editorialstyle.EditorialTypography
import com.radsoftinc.photoaura.core.Api
import com.radsoftinc.photoaura.core.ApiException
import com.radsoftinc.photoaura.core.Booking
import com.radsoftinc.photoaura.core.NextPayment
import com.radsoftinc.photoaura.core.Store
import com.radsoftinc.photoaura.core.friendly
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

data class ClientBookingState(
    val number: String = "",
    val booking: Booking? = null,
    val loading: Boolean = true,
    val error: String? = null,
    val signing: Boolean = false,
    // set when a signature hit a newer contract; the UI clears consent and scrolls up
    val stale: Int = 0,
    val signed: Int = 0,
    val toast: String? = null,
)

sealed interface ClientBookingIntent {
    data class Load(val number: String) : ClientBookingIntent
    data object Refresh : ClientBookingIntent
    data class Loaded(val b: Booking) : ClientBookingIntent
    data class Failed(val m: String) : ClientBookingIntent
    /** [hash] is the contract the client consented to; it's what gets signed. */
    data class Sign(val name: String, val hash: String) : ClientBookingIntent
    data class SignFailed(val e: Throwable) : ClientBookingIntent
    data class Signed(val b: Booking) : ClientBookingIntent
    data object ToastShown : ClientBookingIntent
}

class ClientBookingStore : Store<ClientBookingState, ClientBookingIntent>(ClientBookingState()) {
    override fun send(intent: ClientBookingIntent) {
        when (intent) {
            is ClientBookingIntent.Load -> {
                if (current.number == intent.number && current.booking != null) return
                setState { copy(number = intent.number) }
                send(ClientBookingIntent.Refresh)
            }
            ClientBookingIntent.Refresh -> {
                val n = current.number
                setState { copy(loading = true, error = null) }
                io { try { send(ClientBookingIntent.Loaded(Api.myBooking(n))) } catch (e: Exception) { send(ClientBookingIntent.Failed(e.friendly())) } }
            }
            is ClientBookingIntent.Loaded -> setState { copy(booking = intent.b, loading = false) }
            is ClientBookingIntent.Failed -> setState { copy(loading = false, error = intent.m) }
            is ClientBookingIntent.Sign -> {
                val b = current.booking ?: return
                val hash = intent.hash
                // consent was given to a version that's since been replaced
                if (hash != b.contract.hash) return
                setState { copy(signing = true) }
                io {
                    try { send(ClientBookingIntent.Signed(Api.signBooking(b.number, intent.name, hash))) } catch (e: Exception) { send(ClientBookingIntent.SignFailed(e)) }
                }
            }
            is ClientBookingIntent.Signed -> {
                BookingSync.changed()
                setState { copy(booking = intent.b, signing = false, signed = signed + 1, toast = "Signed. A copy is on its way to your inbox.") }
            }
            is ClientBookingIntent.SignFailed -> {
                val e = intent.e
                if (e is ApiException && e.status == 409) {
                    // the agreement changed while it was open; they have to read the new one
                    setState { copy(signing = false, stale = stale + 1, toast = "The contract was updated — please review again.") }
                    send(ClientBookingIntent.Refresh)
                } else {
                    setState { copy(signing = false, toast = e.friendly()) }
                }
            }
            ClientBookingIntent.ToastShown -> setState { copy(toast = null) }
        }
    }
}

@Composable
fun ClientBookingScreen(
    number: String,
    onBack: () -> Unit,
    onOpenAlbum: (slug: String, name: String) -> Unit,
    store: ClientBookingStore = viewModel(key = "my-booking-$number"),
) {
    LaunchedEffect(number) { store.send(ClientBookingIntent.Load(number)) }
    val s by store.state.collectAsStateWithLifecycle()
    val ctx = LocalContext.current
    val list = rememberLazyListState()
    val scope = rememberCoroutineScope()
    var name by rememberSaveable { mutableStateOf("") }
    // consent belongs to one contract version; a reload with new terms leaves it unchecked
    var consentFor by rememberSaveable { mutableStateOf<String?>(null) }
    val consent = s.booking?.contract?.hash.let { it != null && it == consentFor }

    LaunchedEffect(s.toast) {
        s.toast?.let { Toast.makeText(ctx, it, Toast.LENGTH_LONG).show(); store.send(ClientBookingIntent.ToastShown) }
    }
    LaunchedEffect(s.stale) { if (s.stale > 0) { consentFor = null; list.animateScrollToItem(0) } }
    LaunchedEffect(s.signed) { if (s.signed > 0) list.scrollToItem(0) }

    val top = WindowInsets.statusBars.asPaddingValues().calculateTopPadding() + EditorialTopBarHeight
    Box(Modifier.fillMaxSize().background(EditorialTheme.colors.background)) {
        LazyColumn(
            state = list,
            contentPadding = PaddingValues(start = EditorialSpacing.screenGutter, end = EditorialSpacing.screenGutter, top = top, bottom = 120.dp),
            verticalArrangement = Arrangement.spacedBy(EditorialSpacing.xLarge),
            modifier = Modifier.fillMaxSize(),
        ) {
            val b = s.booking
            when {
                b == null && s.error != null -> item {
                    EditorialEmptyState(
                        Icons.Outlined.Draw, "Booking not found",
                        subtitle = "This link may be for a different account. Sign in with the email the booking was sent to.",
                        actionTitle = "Try again", onAction = { store.send(ClientBookingIntent.Refresh) },
                    )
                }
                b == null -> item { LoadingBlocks() }
                b.cancelled -> cancelled(b)
                !b.contract.signed -> unsigned(
                    b, name, { name = it }, consent, { consentFor = if (it) b.contract.hash else null }, s.stale > 0, s.signing,
                    onJump = { scope.launch { list.animateScrollToItem(list.layoutInfo.totalItemsCount - 1) } },
                    onSign = { consentFor?.let { h -> store.send(ClientBookingIntent.Sign(name.trim().replace(Regex("\\s+"), " "), h)) } },
                )
                else -> signed(b, ctx, onOpenAlbum)
            }
        }
        EditorialTopBar(onBack = onBack)
    }
}

private fun LazyListScope.cancelled(b: Booking) {
    item {
        Column(verticalArrangement = Arrangement.spacedBy(EditorialSpacing.medium)) {
            Eyebrow("Booking ${b.number}")
            Text("This booking was cancelled.", style = EditorialTheme.typography.display, color = EditorialTheme.colors.textPrimary)
        }
    }
    item {
        EditorialCallout(
            icon = Icons.Outlined.Block,
            message = "Your ${(b.event.type ?: "event").lowercase()} on ${fmtDay(b.event.date)} is no longer on the calendar. Questions? Email geeth@reactiveshots.com.",
            accent = EditorialTheme.colors.textMuted,
        )
    }
}

// MARK: - before signing

private fun LazyListScope.unsigned(
    b: Booking,
    name: String,
    onName: (String) -> Unit,
    consent: Boolean,
    onConsent: (Boolean) -> Unit,
    stale: Boolean,
    signing: Boolean,
    onJump: () -> Unit,
    onSign: () -> Unit,
) {
    item {
        Column(verticalArrangement = Arrangement.spacedBy(EditorialSpacing.medium)) {
            Eyebrow("Booking ${b.number}")
            Text("Let's lock in your date.", style = EditorialTheme.typography.display, color = EditorialTheme.colors.textPrimary)
            Text(
                "Hi ${b.client.first}, thank you for choosing Reactive Shots! Here's everything we talked about. Read it through, " +
                    "sign at the bottom, and your ${fmtDay(b.event.date, long = false)} date is held once the retainer arrives.",
                style = EditorialTheme.typography.body, color = EditorialTheme.colors.textSecondary,
            )
            EditorialTextLink("Jump to signature", onJump, icon = Icons.Outlined.ArrowDownward)
        }
    }
    if (stale) {
        item {
            EditorialCallout(title = "The contract was updated — please review again. The new version is below.")
        }
    }
    item { EventFacts(b) }
    item {
        val pay = { k: String -> b.payments.firstOrNull { it.kind == k }?.amountCents ?: 0 }
        Column(verticalArrangement = Arrangement.spacedBy(EditorialSpacing.small)) {
            EditorialStatGrid(listOf(EditorialStat("Total fee", money(b.money.totalFee), emphasized = true)), columns = 1, valueSize = 30)
            EditorialStatGrid(
                listOf(
                    EditorialStat("Retainer · 10%", money(pay("retainer")), caption = "After you sign"),
                    EditorialStat("Event day · 40%", money(pay("event_day")), caption = "After coverage"),
                    EditorialStat("Final · 50%", money(pay("final")), caption = "When your gallery is ready"),
                ),
                columns = 3, valueSize = 17,
            )
        }
    }
    b.detailsForClient?.takeIf { it.isNotBlank() }?.let { text -> item { DetailsNote("From your photographer", text) } }
    item { Eyebrow("Your agreement", Modifier.padding(top = EditorialSpacing.small)) }
    val md = b.contract.markdown
    if (md.isNullOrBlank()) {
        item { Text("The agreement isn't ready yet.", style = EditorialTheme.typography.subtitle, color = EditorialTheme.colors.textMuted) }
    } else {
        val blocks = parseContract(md)
        // one item per block keeps a long agreement cheap to scroll
        items(blocks.size) { i ->
            Box(Modifier.padding(horizontal = EditorialSpacing.xSmall)) { ContractBlockView(blocks[i]) }
        }
    }
    item { SignaturePanel(b, name, onName, consent, onConsent, signing, onSign) }
}

private val todayFmt = DateTimeFormatter.ofPattern("MMMM d, yyyy", Locale.US)

@Composable
private fun SignaturePanel(
    b: Booking,
    name: String,
    onName: (String) -> Unit,
    consent: Boolean,
    onConsent: (Boolean) -> Unit,
    signing: Boolean,
    onSign: () -> Unit,
) {
    val c = EditorialTheme.colors
    val type = EditorialTheme.typography
    val ready = name.isNotBlank() && consent && b.contract.hash != null && !b.contract.markdown.isNullOrBlank()
    Column(
        Modifier.fillMaxWidth().background(c.surfaceElevated).border(EditorialMetrics.borderWidth, c.borderDefault),
    ) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = EditorialSpacing.large, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Outlined.Draw, null, Modifier.size(14.dp), tint = c.textMuted)
            Spacer(Modifier.width(EditorialSpacing.xSmall))
            Text("SIGNATURE", style = type.eyebrow, color = c.textMuted)
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(c.borderSubtle))
        Column(Modifier.padding(EditorialSpacing.large), verticalArrangement = Arrangement.spacedBy(EditorialSpacing.large)) {
            // the consent wording points at the name "below", so it sits above the field
            EditorialCheckbox(consent, onConsent, CONSENT_TEXT)
            EditorialTextField(name, onName, "Your full name", label = "Type your full name", kind = EditorialFieldKind.Name)
            Column(verticalArrangement = Arrangement.spacedBy(EditorialSpacing.xSmall)) {
                Text(
                    name.trim().ifEmpty { "Your name" },
                    Modifier.heightIn(min = 40.dp),
                    style = type.serif(30.sp).copy(fontStyle = FontStyle.Italic),
                    color = if (name.isBlank()) c.textFaint else c.textPrimary,
                )
                Box(Modifier.fillMaxWidth().height(1.dp).background(c.borderStrong))
                Text("Client signature · ${LocalDate.now().format(todayFmt)}", style = type.hint, color = c.textFaint)
            }
            Text(
                "We keep your name, the time, and your IP address with the signed copy. You'll get the PDF by email.",
                style = type.hint, color = c.textMuted,
            )
            EditorialButton(
                if (signing) "Signing…" else "Sign agreement", onSign,
                icon = Icons.Outlined.Draw, isLoading = signing, isDisabled = !ready,
            )
        }
    }
}

// MARK: - after signing

private fun headline(status: String): Pair<String, String> = when (status) {
    "signed" -> "Signed. One step left." to "Your date is held as soon as the retainer arrives."
    "booked" -> "Your date is secured." to "Everything's set. We'll be in touch before the day."
    "event_complete" -> "Thank you for having us." to "We're editing your photos now."
    "delivered" -> "Your gallery preview is ready." to "Full-resolution downloads unlock with the final payment."
    "paid" -> "Paid in full. Thank you!" to "Your full-resolution gallery is unlocked."
    else -> "Your booking" to ""
}

private fun LazyListScope.signed(b: Booking, ctx: Context, onOpenAlbum: (String, String) -> Unit) {
    val (title, sub) = headline(b.status)
    item {
        Column(verticalArrangement = Arrangement.spacedBy(EditorialSpacing.medium)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(EditorialSpacing.medium)) {
                Eyebrow("Booking ${b.number}", Modifier.weight(1f, fill = false))
                StatusBadge(b.status)
            }
            Text(title, style = EditorialTheme.typography.display, color = EditorialTheme.colors.textPrimary)
            Text(
                listOf(sub, "${b.event.type ?: ""} · ${fmtDay(b.event.date)}").filter { it.isNotBlank() }.joinToString(" "),
                style = EditorialTheme.typography.body, color = EditorialTheme.colors.textSecondary,
            )
        }
    }
    item { EditorialSteps(CLIENT_STEPS, stepsDone(b.status)) }
    b.nextPayment?.let { next -> item { NextPaymentCard(b, next, ctx) } }
    b.album?.let { a ->
        item {
            EditorialCard(padding = PaddingValues(EditorialSpacing.large), onClick = { onOpenAlbum(a.slug, a.name) }) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(44.dp).background(EditorialTheme.colors.brand.copy(alpha = 0.12f)), contentAlignment = Alignment.Center) {
                        Icon(Icons.Outlined.Collections, null, Modifier.size(20.dp), tint = EditorialTheme.colors.brand)
                    }
                    Spacer(Modifier.width(EditorialSpacing.medium))
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(
                            (if (a.locked) "Gallery preview" else "Your gallery").uppercase(),
                            style = EditorialTheme.typography.label(10.sp, 2.sp), color = EditorialTheme.colors.textMuted,
                        )
                        Text(a.name, style = EditorialTheme.typography.serif(22.sp), color = EditorialTheme.colors.textPrimary, maxLines = 1)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            if (a.locked) Icon(Icons.Outlined.Lock, null, Modifier.padding(end = 6.dp).size(12.dp), tint = EditorialTheme.colors.textMuted)
                            Text(
                                if (a.locked) "Full-resolution downloads unlock after your final payment." else "Full resolution, ready to download.",
                                style = EditorialTheme.typography.sans(EditorialTypography.Size.caption), color = EditorialTheme.colors.textMuted,
                            )
                        }
                    }
                    Icon(Icons.AutoMirrored.Outlined.ArrowForward, null, Modifier.size(18.dp), tint = EditorialTheme.colors.textFaint)
                }
            }
        }
    }
    item {
        Column(verticalArrangement = Arrangement.spacedBy(EditorialSpacing.medium)) {
            Eyebrow("Payments")
            PaymentsList(b.payments)
            Row {
                Text("${money(b.money.paid)} of ${money(b.money.totalDue)} paid", Modifier.weight(1f), style = EditorialTheme.typography.sans(EditorialTypography.Size.caption), color = EditorialTheme.colors.textMuted)
                if (b.money.balance > 0) {
                    Text("Balance ${money(b.money.balance)}", style = EditorialTheme.typography.sans(EditorialTypography.Size.caption), color = EditorialTheme.colors.textSecondary)
                }
            }
        }
    }
    item {
        Column(verticalArrangement = Arrangement.spacedBy(EditorialSpacing.medium)) {
            Eyebrow("Your event")
            EventFacts(b)
            b.detailsForClient?.takeIf { it.isNotBlank() }?.let { DetailsNote("From your photographer", it) }
        }
    }
    item {
        EditorialCard(padding = PaddingValues(EditorialSpacing.large)) {
            Text("AGREEMENT", style = EditorialTheme.typography.label(10.sp, 2.sp), color = EditorialTheme.colors.textMuted)
            Text("Signed by ${b.contract.signedName.orEmpty()}", style = EditorialTheme.typography.sans(EditorialTypography.Size.body), color = EditorialTheme.colors.textPrimary)
            Text(fmtStamp(b.contract.signedAt), style = EditorialTheme.typography.sans(EditorialTypography.Size.caption), color = EditorialTheme.colors.textMuted)
            PdfButton("Download signed agreement", "${b.number}-agreement.pdf", Modifier.padding(top = EditorialSpacing.xSmall), icon = Icons.Outlined.Download) {
                Api.contractPdf(b.number)
            }
        }
    }
    item {
        EditorialCard(padding = PaddingValues(EditorialSpacing.large)) {
            Text("INVOICE", style = EditorialTheme.typography.label(10.sp, 2.sp), color = EditorialTheme.colors.textMuted)
            Text("INV-${b.number}", style = EditorialTheme.typography.sans(EditorialTypography.Size.body), color = EditorialTheme.colors.textPrimary)
            Text(
                "${if (b.money.balance > 0) "${money(b.money.balance)} balance" else "Paid in full"} · updated with every payment",
                style = EditorialTheme.typography.sans(EditorialTypography.Size.caption), color = EditorialTheme.colors.textMuted,
            )
            PdfButton("Download invoice", "INV-${b.number}.pdf", Modifier.padding(top = EditorialSpacing.xSmall), icon = Icons.AutoMirrored.Outlined.ReceiptLong) {
                Api.myInvoicePdf(b.number)
            }
        }
    }
}

@Composable
private fun NextPaymentCard(b: Booking, next: NextPayment, ctx: Context) {
    val c = EditorialTheme.colors
    val type = EditorialTheme.typography
    val extras = if (next.closing) b.money.extras else 0
    val zelle = b.paymentInstructions?.zelle ?: ZELLE
    val zellePhone = b.paymentInstructions?.zellePhone ?: ZELLE_PHONE
    val memo = b.paymentInstructions?.memo ?: b.number
    var copied by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(copied) { if (copied != null) { kotlinx.coroutines.delay(1600); copied = null } }
    fun copy(label: String, value: String) {
        val cm = ctx.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        cm.setPrimaryClip(ClipData.newPlainText(label, value))
        copied = label
    }

    Column(Modifier.fillMaxWidth().background(c.surfaceElevated).border(EditorialMetrics.borderWidth, if (next.due) c.borderAccent else c.borderSubtle)) {
        Column(Modifier.padding(EditorialSpacing.large), verticalArrangement = Arrangement.spacedBy(EditorialSpacing.xSmall)) {
            Text(
                (if (next.due) "Next payment · due now" else "Coming up").uppercase(),
                style = type.label(10.sp, 2.5.sp), color = if (next.due) c.brand else c.textMuted,
            )
            Text(money(next.amountCents), style = type.serif(40.sp), color = c.textPrimary)
            Text(
                buildString {
                    append(next.label)
                    if (next.kind == "event_day" && !next.due) append(" · due after coverage on ${fmtDay(b.event.date, long = false)}")
                    if (next.closing && !next.due) append(" · due when your gallery is delivered")
                    if (extras > 0) append(" · includes ${money(extras)} in added charges")
                },
                style = type.sans(EditorialTypography.Size.caption), color = c.textSecondary,
            )
        }
        if (next.due) {
            Box(Modifier.fillMaxWidth().height(1.dp).background(c.borderSubtle))
            Column(Modifier.padding(EditorialSpacing.large), verticalArrangement = Arrangement.spacedBy(EditorialSpacing.medium)) {
                Text("HOW TO PAY", style = type.label(10.sp, 2.5.sp), color = c.textMuted)
                PayWay(Icons.Outlined.PhoneIphone, "Zelle", "— fastest", brand = true) {
                    EditorialCopyField("Send to", zelle, copied == "Send to", { copy("Send to", zelle) })
                    EditorialCopyField("Or phone", zellePhone, copied == "Or phone", { copy("Or phone", zellePhone) })
                    EditorialCopyField("Memo", memo, copied == "Memo", { copy("Memo", memo) })
                }
                PayWay(Icons.Outlined.Payments, "Cash", "— in person, at your session or event.")
                PayWay(Icons.Outlined.AccountBalance, "Check", "— hand it over in person, with ${b.number} on the memo line.")
                Box(Modifier.fillMaxWidth().height(1.dp).background(c.borderSubtle))
                Text("We'll email you a receipt as soon as it's marked received.", style = type.hint, color = c.textMuted)
            }
        }
    }
}

@Composable
private fun PayWay(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    rest: String,
    brand: Boolean = false,
    extra: (@Composable () -> Unit)? = null,
) {
    val c = EditorialTheme.colors
    val type = EditorialTheme.typography
    Row(verticalAlignment = Alignment.Top) {
        Icon(icon, null, Modifier.padding(top = 2.dp).size(16.dp), tint = if (brand) c.brand else c.textMuted)
        Spacer(Modifier.width(EditorialSpacing.small))
        Column(verticalArrangement = Arrangement.spacedBy(EditorialSpacing.xSmall)) {
            Text(
                androidx.compose.ui.text.buildAnnotatedString {
                    pushStyle(androidx.compose.ui.text.SpanStyle(color = c.textPrimary)); append(title); pop()
                    append(" $rest")
                },
                style = type.sans(EditorialTypography.Size.subtitle), color = c.textSecondary,
            )
            extra?.invoke()
        }
    }
}
