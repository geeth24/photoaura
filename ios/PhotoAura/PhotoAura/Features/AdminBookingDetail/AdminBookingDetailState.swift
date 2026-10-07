//
//  AdminBookingDetailState.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 10/6/26.
//

import UIKit

/// One booking as the studio runs it: send, take payments, deliver.
struct AdminBookingDetailState {
    let number: String

    var booking: Booking?
    var isLoading = false
    var hasLoadedOnce = false
    var error: String?

    var map: UIImage?
    var mapLoading = false
    var mapStops: [String] = []

    // which action is in flight, so only its button spins
    var busy: AdminBookingAction?
    // bumped after each successful change so an open sheet knows to close
    var completed = 0

    var openingDocument: BookingDocument?
    var document: PreviewDocument?
    var toast: BookingToast?

    var isCancelled: Bool { booking?.status == .cancelled }
    var canSend: Bool { booking?.status == .draft || booking?.status == .sent }
    var canDeliver: Bool {
        guard let b = booking else { return false }
        return (b.status == .booked || b.status == .eventComplete) && b.album != nil
    }
    // extras still open plus the final, what the client is asked for on delivery
    var finalDue: Int {
        booking?.payments.filter { $0.kind == "final" || $0.kind == "extra" }.reduce(0) { $0 + $1.amountCents - $1.receivedCents } ?? 0
    }
}

enum AdminBookingAction: Hashable {
    case send
    case receive(Int)
    case undo(Int)
    case addCharge
    case removeCharge(Int)
    case deliver
}

enum AdminBookingDetailIntent {
    case load
    case refresh
    case loaded(Booking)
    case loadFailed(String)
    case mapLoaded([String], UIImage?)

    case send
    case receive(payment: BookingPayment, amountCents: Int, method: String, day: Date, note: String)
    case undo(BookingPayment)
    case addCharge(label: String, amountCents: Int, overtime: Bool)
    case removeCharge(BookingPayment)
    case deliver
    case changed(Booking, message: String)
    case changeFailed(String)

    case openDocument(BookingDocument)
    case documentReady(PreviewDocument)
    case documentFailed(String)
    case dismissDocument

    case showToast(BookingToast)
    case clearToast(UUID)
}
