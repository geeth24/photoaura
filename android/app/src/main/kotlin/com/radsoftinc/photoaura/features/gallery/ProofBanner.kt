package com.radsoftinc.photoaura.features.gallery

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Modifier
import com.radsoftinc.editorialstyle.EditorialCallout
import com.radsoftinc.editorialstyle.EditorialTextLink
import com.radsoftinc.photoaura.core.Api
import com.radsoftinc.photoaura.core.BookingSummary
import com.radsoftinc.photoaura.features.bookings.money

/** Shown on a proof-locked album; the studio sees the same thing in its own words. */
@Composable
fun ProofBanner(
    bookingNumber: String?,
    albumSlug: String,
    studio: Boolean,
    onOpenBooking: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    // the album only says it's locked; the client's own booking knows what's left to pay
    val mine by produceState<BookingSummary?>(null, bookingNumber, albumSlug, studio) {
        if (!studio) {
            value = runCatching { Api.myBookings() }.getOrNull()
                ?.firstOrNull { it.number == bookingNumber || it.albumSlug == albumSlug }
        }
    }
    val number = mine?.number ?: bookingNumber
    val amount = mine?.nextPayment?.takeIf { it.closing }?.amountCents
    EditorialCallout(
        modifier,
        icon = Icons.Outlined.Lock,
        title = if (studio) {
            "Gallery preview — the client's full-resolution downloads unlock when the final payment is marked received."
        } else {
            "Gallery preview — full-resolution downloads unlock after your final payment${amount?.let { " (${money(it)})" } ?: ""}."
        },
        message = if (studio) "Downloads are off for everyone until then." else "Until then you're seeing watermarked previews.",
    ) {
        if (number != null) {
            EditorialTextLink(
                if (studio) "Booking $number" else "View booking",
                { onOpenBooking(number) },
                icon = Icons.AutoMirrored.Outlined.ArrowForward,
            )
        }
    }
}
