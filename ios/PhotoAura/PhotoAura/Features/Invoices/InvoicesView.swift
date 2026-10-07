//
//  InvoicesView.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 10/6/26.
//

import SwiftUI
import EditorialStyle

/// The client's invoices, one per booking, each with its PDF.
struct InvoicesView: View {
    @Environment(APIClient.self) private var api
    @State private var store: InvoicesStore?

    var body: some View {
        Group {
            if let store {
                InvoicesContent(store: store)
                    .bookingToast(store.state.toast)
                    .documentPreview(store.state.document) { store.send(.dismissDocument) }
            } else {
                Color.clear
            }
        }
        .onAppear {
            guard store == nil else { return }
            let s = InvoicesStore(api: api)
            store = s
            s.send(.load)
        }
    }
}

private struct InvoicesContent: View {
    let store: InvoicesStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: EditorialSpacing.xLarge) {
                EditorialSectionHeader(eyebrow: "Billing", subtitle: subtitle)
                content
            }
            .padding(.horizontal, EditorialSpacing.screenGutter)
            .padding(.top, EditorialSpacing.small)
            .padding(.bottom, EditorialSpacing.xxxLarge)
        }
        .refreshable { store.send(.refresh) }
    }

    private var subtitle: String {
        let s = store.state
        if !s.hasLoadedOnce { return "Loading…" }
        if s.invoices.isEmpty { return "Nothing billed yet." }
        if s.balance > 0 {
            return "\(BookingFormat.money(s.balance)) outstanding across \(s.invoices.count) \(s.invoices.count == 1 ? "invoice" : "invoices")"
        }
        return "You're all paid up. Thank you!"
    }

    @ViewBuilder
    private var content: some View {
        if store.state.isLoading && !store.state.hasLoadedOnce {
            VStack(spacing: 12) {
                EditorialSkeleton(height: 90)
                EditorialSkeleton(height: 170)
                EditorialSkeleton(height: 170)
            }
        } else if let err = store.state.error, store.state.invoices.isEmpty {
            EditorialEmptyState(
                systemImage: "exclamationmark.triangle",
                title: "Couldn't load",
                subtitle: err,
                actionTitle: "Try again"
            ) { store.send(.refresh) }
        } else if store.state.invoices.isEmpty {
            EditorialEmptyState(
                systemImage: "doc.text",
                title: "No invoices yet",
                subtitle: "Each booking gets an invoice once your photographer sends the agreement."
            )
        } else {
            EditorialFigureGrid([
                EditorialFigure("Billed", BookingFormat.money(store.state.billed)),
                EditorialFigure("Paid", BookingFormat.money(store.state.paid)),
                EditorialFigure("Balance", BookingFormat.money(store.state.balance), emphasized: store.state.balance > 0),
            ], columns: 3, valueSize: 19)

            VStack(spacing: EditorialSpacing.small) {
                ForEach(store.state.invoices) { invoice in
                    InvoiceRow(invoice: invoice, opening: store.state.opening == invoice.bookingNumber) {
                        store.send(.open(invoice.bookingNumber))
                    }
                }
            }
        }
    }
}

private struct InvoiceRow: View {
    let invoice: MyInvoice
    let opening: Bool
    let onOpen: () -> Void

    private var cancelled: Bool { invoice.status == "cancelled" }

    var body: some View {
        VStack(alignment: .leading, spacing: EditorialSpacing.medium) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(invoice.invoiceNumber)
                        .font(EditorialTypography.sans(size: EditorialTypography.Size.subtitle, weight: .medium))
                        .monospacedDigit()
                        .foregroundStyle(EditorialColors.textPrimary)
                    NavigationLink(value: BookingRoute(number: invoice.bookingNumber)) {
                        Text("Booking \(invoice.bookingNumber)")
                            .font(EditorialTypography.sans(size: EditorialTypography.Size.hint))
                            .foregroundStyle(EditorialColors.textMuted)
                            .underline(color: EditorialColors.borderDefault)
                    }
                    .buttonStyle(.plain)
                }
                Spacer(minLength: 8)
                InvoiceStatusBadge(status: invoice.status)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(invoice.eventType ?? "Event")
                    .font(EditorialTypography.sans(size: EditorialTypography.Size.subtitle))
                    .foregroundStyle(EditorialColors.textPrimary)
                Text(BookingFormat.day(invoice.eventDate))
                    .font(EditorialTypography.sans(size: EditorialTypography.Size.hint))
                    .foregroundStyle(EditorialColors.textMuted)
                if invoice.status == "due", let next = invoice.nextPayment {
                    Text("\(next.label) · \(BookingFormat.money(next.amountCents)) due now")
                        .font(EditorialTypography.sans(size: EditorialTypography.Size.hint))
                        .foregroundStyle(EditorialColors.brand)
                        .padding(.top, 2)
                }
            }

            HStack(spacing: 0) {
                amount("Total", invoice.totalCents)
                amount("Paid", invoice.paidCents)
                amount("Balance", invoice.balanceCents, strong: true)
            }

            EditorialButton("Download PDF", style: .secondary, isLoading: opening, action: onOpen)
        }
        .padding(EditorialSpacing.medium)
        .background(EditorialColors.surfaceElevated)
        .overlay(Rectangle().stroke(EditorialColors.borderSubtle, lineWidth: 1))
    }

    private func amount(_ label: String, _ cents: Int, strong: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label)
                .font(EditorialTypography.sans(size: 10, weight: .medium))
                .tracking(2.5)
                .textCase(.uppercase)
                .foregroundStyle(EditorialColors.textMuted)
            Text(BookingFormat.money(cents))
                .font(EditorialTypography.sans(size: EditorialTypography.Size.subtitle))
                .monospacedDigit()
                .strikethrough(cancelled)
                .foregroundStyle(cancelled ? EditorialColors.textFaint : strong && cents > 0 ? EditorialColors.brand : EditorialColors.textPrimary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
