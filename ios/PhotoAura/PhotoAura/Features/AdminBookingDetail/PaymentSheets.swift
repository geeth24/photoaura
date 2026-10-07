//
//  PaymentSheets.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 10/6/26.
//

import SwiftUI
import EditorialStyle

/// Shared chrome for the small payment forms: title, a line of context,
/// the fields, then one primary button.
private struct PaymentSheetFrame<Fields: View>: View {
    let title: String
    let message: String
    let primary: String
    let canSubmit: Bool
    let isSaving: Bool
    var detents: Set<PresentationDetent> = [.large]
    let onSubmit: () -> Void
    @ViewBuilder var fields: Fields
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: EditorialSpacing.large) {
                    VStack(alignment: .leading, spacing: EditorialSpacing.xSmall) {
                        Text(title).editorialHeading()
                        Text(message).editorialSubtitle()
                    }
                    fields
                    EditorialButton(primary, isLoading: isSaving, isDisabled: !canSubmit, action: onSubmit)
                        .padding(.top, EditorialSpacing.xSmall)
                }
                .padding(.horizontal, EditorialSpacing.screenGutter)
                .padding(.top, EditorialSpacing.small)
                .padding(.bottom, EditorialSpacing.xxLarge)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(EditorialColors.background)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }.disabled(isSaving)
                }
            }
        }
        .presentationDetents(detents)
        .presentationBackground(EditorialColors.background)
        .interactiveDismissDisabled(isSaving)
    }
}

private struct FieldLabel: View {
    let text: String
    var body: some View {
        Text(text)
            .font(EditorialTypography.sans(size: 10, weight: .medium))
            .tracking(2.5)
            .textCase(.uppercase)
            .foregroundStyle(EditorialColors.textMuted)
    }
}

// MARK: - mark received

struct MarkReceivedSheet: View {
    let store: AdminBookingDetailStore
    let payment: BookingPayment
    let clientName: String

    @State private var amount: String
    @State private var method = "zelle"
    @State private var day = Date.now
    @State private var note = ""
    @Environment(\.dismiss) private var dismiss

    private static let methods = ["zelle", "cash", "check", "other"]

    init(store: AdminBookingDetailStore, payment: BookingPayment, clientName: String) {
        self.store = store
        self.payment = payment
        self.clientName = clientName
        // defaults to what's still owed on this line
        _amount = State(initialValue: BookingFormat.amountText(payment.outstandingCents))
    }

    private var cents: Int? { BookingFormat.cents(from: amount) }
    private var saving: Bool { store.state.busy == .receive(payment.id) }

    var body: some View {
        PaymentSheetFrame(
            title: payment.label,
            message: "\(BookingFormat.money(payment.amountCents)) due from \(clientName). They get an emailed receipt.",
            primary: cents.map { "Record \(BookingFormat.money($0))" } ?? "Record payment",
            canSubmit: cents != nil,
            isSaving: saving
        ) {
            guard let cents else { return }
            store.send(.receive(payment: payment, amountCents: cents, method: method, day: day, note: note))
        } fields: {
            EditorialTextField(
                "0.00",
                text: $amount,
                label: "Amount received ($)",
                kind: .decimal,
                isError: !amount.isEmpty && cents == nil
            )

            VStack(alignment: .leading, spacing: EditorialSpacing.xSmall) {
                FieldLabel(text: "Method")
                HStack(spacing: 6) {
                    ForEach(Self.methods, id: \.self) { m in
                        EditorialOptionButton(BookingFormat.methodLabel(m) ?? m, isSelected: method == m) { method = m }
                    }
                }
            }

            VStack(alignment: .leading, spacing: EditorialSpacing.xSmall) {
                FieldLabel(text: "Date received")
                DatePicker("Date received", selection: $day, in: ...Date.now, displayedComponents: .date)
                    .labelsHidden()
                    .tint(EditorialColors.brand)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            EditorialTextField(
                method == "check" ? "Check #" : "Zelle confirmation, who paid…",
                text: $note,
                label: "Note (optional)"
            )
        }
        .onChange(of: store.state.completed) { _, _ in dismiss() }
    }
}

// MARK: - overtime

struct OvertimeSheet: View {
    let store: AdminBookingDetailStore
    let hourlyCents: Int

    @State private var minutes = 30
    @Environment(\.dismiss) private var dismiss

    private var block: Int { hourlyCents / 2 }
    private var cents: Int { block * minutes / 30 }
    private var saving: Bool { store.state.busy == .addCharge }

    var body: some View {
        PaymentSheetFrame(
            title: "Add overtime",
            message: "The first 15 minutes past the end time are free. After that it's \(BookingFormat.money(block)) per 30 minutes, due with the final payment.",
            primary: "Add \(BookingFormat.money(cents))",
            canSubmit: block > 0,
            isSaving: saving,
            detents: [.medium, .large]
        ) {
            store.send(.addCharge(label: "Overtime (\(BookingFormat.minutesLabel(minutes)))", amountCents: cents, overtime: true))
        } fields: {
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) {
                ForEach(BookingFormat.overtimeBlocks, id: \.self) { m in
                    EditorialOptionButton(
                        BookingFormat.minutesLabel(m),
                        detail: BookingFormat.money(block * m / 30),
                        isSelected: minutes == m
                    ) { minutes = m }
                }
            }
        }
        .onChange(of: store.state.completed) { _, _ in dismiss() }
    }
}

// MARK: - add charge

struct AddChargeSheet: View {
    let store: AdminBookingDetailStore

    @State private var label = ""
    @State private var amount = ""
    @Environment(\.dismiss) private var dismiss

    private var cents: Int? { BookingFormat.cents(from: amount) }
    private var trimmed: String { label.trimmingCharacters(in: .whitespaces) }
    private var valid: Bool { !trimmed.isEmpty && cents != nil }
    private var saving: Bool { store.state.busy == .addCharge }

    var body: some View {
        PaymentSheetFrame(
            title: "Add a charge",
            message: "An add-on, like extra prints. It's due with the final payment.",
            primary: valid ? "Add \(BookingFormat.money(cents))" : "Add charge",
            canSubmit: valid,
            isSaving: saving
        ) {
            guard let cents else { return }
            store.send(.addCharge(label: trimmed, amountCents: cents, overtime: false))
        } fields: {
            EditorialTextField("Second photographer", text: $label, label: "Description")
            EditorialTextField("0.00", text: $amount, label: "Amount ($)", kind: .decimal, isError: !amount.isEmpty && cents == nil)
        }
        .onChange(of: store.state.completed) { _, _ in dismiss() }
    }
}

// MARK: - contract

struct ContractSheet: View {
    let booking: Booking
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: EditorialSpacing.large) {
                    Text(subtitle).editorialSubtitle()
                    EditorialMarkdownText(booking.contract.markdown ?? "")
                        .padding(EditorialSpacing.large)
                        .background(EditorialColors.surfaceElevated)
                        .overlay(Rectangle().stroke(EditorialColors.borderSubtle, lineWidth: 1))
                }
                .padding(.horizontal, EditorialSpacing.screenGutter)
                .padding(.vertical, EditorialSpacing.medium)
            }
            .background(EditorialColors.background)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) { Button("Done") { dismiss() } }
            }
        }
        .presentationBackground(EditorialColors.background)
    }

    private var title: String {
        booking.contract.signed ? "Signed agreement" : booking.contract.sentAt != nil ? "Agreement as sent" : "Agreement preview"
    }

    private var subtitle: String {
        if booking.contract.signed {
            return "Exactly what \(booking.contract.signedName ?? booking.client.fullName) signed on \(BookingFormat.stamp(booking.contract.signedAt))."
        }
        return "This is what the client reads before signing."
    }
}
