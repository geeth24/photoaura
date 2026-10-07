//
//  InvoicesState.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 10/6/26.
//

import Foundation

struct InvoicesState {
    var invoices: [MyInvoice] = []
    var isLoading = false
    var hasLoadedOnce = false
    var error: String?

    // booking number of the PDF being fetched
    var opening: String?
    var document: PreviewDocument?
    var toast: BookingToast?

    // cancelled invoices are void, so they don't count toward what's owed
    private var live: [MyInvoice] { invoices.filter { $0.status != "cancelled" } }
    var billed: Int { live.reduce(0) { $0 + $1.totalCents } }
    var paid: Int { live.reduce(0) { $0 + $1.paidCents } }
    var balance: Int { live.reduce(0) { $0 + $1.balanceCents } }
}

enum InvoicesIntent {
    case load
    case refresh
    case loaded([MyInvoice])
    case loadFailed(String)

    case open(String)
    case documentReady(PreviewDocument)
    case documentFailed
    case dismissDocument
    case clearToast(UUID)
}
