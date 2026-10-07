package com.radsoftinc.photoaura.core

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// server/routers/bookings: _booking_json, _summary_json and the /api/me lists. Money is integer cents.

/** draft, sent, signed, booked, event_complete, delivered, paid, cancelled */
typealias BookingStatus = String

/** The next unpaid line; the final payment and any extras come back as one "Final payment". */
@Serializable
data class NextPayment(
    val kind: String = "",
    val label: String = "",
    val amountCents: Long = 0,
    val due: Boolean = false,
) {
    val closing: Boolean get() = kind == "final" || kind == "extra"
}

@Serializable
data class BookingClient(
    val userId: Int? = null,
    val fullName: String = "",
    val email: String = "",
    val phone: String? = null,
) {
    val first: String get() = fullName.trim().split(" ").firstOrNull().orEmpty().ifBlank { "the client" }
}

/** One row of /api/bookings (admin) or /api/me/bookings (client, with action and balance). */
@Serializable
data class BookingSummary(
    val number: String,
    val status: BookingStatus = "",
    val eventType: String? = null,
    val eventDate: String? = null,
    val packageName: String? = null,
    val totalDueCents: Long = 0,
    val paidCents: Long = 0,
    val nextPayment: NextPayment? = null,
    val albumSlug: String? = null,
    val client: BookingClient? = null,
    val createdAt: String? = null,
    // "sign", "pay" or null
    val action: String? = null,
    val balanceCents: Long = 0,
)

@Serializable
data class BookingEvent(
    val type: String? = null,
    val date: String? = null,
    val startTime: String? = null,
    val endTime: String? = null,
    // several stops, one per line
    val location: String? = null,
)

@Serializable
data class BookingPackage(
    val key: String? = null,
    val name: String? = null,
    val includesVideo: Boolean = false,
    val revisions: Int? = null,
    val hours: Double? = null,
    val hourlyRateCents: Long? = null,
    val overtimeRateCents: Long = 0,
    val feeOverridden: Boolean = false,
)

@Serializable
data class BookingMoney(
    val totalFee: Long = 0,
    val extras: Long = 0,
    val totalDue: Long = 0,
    val paid: Long = 0,
    val balance: Long = 0,
)

@Serializable
data class BookingPayment(
    val id: Int,
    // retainer, event_day, final, extra
    val kind: String = "",
    val label: String = "",
    val percent: Int? = null,
    val amountCents: Long = 0,
    // upcoming, due, paid
    val state: String = "upcoming",
    val receivedCents: Long = 0,
    val receivedAt: String? = null,
    val method: String? = null,
    val note: String? = null,
) {
    val outstanding: Long get() = (amountCents - receivedCents).coerceAtLeast(0)
}

@Serializable
data class BookingContract(
    val version: String? = null,
    val hash: String? = null,
    val sentAt: String? = null,
    val signed: Boolean = false,
    val signedAt: String? = null,
    val signedName: String? = null,
    val signedIp: String? = null,
    val pdfUrl: String? = null,
    // the snapshot that was sent or signed; null on a draft
    val markdown: String? = null,
)

@Serializable
data class BookingAlbum(
    val id: Int? = null,
    val slug: String,
    val name: String = "",
    val locked: Boolean = false,
)

@Serializable
data class BookingTimelineEntry(val at: String? = null, val label: String = "")

@Serializable
data class PaymentInstructions(
    val zelle: String? = null,
    val memo: String? = null,
    val methods: List<String> = emptyList(),
)

@Serializable
data class Booking(
    val number: String,
    val status: BookingStatus = "",
    val client: BookingClient = BookingClient(),
    val event: BookingEvent = BookingEvent(),
    @SerialName("package") val pkg: BookingPackage = BookingPackage(),
    val money: BookingMoney = BookingMoney(),
    val payments: List<BookingPayment> = emptyList(),
    val nextPayment: NextPayment? = null,
    val contract: BookingContract = BookingContract(),
    val album: BookingAlbum? = null,
    val detailsForClient: String? = null,
    val notesInternal: String? = null,
    val deliveredAt: String? = null,
    val unlockedAt: String? = null,
    val cancelledAt: String? = null,
    val cancelReason: String? = null,
    val createdAt: String? = null,
    val timeline: List<BookingTimelineEntry> = emptyList(),
    // client shape only
    val paymentInstructions: PaymentInstructions? = null,
    // only on the send response
    val emailSent: Boolean? = null,
) {
    val cancelled: Boolean get() = status == "cancelled"
}

@Serializable
data class MyInvoice(
    val bookingNumber: String,
    val invoiceNumber: String = "",
    val eventType: String? = null,
    val eventDate: String? = null,
    val issuedAt: String? = null,
    val totalCents: Long = 0,
    val paidCents: Long = 0,
    val balanceCents: Long = 0,
    // due, open, paid, cancelled
    val status: String = "open",
    val nextPayment: NextPayment? = null,
)
