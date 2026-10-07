//
//  BookingParts.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 10/6/26.
//
//  Pieces the client and studio booking screens share.
//

import SwiftUI
import EditorialStyle

struct BookingStatusBadge: View {
    let status: BookingStatus

    var body: some View {
        EditorialBadge(BookingFormat.statusLabel(status), tone: tone)
    }

    // brand = waiting on someone, quiet = in hand, filled = done
    private var tone: EditorialBadgeTone {
        switch status {
        case .draft: return .muted
        case .sent, .signed, .delivered: return .brand
        case .booked, .eventComplete, .unknown: return .neutral
        case .paid: return .filled
        case .cancelled: return .danger
        }
    }
}

struct PaymentStateBadge: View {
    let state: String

    var body: some View {
        switch state {
        case "paid": EditorialBadge("Paid", tone: .neutral, icon: "checkmark")
        case "due": EditorialBadge("Due", tone: .brand)
        default: EditorialBadge("Upcoming", tone: .muted)
        }
    }
}

struct InvoiceStatusBadge: View {
    let status: String

    var body: some View {
        switch status {
        case "due": EditorialBadge("Payment due", tone: .brand)
        case "paid": EditorialBadge("Paid in full", tone: .filled)
        case "cancelled": EditorialBadge("Cancelled", tone: .danger)
        default: EditorialBadge("Open", tone: .neutral)
        }
    }
}

/// The eyebrow with the short brand rule in front, used above every booking section.
struct BookingEyebrow: View {
    let text: String

    var body: some View {
        HStack(spacing: EditorialSpacing.small) {
            Rectangle().fill(EditorialColors.brand).frame(width: 48, height: 1)
            Text(text).editorialEyebrow(color: EditorialColors.textMuted)
        }
    }
}

// MARK: - locations

/// Each stop opens in Apple Maps, numbered when there's more than one, plus directions.
struct StopsList: View {
    let stops: [String]

    var body: some View {
        if stops.isEmpty {
            Text("TBD").foregroundStyle(EditorialColors.textMuted)
        } else {
            VStack(alignment: .leading, spacing: 10) {
                ForEach(Array(stops.enumerated()), id: \.offset) { i, stop in
                    if let url = BookingFormat.appleMapsURL(stop) {
                        Link(destination: url) {
                            HStack(alignment: .top, spacing: 8) {
                                if stops.count > 1 {
                                    Text("\(i + 1)")
                                        .font(EditorialTypography.sans(size: 10, weight: .semibold))
                                        .foregroundStyle(EditorialColors.background)
                                        .frame(width: 18, height: 18)
                                        .background(EditorialColors.brand)
                                        .padding(.top, 1)
                                }
                                Text(stop)
                                    .foregroundStyle(EditorialColors.textPrimary)
                                    .multilineTextAlignment(.leading)
                                Spacer(minLength: 0)
                                Image(systemName: "map")
                                    .font(.system(size: 12))
                                    .foregroundStyle(EditorialColors.textFaint)
                                    .padding(.top, 3)
                            }
                        }
                        .accessibilityLabel("Stop \(i + 1), \(stop). Opens in Maps")
                    }
                }
                if let url = BookingFormat.directionsURL(stops) {
                    Link(destination: url) {
                        HStack(spacing: 5) {
                            Text("Get directions")
                            Image(systemName: "arrow.up.right")
                                .font(.system(size: 9, weight: .bold))
                        }
                        .font(EditorialTypography.sans(size: 10, weight: .medium))
                        .tracking(2)
                        .textCase(.uppercase)
                        .foregroundStyle(EditorialColors.brand)
                    }
                    .padding(.top, 2)
                }
            }
        }
    }
}

/// The server's dark map with a numbered pin per stop.
struct StopsMap: View {
    let image: UIImage?
    let loading: Bool

    var body: some View {
        if image != nil || loading {
            EditorialColors.surfaceElevated
                .aspectRatio(640 / 280, contentMode: .fit)
                .overlay {
                    if let image {
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFill()
                            .accessibilityLabel("Map of the event locations")
                    } else {
                        EditorialSkeleton(aspect: 640 / 280)
                    }
                }
                .clipped()
                .overlay(Rectangle().stroke(EditorialColors.borderSubtle, lineWidth: 1))
        }
    }
}

/// Event, date, time, every stop, package and what it includes, then the map.
struct EventFacts: View {
    let booking: Booking
    let map: UIImage?
    let mapLoading: Bool
    // the studio also sees the overtime rate
    var showsOvertime = false

    var body: some View {
        VStack(spacing: 0) {
            VStack(spacing: 1) {
                EditorialFactRow("Event", booking.eventType)
                EditorialFactRow("Date", BookingFormat.day(booking.event.date))
                EditorialFactRow("Time", BookingFormat.timeRange(booking.event.startTime, booking.event.endTime))
                EditorialFactRow("Location") { StopsList(stops: booking.stops) }
                EditorialFactRow("Package", packageText)
                EditorialFactRow("Includes", includesText)
            }
            .background(EditorialColors.borderSubtle)
            .overlay(Rectangle().stroke(EditorialColors.borderSubtle, lineWidth: 1))

            StopsMap(image: map, loading: mapLoading)
        }
    }

    private var packageText: String {
        var s = booking.package.name ?? "Custom package"
        if let h = BookingFormat.hoursText(booking.package.hours) { s += ", \(h) hours" }
        return s
    }

    private var includesText: String {
        var s = "\(booking.package.includesVideo ? "Photos + video" : "Photos") · \(BookingFormat.revisionsText(booking.package.revisions))"
        if showsOvertime, let rate = booking.package.overtimeRateCents, rate > 0 {
            s += " · overtime \(BookingFormat.money(rate / 2))/30 min after 15 free"
        }
        return s
    }
}

// MARK: - payments

/// The payment schedule, one row per line, with optional studio actions.
struct PaymentsList<Actions: View>: View {
    let payments: [BookingPayment]
    @ViewBuilder var actions: (BookingPayment) -> Actions

    var body: some View {
        VStack(spacing: 0) {
            ForEach(payments) { p in
                VStack(alignment: .leading, spacing: 10) {
                    HStack(alignment: .firstTextBaseline, spacing: EditorialSpacing.small) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(p.label)
                                .font(EditorialTypography.sans(size: EditorialTypography.Size.subtitle))
                                .foregroundStyle(EditorialColors.textPrimary)
                            Text(p.percent.map { "\($0)% of the fee" } ?? "Added to the final payment")
                                .font(EditorialTypography.sans(size: 11))
                                .foregroundStyle(EditorialColors.textFaint)
                        }
                        Spacer(minLength: 8)
                        Text(BookingFormat.money(p.amountCents))
                            .font(EditorialTypography.serif(size: 19))
                            .monospacedDigit()
                            .foregroundStyle(EditorialColors.textPrimary)
                    }
                    HStack(alignment: .center, spacing: EditorialSpacing.small) {
                        PaymentStateBadge(state: p.state)
                        VStack(alignment: .leading, spacing: 2) {
                            if let r = receivedText(p) {
                                Text(r)
                                    .font(EditorialTypography.sans(size: EditorialTypography.Size.hint))
                                    .foregroundStyle(EditorialColors.textSecondary)
                            }
                            if let note = p.note, !note.isEmpty {
                                Text(note)
                                    .font(EditorialTypography.sans(size: 11))
                                    .foregroundStyle(EditorialColors.textFaint)
                                    .lineLimit(1)
                            }
                        }
                        Spacer(minLength: 0)
                        actions(p)
                    }
                }
                .padding(.vertical, 14)
                .overlay(alignment: .bottom) {
                    if p.id != payments.last?.id {
                        Rectangle().fill(EditorialColors.borderSubtle).frame(height: 1)
                    }
                }
            }
        }
        .overlay(alignment: .top) { Rectangle().fill(EditorialColors.borderSubtle).frame(height: 1) }
        .overlay(alignment: .bottom) { Rectangle().fill(EditorialColors.borderSubtle).frame(height: 1) }
    }

    private func receivedText(_ p: BookingPayment) -> String? {
        guard p.receivedCents > 0 else { return nil }
        var bits: [String] = []
        if p.receivedCents < p.amountCents { bits.append("\(BookingFormat.money(p.receivedCents)) received") }
        let day = BookingFormat.shortDate(p.receivedAt)
        if !day.isEmpty { bits.append(day) }
        if let m = BookingFormat.methodLabel(p.method) { bits.append(m) }
        return bits.joined(separator: " · ")
    }
}

extension PaymentsList where Actions == EmptyView {
    init(payments: [BookingPayment]) {
        self.payments = payments
        self.actions = { _ in EmptyView() }
    }
}

// MARK: - toast

extension View {
    /// Floats the store's latest confirmation over the top of the screen.
    func bookingToast(_ toast: BookingToast?) -> some View {
        overlay(alignment: .top) {
            if let toast {
                EditorialToast(toast.message, tone: toast.isError ? .error : .success)
                    .padding(.top, EditorialSpacing.xSmall)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .id(toast.id)
            }
        }
        .animation(.smooth(duration: 0.25), value: toast)
    }
}

struct BookingToast: Hashable {
    let id = UUID()
    let message: String
    var isError = false
}
