//
//  BookingsState.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 10/6/26.
//

import Foundation

/// The client's own bookings, for the Bookings tab and its badge.
struct BookingsState {
    var bookings: [MyBookingSummary] = []
    var isLoading = false
    var hasLoadedOnce = false
    var error: String?

    // upcoming soonest first; past (and cancelled) most recent first
    var upcoming: [MyBookingSummary] {
        bookings.filter { !isPast($0) }.sorted { ($0.eventDate ?? "") < ($1.eventDate ?? "") }
    }

    var past: [MyBookingSummary] {
        bookings.filter(isPast).sorted { ($0.eventDate ?? "") > ($1.eventDate ?? "") }
    }

    // something to sign or pay; drives the tab badge
    var actionCount: Int { bookings.filter { $0.action != nil }.count }

    private func isPast(_ b: MyBookingSummary) -> Bool {
        if b.status == .cancelled { return true }
        guard let day = BookingFormat.parseDay(b.eventDate) else { return false }
        return day < Calendar.current.startOfDay(for: .now)
    }
}

enum BookingsIntent {
    case load
    case refresh
    case loaded([MyBookingSummary])
    case loadFailed(String)
}

extension Array where Element == MyBookingSummary {
    /// The booking worth surfacing on home: something to sign, then something
    /// to pay, then the next event.
    var homeBooking: MyBookingSummary? {
        let today = Calendar.current.startOfDay(for: .now)
        let upcoming = filter {
            $0.status != .cancelled && $0.status != .draft && (BookingFormat.parseDay($0.eventDate) ?? today) >= today
        }
        .sorted { ($0.eventDate ?? "") < ($1.eventDate ?? "") }
        return first { $0.action == "sign" } ?? first { $0.action == "pay" } ?? upcoming.first
    }
}
