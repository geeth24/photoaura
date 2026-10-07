//
//  BookingModels.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 10/6/26.
//
//  Shapes from server/routers/bookings/bookings_router.py. Money is integer
//  cents everywhere; timestamps are UTC ISO strings ending in Z.
//

import Foundation

enum BookingStatus: String, Decodable, Hashable, CaseIterable {
    case draft, sent, signed, booked
    case eventComplete = "event_complete"
    case delivered, paid, cancelled
    case unknown

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = BookingStatus(rawValue: raw) ?? .unknown
    }
}

// the final payment and any extra charges come back as one "Final payment" line
struct NextPayment: Decodable, Hashable {
    let kind: String
    let label: String
    let amountCents: Int
    // due now, as opposed to upcoming
    let due: Bool

    var isClosing: Bool { kind == "final" || kind == "extra" }
}

struct BookingPayment: Decodable, Hashable, Identifiable {
    let id: Int
    let kind: String
    let label: String
    let percent: Int?
    let amountCents: Int
    let state: String
    let receivedCents: Int
    let receivedAt: String?
    let method: String?
    let note: String?

    var isExtra: Bool { kind == "extra" }
    var outstandingCents: Int { max(0, amountCents - receivedCents) }
}

struct BookingClient: Decodable, Hashable {
    let userId: Int?
    let fullName: String
    let email: String
    let phone: String?

    var firstName: String { fullName.split(separator: " ").first.map(String.init) ?? fullName }
}

struct BookingEvent: Decodable, Hashable {
    let type: String?
    let date: String?
    let startTime: String?
    let endTime: String?
    let location: String?
}

struct BookingPackage: Decodable, Hashable {
    let key: String?
    let name: String?
    let includesVideo: Bool
    let revisions: Int?
    let hours: Double?
    let hourlyRateCents: Int?
    let overtimeRateCents: Int?
    let feeOverridden: Bool?
}

struct BookingMoney: Decodable, Hashable {
    let totalFee: Int
    let extras: Int
    let totalDue: Int
    let paid: Int
    let balance: Int
}

struct BookingContract: Decodable, Hashable {
    let version: String?
    let hash: String?
    let sentAt: String?
    let signed: Bool
    let signedAt: String?
    let signedName: String?
    let signedIp: String?
    let pdfUrl: String?
    // the snapshot that was sent / signed; null on a draft
    let markdown: String?
}

struct BookingAlbum: Decodable, Hashable {
    let id: Int?
    let slug: String
    let name: String
    let locked: Bool
}

struct BookingTimelineEntry: Decodable, Hashable {
    let at: String?
    let label: String
}

struct PaymentInstructions: Decodable, Hashable {
    let zelle: String
    let zellePhone: String?
    let memo: String
    let methods: [String]?
}

// GET /api/me/bookings/{n} (client) and GET /api/bookings/{n} (admin)
struct Booking: Decodable, Hashable, Identifiable {
    let number: String
    let status: BookingStatus
    let client: BookingClient
    let event: BookingEvent
    let package: BookingPackage
    let money: BookingMoney
    let payments: [BookingPayment]
    let nextPayment: NextPayment?
    let contract: BookingContract
    let album: BookingAlbum?
    let detailsForClient: String?
    let deliveredAt: String?
    let unlockedAt: String?
    let cancelledAt: String?
    let cancelReason: String?
    let createdAt: String?
    let timeline: [BookingTimelineEntry]
    // admin shape only
    let notesInternal: String?
    // client shape only
    let paymentInstructions: PaymentInstructions?
    // set on POST .../send when the invite email didn't go out
    let emailSent: Bool?

    var id: String { number }
    var eventType: String { event.type ?? "Event" }
    var stops: [String] { BookingFormat.stops(event.location) }
}

// GET /api/bookings — the studio's list
struct BookingSummary: Decodable, Hashable, Identifiable {
    struct Client: Decodable, Hashable {
        let userId: Int?
        let fullName: String
        let email: String
    }

    let number: String
    let status: BookingStatus
    let client: Client
    let eventType: String?
    let eventDate: String?
    let packageName: String?
    let totalDueCents: Int
    let paidCents: Int
    let nextPayment: NextPayment?
    let albumSlug: String?

    var id: String { number }
}

// GET /api/me/bookings — the client's own
struct MyBookingSummary: Decodable, Hashable, Identifiable {
    let number: String
    let status: BookingStatus
    let eventType: String?
    let eventDate: String?
    let packageName: String?
    let totalDueCents: Int
    let paidCents: Int
    let nextPayment: NextPayment?
    // "sign" | "pay" | nil
    let action: String?
    let balanceCents: Int?
    let albumSlug: String?

    var id: String { number }
}

// GET /api/me/invoices
struct MyInvoice: Decodable, Hashable, Identifiable {
    let bookingNumber: String
    let invoiceNumber: String
    let eventType: String?
    let eventDate: String?
    let issuedAt: String?
    let totalCents: Int
    let paidCents: Int
    let balanceCents: Int
    // "due" | "open" | "paid" | "cancelled"
    let status: String
    let nextPayment: NextPayment?

    var id: String { invoiceNumber }
}

/// Pushed onto a navigation stack to open one booking. The screen picks the
/// client or studio view from the signed-in role.
struct BookingRoute: Hashable {
    let number: String
}
