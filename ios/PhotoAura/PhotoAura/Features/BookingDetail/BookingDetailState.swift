//
//  BookingDetailState.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 10/6/26.
//

import UIKit

/// One booking as its client sees it: review and sign, then pay and download.
struct BookingDetailState {
    let number: String

    var booking: Booking?
    var isLoading = false
    var hasLoadedOnce = false
    var error: String?
    var notFound = false

    var map: UIImage?
    var mapLoading = false
    var mapStops: [String] = []

    // signing
    var signName = ""
    var consent = false
    var signing = false
    // the agreement changed while it was open; they have to read the new one
    var stale = false

    var openingDocument: BookingDocument?
    var document: PreviewDocument?
    var toast: BookingToast?

    var canSign: Bool {
        guard let c = booking?.contract else { return false }
        return !signName.trimmingCharacters(in: .whitespaces).isEmpty && consent && c.hash != nil && c.markdown != nil && !signing
    }
}

enum BookingDocument: Hashable {
    case contract
    case invoice
}

enum BookingDetailIntent {
    case load
    case refresh
    case loaded(Booking)
    case loadFailed(String, notFound: Bool)
    case mapLoaded([String], UIImage?)

    case nameChanged(String)
    case consentChanged(Bool)
    case sign
    case signed(Booking)
    case signFailed(String)
    case contractChanged

    case openDocument(BookingDocument)
    case documentReady(PreviewDocument)
    case documentFailed(String)
    case dismissDocument

    case showToast(BookingToast)
    case clearToast(UUID)
}
