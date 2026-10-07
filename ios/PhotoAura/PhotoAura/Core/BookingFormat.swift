//
//  BookingFormat.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 10/6/26.
//

import Foundation

/// Money, dates and wording for bookings, matching client/src/lib/bookings.ts.
enum BookingFormat {
    static let consentText = "I agree to sign this agreement electronically, and that typing my name below is my signature."
    static let studioEmail = "geeth@reactiveshots.com"
    static let zelle = "zelle@reactiveshots.com"
    static let zellePhone = "(972) 829-5173"

    // MARK: - money

    private static let usd: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = "USD"
        f.locale = Locale(identifier: "en_US")
        return f
    }()

    static func money(_ cents: Int?) -> String {
        usd.string(from: NSNumber(value: Double(cents ?? 0) / 100)) ?? "$0.00"
    }

    /// "1350.5" or "$1,350.50" → 135050. nil when it isn't a positive amount.
    static func cents(from text: String) -> Int? {
        let cleaned = text.replacingOccurrences(of: "[$,\\s]", with: "", options: .regularExpression)
        // the whole string has to be an amount; Decimal(string:) happily reads "12oops" as 12
        guard cleaned.range(of: #"^(\d+(\.\d{0,2})?|\.\d{1,2})$"#, options: .regularExpression) != nil else { return nil }
        let parts = cleaned.split(separator: ".", omittingEmptySubsequences: false)
        // a dollar figure too big for Int must fail, not quietly become 0
        guard let dollars = Int(parts[0].isEmpty ? "0" : String(parts[0])) else { return nil }
        let fraction = parts.count > 1 ? String(parts[1]).padding(toLength: 2, withPad: "0", startingAt: 0) : "00"
        guard let cents = Int(fraction), dollars < Int.max / 100 else { return nil }
        let total = dollars * 100 + cents
        return total > 0 ? total : nil
    }

    static func amountText(_ cents: Int) -> String {
        String(format: "%.2f", Double(cents) / 100)
    }

    // MARK: - dates

    // "2026-11-14" is a calendar day, not an instant; parse it local so it never slips a day
    static func parseDay(_ s: String?) -> Date? {
        guard let s, s.count >= 10 else { return nil }
        let parts = s.prefix(10).split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return Calendar.current.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
    }

    enum DayStyle { case long, short }

    static func day(_ s: String?, _ style: DayStyle = .long) -> String {
        guard let d = parseDay(s) else { return s ?? "" }
        switch style {
        case .long: return d.formatted(.dateTime.weekday(.wide).month(.wide).day().year())
        case .short: return d.formatted(.dateTime.month(.abbreviated).day().year())
        }
    }

    /// "17:00" → "5:00 PM".
    static func time(_ s: String?) -> String {
        guard let s else { return "" }
        let bits = s.split(separator: ":").compactMap { Int($0) }
        guard bits.count >= 2 else { return s }
        let h = bits[0]
        return "\(h % 12 == 0 ? 12 : h % 12):\(String(format: "%02d", bits[1])) \(h < 12 ? "AM" : "PM")"
    }

    static func timeRange(_ start: String?, _ end: String?) -> String {
        let a = time(start), b = time(end)
        if a.isEmpty && b.isEmpty { return "TBD" }
        return "\(a) – \(b)"
    }

    /// A server timestamp in the device's local time.
    static func stamp(_ iso: String?) -> String {
        guard let d = ServerDate.parse(iso) else { return "" }
        return d.formatted(.dateTime.month(.abbreviated).day().year().hour().minute())
    }

    static func shortDate(_ iso: String?) -> String {
        guard let d = ServerDate.parse(iso) else { return "" }
        return d.formatted(.dateTime.month(.abbreviated).day().year())
    }

    static func daysUntil(_ s: String?) -> Int? {
        guard let d = parseDay(s) else { return nil }
        let today = Calendar.current.startOfDay(for: .now)
        return Calendar.current.dateComponents([.day], from: today, to: d).day
    }

    /// "YYYY-MM-DD" for a local calendar day, the way the receive endpoint wants it.
    static func isoDay(_ date: Date) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    // MARK: - status

    static func statusLabel(_ s: BookingStatus) -> String {
        switch s {
        case .draft: return "Draft"
        case .sent: return "Awaiting signature"
        case .signed: return "Awaiting retainer"
        case .booked: return "Booked"
        case .eventComplete: return "Event complete"
        case .delivered: return "Final due"
        case .paid: return "Paid in full"
        case .cancelled: return "Cancelled"
        case .unknown: return "Booking"
        }
    }

    // steps the client sees; the count is how many are done for each status
    static let clientSteps = ["Signed", "Date secured", "Event day", "Gallery delivered", "Paid in full"]

    static func stepsDone(_ s: BookingStatus) -> Int {
        switch s {
        case .draft, .sent, .cancelled, .unknown: return 0
        case .signed: return 1
        case .booked: return 2
        case .eventComplete: return 3
        case .delivered: return 4
        case .paid: return 5
        }
    }

    static func methodLabel(_ m: String?) -> String? {
        switch m {
        case "zelle": return "Zelle"
        case "cash": return "Cash"
        case "check": return "Check"
        case "other": return "Other"
        default: return nil
        }
    }

    static func revisionsText(_ n: Int?) -> String {
        let n = n ?? 0
        return "\(n) revision \(n == 1 ? "round" : "rounds")"
    }

    static func hoursText(_ h: Double?) -> String? {
        guard let h else { return nil }
        return h == h.rounded() ? "\(Int(h))" : String(format: "%g", h)
    }

    // MARK: - overtime

    // the contract gives the first 15 minutes free, then bills in 30-minute blocks
    static let overtimeBlocks = [30, 60, 90, 120]

    static func minutesLabel(_ m: Int) -> String {
        if m < 60 { return "\(m) min" }
        let h = Double(m) / 60
        let n = h == h.rounded() ? "\(Int(h))" : String(format: "%g", h)
        return "\(n) \(m == 60 ? "hr" : "hrs")"
    }

    // MARK: - locations

    // several stops are stored one per line
    static func stops(_ location: String?) -> [String] {
        (location ?? "").split(separator: "\n").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
    }

    static func appleMapsURL(_ stop: String) -> URL? {
        var c = URLComponents(string: "https://maps.apple.com/")
        c?.queryItems = [URLQueryItem(name: "q", value: stop)]
        return c?.url
    }

    /// Driving directions through every stop. Apple Maps links only take one
    /// destination, so a multi-stop route goes through Google Maps like the web.
    static func directionsURL(_ stops: [String]) -> URL? {
        guard let last = stops.last else { return nil }
        if stops.count == 1 {
            var c = URLComponents(string: "https://maps.apple.com/")
            c?.queryItems = [URLQueryItem(name: "daddr", value: last), URLQueryItem(name: "dirflg", value: "d")]
            return c?.url
        }
        var c = URLComponents(string: "https://www.google.com/maps/dir/")
        c?.queryItems = [
            URLQueryItem(name: "api", value: "1"),
            URLQueryItem(name: "destination", value: last),
            URLQueryItem(name: "waypoints", value: stops.dropLast().joined(separator: "|")),
        ]
        return c?.url
    }
}
