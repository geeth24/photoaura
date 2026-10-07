//
//  AdminBookingDetailView.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 10/6/26.
//

import SwiftUI
import EditorialStyle

struct AdminBookingDetailView: View {
    let number: String
    @Environment(APIClient.self) private var api
    @State private var store: AdminBookingDetailStore?

    var body: some View {
        Group {
            if let store {
                AdminBookingDetailContent(store: store)
                    .bookingToast(store.state.toast)
                    .documentPreview(store.state.document) { store.send(.dismissDocument) }
            } else {
                Color.clear
            }
        }
        .onAppear {
            guard store == nil else { return }
            let s = AdminBookingDetailStore(api: api, number: number)
            store = s
            s.send(.load)
        }
        .navigationTitle(number)
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// The confirm-first actions: each emails the client or changes what they owe.
private enum Confirmation: Identifiable {
    case send
    case undo(BookingPayment)
    case remove(BookingPayment)
    case deliver

    var id: String {
        switch self {
        case .send: return "send"
        case .undo(let p): return "undo-\(p.id)"
        case .remove(let p): return "remove-\(p.id)"
        case .deliver: return "deliver"
        }
    }
}

private enum PaymentSheet: Identifiable {
    case receive(BookingPayment)
    case overtime
    case addCharge
    case contract

    var id: String {
        switch self {
        case .receive(let p): return "receive-\(p.id)"
        case .overtime: return "overtime"
        case .addCharge: return "charge"
        case .contract: return "contract"
        }
    }
}

private struct AdminBookingDetailContent: View {
    let store: AdminBookingDetailStore
    @State private var confirmation: Confirmation?
    @State private var sheet: PaymentSheet?

    var body: some View {
        ZStack {
            EditorialColors.background.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: EditorialSpacing.xLarge) {
                    content
                }
                .padding(.horizontal, EditorialSpacing.screenGutter)
                .padding(.top, EditorialSpacing.medium)
                .padding(.bottom, EditorialSpacing.xxxLarge)
            }
            .refreshable { store.send(.refresh) }
        }
        .sheet(item: $confirmation) { c in confirmSheet(c) }
        .sheet(item: $sheet) { s in
            if let b = store.state.booking {
                switch s {
                case .receive(let p): MarkReceivedSheet(store: store, payment: p, clientName: b.client.fullName)
                case .overtime: OvertimeSheet(store: store, hourlyCents: b.package.overtimeRateCents ?? 0)
                case .addCharge: AddChargeSheet(store: store)
                case .contract: ContractSheet(booking: b)
                }
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        if let b = store.state.booking {
            header(b)
            statusBlock(b)
            payments(b)
            agreement(b)
            gallery(b)
            client(b)
            event(b)
            if let notes = b.notesInternal, !notes.isEmpty {
                EditorialPanel("Internal notes", systemImage: "lock") {
                    Text(notes).editorialSubtitle()
                }
            }
            activity(b)
        } else if store.state.isLoading || !store.state.hasLoadedOnce {
            VStack(alignment: .leading, spacing: 16) {
                EditorialSkeleton(height: 12).frame(width: 110)
                EditorialSkeleton(height: 48)
                EditorialSkeleton(height: 220)
                EditorialSkeleton(height: 220)
            }
        } else {
            EditorialEmptyState(
                systemImage: "exclamationmark.triangle",
                title: "Booking not found",
                subtitle: store.state.error,
                actionTitle: "Try again"
            ) { store.send(.refresh) }
        }
    }

    // MARK: - header

    private func header(_ b: Booking) -> some View {
        VStack(alignment: .leading, spacing: EditorialSpacing.small) {
            HStack(spacing: EditorialSpacing.small) {
                Text(b.number)
                    .font(EditorialTypography.sans(size: EditorialTypography.Size.hint, weight: .medium))
                    .monospacedDigit()
                    .foregroundStyle(EditorialColors.textMuted)
                BookingStatusBadge(status: b.status)
            }
            Text(b.client.fullName).editorialDisplay()
            Text(summaryLine(b)).editorialSubtitle()
            if !store.state.isCancelled && store.state.canSend {
                EditorialButton(
                    b.status == .draft ? "Send to client" : "Resend",
                    isLoading: store.state.busy == .send
                ) { confirmation = .send }
                .padding(.top, EditorialSpacing.xSmall)
            }
        }
    }

    private func summaryLine(_ b: Booking) -> String {
        var s = "\(b.eventType) · \(BookingFormat.day(b.event.date)) · \(b.package.name ?? "Custom package")"
        if let h = BookingFormat.hoursText(b.package.hours) { s += ", \(h) hrs" }
        return s
    }

    @ViewBuilder
    private func statusBlock(_ b: Booking) -> some View {
        if b.status == .cancelled {
            EditorialNotice(
                systemImage: "nosign",
                title: "Cancelled \(BookingFormat.stamp(b.cancelledAt))",
                message: b.cancelReason
            )
        } else if b.status == .draft {
            Text("Draft — \(b.client.firstName) hasn't seen this yet. Send it when the details look right.")
                .editorialSubtitle()
                .padding(EditorialSpacing.medium)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(Rectangle().strokeBorder(EditorialColors.borderDefault, style: StrokeStyle(lineWidth: 1, dash: [4, 4])))
        } else {
            EditorialSteps(BookingFormat.clientSteps, done: BookingFormat.stepsDone(b.status))
        }
    }

    // MARK: - payments

    private func payments(_ b: Booking) -> some View {
        let open = !store.state.isCancelled && b.status != .paid
        return EditorialPanel("Payments", systemImage: "calendar") {
            VStack(alignment: .leading, spacing: EditorialSpacing.medium) {
                EditorialFigureGrid([
                    EditorialFigure("Total fee", BookingFormat.money(b.money.totalFee)),
                    EditorialFigure("Extras", BookingFormat.money(b.money.extras)),
                    EditorialFigure("Paid", BookingFormat.money(b.money.paid)),
                    EditorialFigure("Balance", BookingFormat.money(b.money.balance), emphasized: b.money.balance > 0),
                ], valueSize: 21)

                if open {
                    HStack(spacing: 8) {
                        EditorialSmallButton("Overtime", systemImage: "clock") { sheet = .overtime }
                        EditorialSmallButton("Add charge", systemImage: "plus") { sheet = .addCharge }
                        Spacer(minLength: 0)
                    }
                }

                PaymentsList(payments: b.payments) { p in
                    if !store.state.isCancelled { paymentActions(p) }
                }

                Text("Total due \(BookingFormat.money(b.money.totalDue)). Retainer, event-day and final are 10/40/50 of the fee; extras ride with the final.")
                    .editorialHint()
            }
        } accessory: {
            if b.status != .draft {
                EditorialSmallButton(
                    "Invoice",
                    systemImage: "arrow.down.to.line",
                    isLoading: store.state.openingDocument == .invoice
                ) { store.send(.openDocument(.invoice)) }
            }
        }
    }

    @ViewBuilder
    private func paymentActions(_ p: BookingPayment) -> some View {
        HStack(spacing: 6) {
            if p.receivedCents > 0 {
                if p.state != "paid" { markReceived(p) }
                EditorialSmallButton(
                    "Undo",
                    systemImage: "arrow.uturn.backward",
                    style: .quiet,
                    isLoading: store.state.busy == .undo(p.id)
                ) { confirmation = .undo(p) }
            } else {
                markReceived(p)
                if p.isExtra {
                    EditorialSmallButton(
                        "",
                        systemImage: "xmark",
                        style: .destructive,
                        isLoading: store.state.busy == .removeCharge(p.id)
                    ) { confirmation = .remove(p) }
                    .accessibilityLabel("Remove \(p.label)")
                }
            }
        }
    }

    private func markReceived(_ p: BookingPayment) -> some View {
        EditorialSmallButton("Mark received", style: p.state == "due" ? .filled : .outline) {
            sheet = .receive(p)
        }
    }

    // MARK: - agreement

    private func agreement(_ b: Booking) -> some View {
        EditorialPanel("Agreement", systemImage: "signature") {
            VStack(alignment: .leading, spacing: EditorialSpacing.medium) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(b.contract.signed
                         ? "Signed by \(b.contract.signedName ?? b.client.fullName)"
                         : b.contract.sentAt != nil ? "Waiting for signature" : "Not sent yet")
                        .font(EditorialTypography.serif(size: 20))
                        .foregroundStyle(EditorialColors.textPrimary)
                    Text(agreementDetail(b)).editorialHint(color: EditorialColors.textSecondary)
                    if let hash = b.contract.hash {
                        Text("v\(b.contract.version ?? "?") · sha256 \(hash.prefix(16))…")
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundStyle(EditorialColors.textFaint)
                            .lineLimit(1)
                    }
                }
                HStack(spacing: 8) {
                    if b.contract.markdown != nil {
                        EditorialSmallButton(b.contract.signed ? "View" : "Preview", systemImage: "eye") { sheet = .contract }
                    }
                    EditorialSmallButton(
                        b.contract.signed ? "Signed PDF" : "Draft PDF",
                        systemImage: "arrow.down.to.line",
                        isLoading: store.state.openingDocument == .contract
                    ) { store.send(.openDocument(.contract)) }
                }
            }
        }
    }

    private func agreementDetail(_ b: Booking) -> String {
        if b.contract.signed {
            let ip = b.contract.signedIp.map { " · \($0)" } ?? ""
            return "\(BookingFormat.stamp(b.contract.signedAt))\(ip)"
        }
        if let sent = b.contract.sentAt { return "Sent \(BookingFormat.stamp(sent)) to \(b.client.email)" }
        return "Check the draft PDF, then send it from the top of the page."
    }

    // MARK: - gallery

    private func gallery(_ b: Booking) -> some View {
        EditorialPanel("Gallery", systemImage: "photo.on.rectangle") {
            if let a = b.album {
                VStack(alignment: .leading, spacing: EditorialSpacing.medium) {
                    NavigationLink(value: AlbumSummary(albumId: a.id ?? 0, albumName: a.name, slug: a.slug, imageCount: 0, albumPhotos: nil, locked: a.locked)) {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(a.name)
                                    .font(EditorialTypography.serif(size: 20))
                                    .foregroundStyle(EditorialColors.textPrimary)
                                    .lineLimit(1)
                                Text(a.locked
                                     ? "Watermarked previews. Downloads unlock with the final payment."
                                     : b.unlockedAt != nil ? "Full resolution since \(BookingFormat.stamp(b.unlockedAt))" : "Full resolution, downloads open.")
                                    .editorialHint(color: EditorialColors.textSecondary)
                                    .multilineTextAlignment(.leading)
                            }
                            Spacer(minLength: 8)
                            Image(systemName: "arrow.up.right")
                                .font(.system(size: 13))
                                .foregroundStyle(EditorialColors.textFaint)
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)

                    if !store.state.isCancelled && store.state.canDeliver {
                        EditorialButton("Mark gallery delivered", isLoading: store.state.busy == .deliver) {
                            confirmation = .deliver
                        }
                    }
                }
            } else {
                Text("No gallery yet. Link or create one from this booking on the web; it stays in preview mode until the final payment.")
                    .editorialSubtitle()
            }
        } accessory: {
            if let a = b.album {
                if a.locked {
                    EditorialBadge("Preview · locked", tone: .brand, icon: "lock.fill")
                } else {
                    EditorialBadge("Unlocked", tone: .neutral, icon: "lock.open")
                }
            }
        }
    }

    // MARK: - client + event

    private func client(_ b: Booking) -> some View {
        EditorialPanel("Client", systemImage: "envelope") {
            VStack(alignment: .leading, spacing: 10) {
                Text(b.client.fullName)
                    .font(EditorialTypography.sans(size: EditorialTypography.Size.body))
                    .foregroundStyle(EditorialColors.textPrimary)
                if let mail = URL(string: "mailto:\(b.client.email)") {
                    Link(destination: mail) { contactRow("envelope", b.client.email) }
                }
                if let phone = b.client.phone, !phone.isEmpty,
                   let tel = URL(string: "tel:\(phone.filter { $0.isNumber || $0 == "+" })") {
                    Link(destination: tel) { contactRow("phone", phone) }
                }
            }
        }
    }

    private func contactRow(_ icon: String, _ text: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 12))
                .foregroundStyle(EditorialColors.textFaint)
            Text(text)
                .font(EditorialTypography.sans(size: EditorialTypography.Size.caption))
                .foregroundStyle(EditorialColors.textSecondary)
        }
    }

    private func event(_ b: Booking) -> some View {
        EditorialPanel("Event", systemImage: "mappin.and.ellipse") {
            VStack(alignment: .leading, spacing: EditorialSpacing.medium) {
                EventFacts(booking: b, map: store.state.map, mapLoading: store.state.mapLoading, showsOvertime: true)
                if let details = b.detailsForClient, !details.isEmpty {
                    EditorialNotice(eyebrow: "For the client", message: details)
                }
            }
        }
    }

    private func activity(_ b: Booking) -> some View {
        EditorialPanel("Activity", systemImage: "clock.arrow.circlepath") {
            EditorialTimeline(b.timeline.reversed().map { .init($0.label, detail: BookingFormat.stamp($0.at)) })
        }
    }

    // MARK: - confirmations

    @ViewBuilder
    private func confirmSheet(_ c: Confirmation) -> some View {
        if let b = store.state.booking {
            let first = b.client.firstName
            switch c {
            case .send:
                EditorialConfirmSheet(
                    title: b.status == .draft ? "Send the agreement to \(first)?" : "Resend to \(first)?",
                    message: "\(b.client.email) gets an email with a sign-in link to review and sign.",
                    systemImage: "paperplane",
                    primaryLabel: b.status == .draft ? "Send" : "Resend"
                ) { store.send(.send) }
            case .undo(let p):
                EditorialConfirmSheet(
                    title: "Undo this receipt?",
                    message: "Clears the \(BookingFormat.money(p.receivedCents)) recorded for the \(p.label.lowercased()). No email is sent, and the booking may move back a step.",
                    systemImage: "arrow.uturn.backward",
                    primaryLabel: "Undo receipt",
                    cancelLabel: "Keep it",
                    isDestructive: true
                ) { store.send(.undo(p)) }
            case .remove(let p):
                EditorialConfirmSheet(
                    title: "Remove this charge?",
                    message: "\(p.label) (\(BookingFormat.money(p.amountCents))) comes off the final payment.",
                    systemImage: "xmark.circle",
                    primaryLabel: "Remove charge",
                    cancelLabel: "Keep it",
                    isDestructive: true
                ) { store.send(.removeCharge(p)) }
            case .deliver:
                EditorialConfirmSheet(
                    title: "Deliver the gallery preview to \(first)?",
                    message: "\(first) gets an email with the gallery link and the final payment due (\(BookingFormat.money(store.state.finalDue))). Downloads stay locked until it's received.",
                    systemImage: "shippingbox",
                    primaryLabel: "Deliver"
                ) { store.send(.deliver) }
            }
        }
    }
}
