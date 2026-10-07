//
//  BookingEndpoints.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 10/6/26.
//
//  Paths mirror server/routers/bookings/bookings_router.py and
//  server/routers/places/places_router.py. Every studio mutation returns the
//  whole booking, so screens just swap it in.
//

import Foundation

extension APIClient {
    // MARK: - client

    // GET /api/me/bookings — includes `action` (sign / pay)
    func myBookings() async throws -> [MyBookingSummary] {
        try await get("/me/bookings")
    }

    // GET /api/me/bookings/{n}
    func myBooking(number: String) async throws -> Booking {
        try await get("/me/bookings/\(number)")
    }

    struct SignBody: Encodable {
        let fullName: String
        let consent: Bool
        let contractHash: String
        enum CodingKeys: String, CodingKey {
            case fullName = "full_name"
            case consent
            case contractHash = "contract_hash"
        }
    }

    // POST /api/me/bookings/{n}/sign — 409 when the agreement changed since it was opened
    func signBooking(number: String, fullName: String, contractHash: String) async throws -> Booking {
        try await post(
            "/me/bookings/\(number)/sign",
            body: SignBody(fullName: fullName, consent: true, contractHash: contractHash)
        )
    }

    // GET /api/me/invoices
    func myInvoices() async throws -> [MyInvoice] {
        try await get("/me/invoices")
    }

    // GET /api/me/bookings/{n}/invoice.pdf
    func myInvoicePDF(number: String) async throws -> Data {
        try await data("/me/bookings/\(number)/invoice.pdf")
    }

    // GET /api/bookings/{n}/contract.pdf — the booking's client may read it too;
    // preview renders an unsigned draft and is studio-only
    func contractPDF(number: String, preview: Bool = false) async throws -> Data {
        try await data(
            "/bookings/\(number)/contract.pdf",
            queryItems: preview ? [URLQueryItem(name: "preview", value: "1")] : []
        )
    }

    // GET /api/maps/static.png — a numbered pin per stop, any signed-in user
    func stopsMap(_ stops: [String], width: Int = 640, height: Int = 280) async throws -> Data {
        var items = stops.prefix(8).map { URLQueryItem(name: "stops", value: $0) }
        items.append(URLQueryItem(name: "w", value: String(width)))
        items.append(URLQueryItem(name: "h", value: String(height)))
        return try await data("/maps/static.png", queryItems: items)
    }

    // MARK: - studio

    // GET /api/bookings[?status=a,b]
    func bookings(status: String? = nil) async throws -> [BookingSummary] {
        try await get("/bookings", query: status.map { ["status": $0] } ?? [:])
    }

    // GET /api/bookings/{n}
    func booking(number: String) async throws -> Booking {
        try await get("/bookings/\(number)")
    }

    // POST /api/bookings/{n}/send — snapshot the contract and email the client
    func sendBooking(number: String) async throws -> Booking {
        try await post("/bookings/\(number)/send", body: Empty())
    }

    struct ReceiveBody: Encodable {
        let amountCents: Int
        let method: String
        let receivedAt: String
        let note: String?
        enum CodingKeys: String, CodingKey {
            case amountCents = "amount_cents"
            case method
            case receivedAt = "received_at"
            case note
        }
    }

    // POST /api/bookings/{n}/payments/{id}/receive — received_at is a plain YYYY-MM-DD
    func receivePayment(number: String, paymentId: Int, amountCents: Int, method: String, receivedOn: String, note: String?) async throws -> Booking {
        try await post(
            "/bookings/\(number)/payments/\(paymentId)/receive",
            body: ReceiveBody(amountCents: amountCents, method: method, receivedAt: receivedOn, note: note)
        )
    }

    // POST /api/bookings/{n}/payments/{id}/undo
    func undoPayment(number: String, paymentId: Int) async throws -> Booking {
        try await post("/bookings/\(number)/payments/\(paymentId)/undo", body: Empty())
    }

    struct ChargeBody: Encodable {
        let label: String
        let amountCents: Int
        enum CodingKeys: String, CodingKey {
            case label
            case amountCents = "amount_cents"
        }
    }

    // POST /api/bookings/{n}/payments — an extra charge, due with the final payment
    func addCharge(number: String, label: String, amountCents: Int) async throws -> Booking {
        try await post("/bookings/\(number)/payments", body: ChargeBody(label: label, amountCents: amountCents))
    }

    // DELETE /api/bookings/{n}/payments/{id} — unpaid extras only
    func removeCharge(number: String, paymentId: Int) async throws -> Booking {
        try await delete("/bookings/\(number)/payments/\(paymentId)")
    }

    // POST /api/bookings/{n}/delivered
    func markDelivered(number: String) async throws -> Booking {
        try await post("/bookings/\(number)/delivered", body: Empty())
    }

    // GET /api/bookings/{n}/invoice.pdf
    func invoicePDF(number: String) async throws -> Data {
        try await data("/bookings/\(number)/invoice.pdf")
    }
}
