package com.radsoftinc.photoaura.features.bookings

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import com.radsoftinc.editorialstyle.EditorialBadgeTone
import com.radsoftinc.photoaura.core.BookingStatus
import java.text.NumberFormat
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale

private val usd = NumberFormat.getCurrencyInstance(Locale.US)

fun money(cents: Long): String = usd.format(cents / 100.0)

/** "2026-11-14" is a calendar day, not an instant, so it's never shifted into a timezone. */
fun day(iso: String?): LocalDate? = iso?.take(10)?.let { runCatching { LocalDate.parse(it) }.getOrNull() }

private val longDay = DateTimeFormatter.ofPattern("EEEE, MMMM d, yyyy", Locale.US)
private val shortDay = DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.US)
private val stampFmt = DateTimeFormatter.ofPattern("MMM d, yyyy, h:mm a", Locale.US)

fun fmtDay(iso: String?, long: Boolean = true): String =
    day(iso)?.format(if (long) longDay else shortDay) ?: iso.orEmpty()

/** "17:00" -> "5:00 PM" */
fun fmtTime(t: String?): String {
    val m = Regex("^(\\d{1,2}):(\\d{2})").find(t ?: return "") ?: return t
    val h = m.groupValues[1].toInt()
    return "${if (h % 12 == 0) 12 else h % 12}:${m.groupValues[2]} ${if (h < 12) "AM" else "PM"}"
}

fun timeRange(start: String?, end: String?): String =
    listOf(fmtTime(start), fmtTime(end)).filter { it.isNotEmpty() }.joinToString(" – ").ifEmpty { "TBD" }

/** UTC timestamps from the server, shown in the phone's own time. */
fun fmtStamp(iso: String?): String {
    val at = iso?.let { runCatching { Instant.parse(it) }.getOrNull() } ?: return ""
    return at.atZone(ZoneId.systemDefault()).format(stampFmt)
}

fun localDay(iso: String?): String {
    val at = iso?.let { runCatching { Instant.parse(it) }.getOrNull() } ?: return ""
    return at.atZone(ZoneId.systemDefault()).toLocalDate().format(shortDay)
}

fun daysUntil(iso: String?): Long? = day(iso)?.let { ChronoUnit.DAYS.between(LocalDate.now(), it) }

val STATUS_LABEL = mapOf(
    "draft" to "Draft",
    "sent" to "Awaiting signature",
    "signed" to "Awaiting retainer",
    "booked" to "Booked",
    "event_complete" to "Event complete",
    "delivered" to "Final due",
    "paid" to "Paid in full",
    "cancelled" to "Cancelled",
)

// brand = waiting on someone, neutral = in hand, solid = done
fun statusTone(s: BookingStatus): EditorialBadgeTone = when (s) {
    "draft" -> EditorialBadgeTone.Muted
    "sent", "signed", "delivered" -> EditorialBadgeTone.Brand
    "paid" -> EditorialBadgeTone.Solid
    "cancelled" -> EditorialBadgeTone.Danger
    else -> EditorialBadgeTone.Neutral
}

val METHOD_LABEL = mapOf("zelle" to "Zelle", "cash" to "Cash", "check" to "Check", "other" to "Other")

val CLIENT_STEPS = listOf("Signed", "Date secured", "Event day", "Gallery delivered", "Paid in full")

fun stepsDone(s: BookingStatus): Int = when (s) {
    "signed" -> 1
    "booked" -> 2
    "event_complete" -> 3
    "delivered" -> 4
    "paid" -> 5
    else -> 0
}

const val CONSENT_TEXT = "I agree to sign this agreement electronically, and that typing my name below is my signature."
const val ZELLE = "zelle@reactiveshots.com"

fun splitStops(location: String?): List<String> =
    location.orEmpty().split("\n").map { it.trim() }.filter { it.isNotEmpty() }

fun mapsSearch(stop: String): String =
    "https://www.google.com/maps/search/?api=1&query=" + Uri.encode(stop)

/** Directions through every stop in order, ending at the last. */
fun mapsDirections(stops: List<String>): String {
    val dest = stops.lastOrNull().orEmpty()
    val via = stops.dropLast(1)
    return "https://www.google.com/maps/dir/?api=1&destination=" + Uri.encode(dest) +
        if (via.isNotEmpty()) "&waypoints=" + Uri.encode(via.joinToString("|")) else ""
}

fun Context.openUrl(url: String) {
    runCatching { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
}

fun packageLine(name: String?, hours: Double?, short: Boolean = false): String {
    val h = hours?.let { if (it % 1.0 == 0.0) it.toInt().toString() else it.toString() }
    return (name ?: "Custom package") + if (h != null) ", $h ${if (short) "hrs" else "hours"}" else ""
}

fun plural(n: Int, word: String) = "$n ${if (n == 1) word else word + "s"}"

/** "$1,350.00" style input back to cents; null when it isn't a positive amount. */
fun parseCents(s: String): Long? {
    val v = s.replace(Regex("[$,\\s]"), "").toBigDecimalOrNull() ?: return null
    val cents = v.movePointRight(2).setScale(0, java.math.RoundingMode.HALF_UP).toLong()
    return cents.takeIf { it > 0 }
}

/** Bumped after a booking changes so lists and the home card reload. */
object BookingSync {
    var version by mutableIntStateOf(0)
        private set

    fun changed() {
        version++
    }
}
