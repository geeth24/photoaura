//
//  BookingsView.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 10/6/26.
//

import SwiftUI
import EditorialStyle

/// The client's Bookings tab: their bookings, with invoices one tap over,
/// so the web's two nav items share a single tab.
struct ClientBookingsView: View {
    let store: BookingsStore
    @State private var pane: Pane = .bookings

    enum Pane: Hashable { case bookings, invoices }

    var body: some View {
        ZStack {
            EditorialColors.background.ignoresSafeArea()
            VStack(spacing: 0) {
                EditorialSegmentedControl(
                    items: [("Bookings", Pane.bookings), ("Invoices", Pane.invoices)],
                    selection: $pane
                )
                .padding(.horizontal, EditorialSpacing.screenGutter)
                .padding(.top, EditorialSpacing.xSmall)
                .padding(.bottom, EditorialSpacing.small)

                switch pane {
                case .bookings: BookingsList(store: store)
                case .invoices: InvoicesView()
                }
            }
        }
        .navigationTitle(pane == .bookings ? "Bookings" : "Invoices")
        .navigationBarTitleDisplayMode(.large)
    }
}

private struct BookingsList: View {
    let store: BookingsStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: EditorialSpacing.xLarge) {
                if !store.state.bookings.isEmpty {
                    EditorialSectionHeader(
                        eyebrow: "Your bookings",
                        subtitle: "\(store.state.upcoming.count) upcoming · \(store.state.past.count) past"
                    )
                }
                content
            }
            .padding(.horizontal, EditorialSpacing.screenGutter)
            .padding(.top, EditorialSpacing.small)
            .padding(.bottom, EditorialSpacing.xxxLarge)
        }
        .refreshable { store.send(.refresh) }
    }

    @ViewBuilder
    private var content: some View {
        if store.state.isLoading && !store.state.hasLoadedOnce {
            VStack(spacing: 12) {
                EditorialSkeleton(height: 150)
                EditorialSkeleton(height: 150)
            }
        } else if let err = store.state.error, store.state.bookings.isEmpty {
            EditorialEmptyState(
                systemImage: "exclamationmark.triangle",
                title: "Couldn't load",
                subtitle: err,
                actionTitle: "Try again"
            ) { store.send(.refresh) }
        } else if store.state.bookings.isEmpty {
            EditorialEmptyState(
                systemImage: "calendar.badge.exclamationmark",
                title: "No bookings yet",
                subtitle: "When your photographer sends an agreement, it shows up here."
            )
        } else {
            group("Upcoming", store.state.upcoming)
            group("Past", store.state.past)
        }
    }

    @ViewBuilder
    private func group(_ title: String, _ rows: [MyBookingSummary]) -> some View {
        if !rows.isEmpty {
            VStack(alignment: .leading, spacing: EditorialSpacing.small) {
                EditorialEyebrow(title, color: EditorialColors.textMuted)
                ForEach(rows) { b in
                    NavigationLink(value: BookingRoute(number: b.number)) {
                        ClientBookingCard(booking: b)
                    }
                    .buttonStyle(EditorialPressStyle())
                }
            }
        }
    }
}

private struct ClientBookingCard: View {
    let booking: MyBookingSummary

    var body: some View {
        VStack(alignment: .leading, spacing: EditorialSpacing.medium) {
            HStack(alignment: .top, spacing: EditorialSpacing.small) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(booking.number)
                        .font(EditorialTypography.sans(size: 10, weight: .medium))
                        .tracking(2.5)
                        .foregroundStyle(EditorialColors.textMuted)
                    Text(booking.eventType ?? "Booking")
                        .font(EditorialTypography.serif(size: 24))
                        .foregroundStyle(EditorialColors.textPrimary)
                    Text(BookingFormat.day(booking.eventDate))
                        .font(EditorialTypography.sans(size: EditorialTypography.Size.caption))
                        .foregroundStyle(EditorialColors.textSecondary)
                }
                Spacer(minLength: 0)
                BookingStatusBadge(status: booking.status)
            }
            HStack(alignment: .bottom) {
                Text(footer)
                    .font(EditorialTypography.sans(size: EditorialTypography.Size.caption))
                    .foregroundStyle(booking.action != nil ? EditorialColors.brand : EditorialColors.textMuted)
                    .multilineTextAlignment(.leading)
                Spacer(minLength: 8)
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 13))
                    .foregroundStyle(EditorialColors.textFaint)
            }
            .padding(.top, EditorialSpacing.small)
            .overlay(alignment: .top) {
                Rectangle().fill(EditorialColors.borderSubtle).frame(height: 1)
            }
        }
        .padding(EditorialSpacing.medium)
        .background(EditorialColors.surfaceElevated)
        .overlay(Rectangle().stroke(EditorialColors.borderSubtle, lineWidth: 1))
    }

    private var footer: String {
        if booking.status == .cancelled { return "This booking was cancelled" }
        if booking.action == "sign" { return "Review and sign your agreement" }
        if let next = booking.nextPayment {
            return "\(next.label) · \(BookingFormat.money(next.amountCents))\(next.due ? " due now" : "")"
        }
        return "\(BookingFormat.money(booking.paidCents)) of \(BookingFormat.money(booking.totalDueCents)) paid"
    }
}

/// The home's booking card: sign, pay, or what's coming up.
struct HomeBookingCard: View {
    let booking: MyBookingSummary

    var body: some View {
        NavigationLink(value: BookingRoute(number: booking.number)) {
            VStack(alignment: .leading, spacing: EditorialSpacing.medium) {
                HStack(alignment: .top, spacing: EditorialSpacing.medium) {
                    Image(systemName: view.icon)
                        .font(.system(size: 18))
                        .foregroundStyle(EditorialColors.brand)
                        .frame(width: 46, height: 46)
                        .background(EditorialColors.brand.opacity(0.1))
                    VStack(alignment: .leading, spacing: 6) {
                        Text(view.eyebrow)
                            .font(EditorialTypography.sans(size: 10, weight: .medium))
                            .tracking(3)
                            .textCase(.uppercase)
                            .foregroundStyle(EditorialColors.brand)
                        Text(view.title)
                            .font(EditorialTypography.serif(size: 25))
                            .foregroundStyle(EditorialColors.textPrimary)
                            .fixedSize(horizontal: false, vertical: true)
                        Text(view.body)
                            .font(EditorialTypography.sans(size: EditorialTypography.Size.caption))
                            .foregroundStyle(EditorialColors.textSecondary)
                            .lineSpacing(EditorialTypography.LineSpacing.hint)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                HStack(spacing: 8) {
                    Text(view.cta)
                        .font(.system(size: 12, weight: .bold))
                        .tracking(EditorialTypography.Tracking.button)
                        .textCase(.uppercase)
                    Image(systemName: "arrow.up.right").font(.system(size: 11, weight: .bold))
                }
                .foregroundStyle(urgent ? EditorialColors.background : EditorialColors.textSecondary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(urgent ? EditorialColors.brand : .clear)
                .overlay(Rectangle().stroke(urgent ? .clear : EditorialColors.borderDefault, lineWidth: 1))
            }
            .padding(EditorialSpacing.large)
            .background(EditorialColors.surfaceElevated)
            .overlay(Rectangle().stroke(EditorialColors.borderSubtle, lineWidth: 1))
            .overlay(alignment: .leading) {
                Rectangle().fill(EditorialColors.brand).frame(width: 2)
            }
        }
        .buttonStyle(EditorialPressStyle())
    }

    private var urgent: Bool { booking.action != nil }

    private var view: (icon: String, eyebrow: String, title: String, body: String, cta: String) {
        let event = "\(booking.eventType ?? "Your event") · \(BookingFormat.day(booking.eventDate))"
        if booking.action == "sign" {
            return ("signature", "Action needed", "Review and sign your agreement",
                    "\(event). Your date is held once it's signed and the retainer arrives.", "Review & sign")
        }
        if booking.action == "pay", let next = booking.nextPayment {
            return ("doc.text", "Payment due", "\(next.label) · \(BookingFormat.money(next.amountCents))",
                    "\(event). Zelle, cash, or check.", "How to pay")
        }
        let n = BookingFormat.daysUntil(booking.eventDate)
        let when = n.map { $0 == 0 ? "Today" : $0 == 1 ? "Tomorrow" : $0 > 1 ? "In \($0) days" : "" } ?? ""
        return ("calendar", when.isEmpty ? "Coming up" : "Coming up · \(when)", booking.eventType ?? "Your event",
                "\(BookingFormat.day(booking.eventDate)) · \(booking.packageName ?? "")", "View booking")
    }
}
