//
//  AdminBookingsView.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 10/6/26.
//

import SwiftUI
import EditorialStyle

/// The studio's Bookings tab. New bookings are still made on the web.
struct AdminBookingsView: View {
    @Environment(APIClient.self) private var api
    @State private var store: AdminBookingsStore?

    var body: some View {
        Group {
            if let store {
                AdminBookingsContent(store: store)
            } else {
                Color.clear
            }
        }
        .onAppear {
            if let store {
                // back from a booking that may have changed
                store.send(.refresh)
            } else {
                let s = AdminBookingsStore(api: api)
                store = s
                s.send(.load)
            }
        }
        .navigationTitle("Bookings")
        .navigationBarTitleDisplayMode(.large)
    }
}

private struct AdminBookingsContent: View {
    let store: AdminBookingsStore
    @Environment(StudioRegistry.self) private var studios

    var body: some View {
        ZStack {
            EditorialColors.background.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: EditorialSpacing.large) {
                    VStack(alignment: .leading, spacing: EditorialSpacing.small) {
                        EditorialSectionHeader(eyebrow: "Clients", subtitle: subtitle)
                        Link(destination: newBookingURL) {
                            HStack(spacing: 6) {
                                Image(systemName: "plus").font(.system(size: 10, weight: .bold))
                                Text("New booking on the web")
                                Image(systemName: "arrow.up.right").font(.system(size: 9, weight: .bold))
                            }
                            .font(EditorialTypography.sans(size: 10, weight: .medium))
                            .tracking(2)
                            .textCase(.uppercase)
                            .foregroundStyle(EditorialColors.brand)
                        }
                    }
                    .padding(.horizontal, EditorialSpacing.screenGutter)

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(BookingFilter.allCases, id: \.self) { f in
                                EditorialFilterChip(
                                    f.label,
                                    count: store.state.hasLoadedOnce ? store.state.count(f) : nil,
                                    isActive: store.state.filter == f
                                ) { store.send(.setFilter(f)) }
                            }
                        }
                        .padding(.horizontal, EditorialSpacing.screenGutter)
                        .padding(.vertical, 1)
                    }

                    content
                        .padding(.horizontal, EditorialSpacing.screenGutter)
                }
                .padding(.top, EditorialSpacing.small)
                .padding(.bottom, EditorialSpacing.xxxLarge)
            }
            .refreshable { store.send(.refresh) }
        }
    }

    private var newBookingURL: URL {
        let web = studios.selected.webURL ?? URL(string: "https://aura.reactiveshots.com")!
        return web.appendingPathComponent("bookings/new")
    }

    private var subtitle: String {
        guard store.state.hasLoadedOnce else { return "Loading bookings…" }
        return "\(store.state.count(.active)) active · \(store.state.count(.action)) waiting on a client"
    }

    @ViewBuilder
    private var content: some View {
        if store.state.isLoading && !store.state.hasLoadedOnce {
            VStack(spacing: 8) {
                ForEach(0..<5, id: \.self) { _ in EditorialSkeleton(height: 96) }
            }
        } else if let err = store.state.error, store.state.rows.isEmpty {
            EditorialEmptyState(
                systemImage: "exclamationmark.triangle",
                title: "Couldn't load",
                subtitle: err,
                actionTitle: "Try again"
            ) { store.send(.refresh) }
        } else if store.state.shown.isEmpty {
            EditorialEmptyState(
                systemImage: "calendar.badge.plus",
                title: store.state.rows.isEmpty ? "No bookings yet" : "Nothing here",
                subtitle: store.state.rows.isEmpty
                    ? "Create one on the web and the client gets an agreement to sign."
                    : "No bookings match this filter."
            )
        } else {
            VStack(spacing: 0) {
                ForEach(store.state.shown) { b in
                    NavigationLink(value: BookingRoute(number: b.number)) {
                        AdminBookingRow(booking: b)
                    }
                    .buttonStyle(.plain)
                }
            }
            .overlay(alignment: .top) { Rectangle().fill(EditorialColors.borderSubtle).frame(height: 1) }
        }
    }
}

private struct AdminBookingRow: View {
    let booking: BookingSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center) {
                Text(booking.number)
                    .font(EditorialTypography.sans(size: EditorialTypography.Size.hint, weight: .medium))
                    .monospacedDigit()
                    .foregroundStyle(EditorialColors.textMuted)
                Spacer(minLength: 8)
                BookingStatusBadge(status: booking.status)
            }
            HStack(alignment: .top, spacing: EditorialSpacing.medium) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(booking.client.fullName)
                        .font(EditorialTypography.sans(size: EditorialTypography.Size.subtitle, weight: .medium))
                        .foregroundStyle(EditorialColors.textPrimary)
                        .lineLimit(1)
                    Text("\(booking.eventType ?? "Event") · \(BookingFormat.day(booking.eventDate, .short))")
                        .font(EditorialTypography.sans(size: EditorialTypography.Size.hint))
                        .foregroundStyle(EditorialColors.textMuted)
                        .lineLimit(1)
                }
                Spacer(minLength: 8)
                VStack(alignment: .trailing, spacing: 2) {
                    if let next = booking.nextPayment {
                        Text(BookingFormat.money(next.amountCents))
                            .font(EditorialTypography.sans(size: EditorialTypography.Size.subtitle))
                            .monospacedDigit()
                            .foregroundStyle(next.due ? EditorialColors.brand : EditorialColors.textSecondary)
                        Text("\(next.label) · \(next.due ? "due now" : "upcoming")")
                            .font(EditorialTypography.sans(size: 11))
                            .foregroundStyle(EditorialColors.textFaint)
                            .lineLimit(1)
                    } else {
                        Text(BookingFormat.money(booking.totalDueCents))
                            .font(EditorialTypography.sans(size: EditorialTypography.Size.subtitle))
                            .monospacedDigit()
                            .foregroundStyle(EditorialColors.textSecondary)
                        Text("\(BookingFormat.money(booking.paidCents)) paid")
                            .font(EditorialTypography.sans(size: 11))
                            .foregroundStyle(EditorialColors.textFaint)
                    }
                }
            }
        }
        .padding(.vertical, 14)
        .contentShape(Rectangle())
        .overlay(alignment: .bottom) { Rectangle().fill(EditorialColors.borderSubtle).frame(height: 1) }
    }
}
