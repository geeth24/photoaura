//
//  AdminBookingsState.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 10/6/26.
//

import Foundation

/// Every booking, for the studio, filtered by where it stands.
struct AdminBookingsState {
    var rows: [BookingSummary] = []
    var filter: BookingFilter = .active
    var isLoading = false
    var hasLoadedOnce = false
    var error: String?

    var shown: [BookingSummary] { rows.filter { filter.matches($0.status) } }

    func count(_ f: BookingFilter) -> Int { rows.filter { f.matches($0.status) }.count }
}

enum BookingFilter: String, CaseIterable, Hashable {
    case active, action, draft, paid, cancelled, all

    var label: String {
        switch self {
        case .active: return "Active"
        case .action: return "Awaiting client"
        case .draft: return "Drafts"
        case .paid: return "Paid"
        case .cancelled: return "Cancelled"
        case .all: return "All"
        }
    }

    func matches(_ s: BookingStatus) -> Bool {
        switch self {
        case .active: return s != .paid && s != .cancelled
        case .action: return s == .sent || s == .signed || s == .delivered
        case .draft: return s == .draft
        case .paid: return s == .paid
        case .cancelled: return s == .cancelled
        case .all: return true
        }
    }
}

enum AdminBookingsIntent {
    case load
    case refresh
    case loaded([BookingSummary])
    case loadFailed(String)
    case setFilter(BookingFilter)
}
