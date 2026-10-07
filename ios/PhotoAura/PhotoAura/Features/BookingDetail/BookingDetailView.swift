//
//  BookingDetailView.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 10/6/26.
//

import SwiftUI
import EditorialStyle

/// Opens a booking for whoever's signed in: the studio gets its controls,
/// the client gets their own page.
struct BookingScreen: View {
    let number: String
    @Environment(AuthStore.self) private var auth

    var body: some View {
        if case .signedIn(let user) = auth.status, user.role == "admin" {
            AdminBookingDetailView(number: number)
        } else {
            BookingDetailView(number: number)
        }
    }
}

struct BookingDetailView: View {
    let number: String
    @Environment(APIClient.self) private var api
    @State private var store: BookingDetailStore?

    var body: some View {
        Group {
            if let store {
                BookingDetailContent(store: store)
                    .bookingToast(store.state.toast)
                    .documentPreview(store.state.document) { store.send(.dismissDocument) }
            } else {
                Color.clear
            }
        }
        .onAppear {
            guard store == nil else { return }
            let s = BookingDetailStore(api: api, number: number)
            store = s
            s.send(.load)
        }
        .navigationTitle(number)
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct BookingDetailContent: View {
    let store: BookingDetailStore

    var body: some View {
        ZStack {
            EditorialColors.background.ignoresSafeArea()
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: EditorialSpacing.xxLarge) {
                        content(proxy)
                    }
                    .padding(.horizontal, EditorialSpacing.screenGutter)
                    .padding(.top, EditorialSpacing.medium)
                    .padding(.bottom, EditorialSpacing.xxxLarge)
                    .id("top")
                }
                .refreshable { store.send(.refresh) }
                .onChange(of: store.state.stale) { _, stale in
                    if stale { withAnimation { proxy.scrollTo("top", anchor: .top) } }
                }
                .onChange(of: store.state.booking?.contract.signed) { _, signed in
                    if signed == true { withAnimation { proxy.scrollTo("top", anchor: .top) } }
                }
            }
        }
    }

    @ViewBuilder
    private func content(_ proxy: ScrollViewProxy) -> some View {
        if let b = store.state.booking {
            if b.status == .cancelled {
                cancelled(b)
            } else if b.contract.signed {
                SignedBooking(booking: b, store: store)
            } else {
                UnsignedBooking(booking: b, store: store) {
                    withAnimation { proxy.scrollTo("sign", anchor: .top) }
                }
            }
        } else if store.state.isLoading || !store.state.hasLoadedOnce {
            VStack(alignment: .leading, spacing: 16) {
                EditorialSkeleton(height: 12).frame(width: 110)
                EditorialSkeleton(height: 56)
                EditorialSkeleton(height: 120)
                EditorialSkeleton(height: 320)
            }
        } else if store.state.notFound {
            EditorialEmptyState(
                systemImage: "signature",
                title: "Booking not found",
                subtitle: "This link may be for a different account. Sign in with the email the booking was sent to."
            )
        } else {
            EditorialEmptyState(
                systemImage: "exclamationmark.triangle",
                title: "Couldn't load",
                subtitle: store.state.error,
                actionTitle: "Try again"
            ) { store.send(.refresh) }
        }
    }

    private func cancelled(_ b: Booking) -> some View {
        VStack(alignment: .leading, spacing: EditorialSpacing.large) {
            BookingEyebrow(text: "Booking \(b.number)")
            Text("This booking was cancelled.").editorialDisplay()
            EditorialNotice(
                systemImage: "nosign",
                message: "Your \(b.eventType.lowercased()) on \(BookingFormat.day(b.event.date)) is no longer on the calendar. Questions? Email \(BookingFormat.studioEmail)."
            )
        }
    }
}

// MARK: - unsigned

private struct UnsignedBooking: View {
    let booking: Booking
    let store: BookingDetailStore
    let jumpToSignature: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: EditorialSpacing.medium) {
            BookingEyebrow(text: "Booking \(booking.number)")
            Text("Let's lock in your date.").editorialDisplay()
            Text("Hi \(booking.client.firstName), thank you for choosing Reactive Shots! Here's everything we talked about. Read it through, sign at the bottom, and your \(BookingFormat.day(booking.event.date, .short)) date is held once the retainer arrives.")
                .editorialBody(color: EditorialColors.textSecondary)
            Button(action: jumpToSignature) {
                HStack(spacing: 6) {
                    Image(systemName: "arrow.down").font(.system(size: 11, weight: .semibold))
                    Text("Jump to signature")
                        .font(EditorialTypography.sans(size: 11, weight: .medium))
                        .tracking(2)
                        .textCase(.uppercase)
                }
                .foregroundStyle(EditorialColors.brand)
            }
            .buttonStyle(.plain)
        }

        if store.state.stale {
            EditorialNotice(
                systemImage: "arrow.triangle.2.circlepath",
                title: "The contract was updated — please review again. The new version is below."
            )
        }

        VStack(alignment: .leading, spacing: EditorialSpacing.medium) {
            EventFacts(booking: booking, map: store.state.map, mapLoading: store.state.mapLoading)
            EditorialFigureGrid([
                EditorialFigure("Total fee", BookingFormat.money(booking.money.totalFee), emphasized: true),
                EditorialFigure("Retainer · 10%", BookingFormat.money(amount("retainer")), footnote: "After you sign"),
                EditorialFigure("Event day · 40%", BookingFormat.money(amount("event_day")), footnote: "After coverage"),
                EditorialFigure("Final · 50%", BookingFormat.money(amount("final")), footnote: "When your gallery is ready"),
            ])
            if let details = booking.detailsForClient, !details.isEmpty {
                EditorialNotice(eyebrow: "From your photographer", message: details)
            }
        }

        VStack(alignment: .leading, spacing: EditorialSpacing.medium) {
            BookingEyebrow(text: "Your agreement")
            Group {
                if let markdown = booking.contract.markdown {
                    EditorialMarkdownText(markdown)
                } else {
                    Text("The agreement isn't ready yet.")
                        .editorialSubtitle(color: EditorialColors.textMuted)
                        .frame(maxWidth: .infinity)
                }
            }
            .padding(.horizontal, EditorialSpacing.large)
            .padding(.vertical, EditorialSpacing.xxLarge)
            .background(EditorialColors.surfaceElevated)
            .overlay(Rectangle().stroke(EditorialColors.borderSubtle, lineWidth: 1))
        }

        SignAgreementSection(store: store)
            .id("sign")
    }

    private func amount(_ kind: String) -> Int {
        booking.payments.first { $0.kind == kind }?.amountCents ?? 0
    }
}

// MARK: - signed

private struct SignedBooking: View {
    let booking: Booking
    let store: BookingDetailStore

    var body: some View {
        let (title, sub) = headline
        VStack(alignment: .leading, spacing: EditorialSpacing.small) {
            // badge beside the eyebrow when it fits, under it on narrow phones
            ViewThatFits(in: .horizontal) {
                HStack(spacing: EditorialSpacing.small) {
                    BookingEyebrow(text: "Booking \(booking.number)").fixedSize()
                    Spacer(minLength: 0)
                    BookingStatusBadge(status: booking.status)
                }
                VStack(alignment: .leading, spacing: EditorialSpacing.small) {
                    BookingEyebrow(text: "Booking \(booking.number)")
                    BookingStatusBadge(status: booking.status)
                }
            }
            Text(title).editorialDisplay()
                .padding(.top, EditorialSpacing.xSmall)
            Text("\(sub) \(booking.eventType) · \(BookingFormat.day(booking.event.date))")
                .editorialSubtitle()
        }

        EditorialSteps(BookingFormat.clientSteps, done: BookingFormat.stepsDone(booking.status))

        if let next = booking.nextPayment {
            NextPaymentCard(booking: booking, next: next)
        }

        if let album = booking.album {
            galleryLink(album)
        }

        VStack(alignment: .leading, spacing: EditorialSpacing.medium) {
            BookingEyebrow(text: "Payments")
            PaymentsList(payments: booking.payments)
            HStack {
                Text("\(BookingFormat.money(booking.money.paid)) of \(BookingFormat.money(booking.money.totalDue)) paid")
                    .foregroundStyle(EditorialColors.textMuted)
                Spacer()
                if booking.money.balance > 0 {
                    Text("Balance \(BookingFormat.money(booking.money.balance))")
                        .foregroundStyle(EditorialColors.textSecondary)
                }
            }
            .font(EditorialTypography.sans(size: EditorialTypography.Size.caption))
            .monospacedDigit()
        }

        VStack(alignment: .leading, spacing: EditorialSpacing.medium) {
            BookingEyebrow(text: "Your event")
            EventFacts(booking: booking, map: store.state.map, mapLoading: store.state.mapLoading)
            if let details = booking.detailsForClient, !details.isEmpty {
                EditorialNotice(eyebrow: "From your photographer", message: details)
            }
        }

        documentCard(
            eyebrow: "Agreement",
            title: "Signed by \(booking.contract.signedName ?? booking.client.fullName)",
            detail: BookingFormat.stamp(booking.contract.signedAt),
            button: "Download signed agreement",
            kind: .contract
        )

        documentCard(
            eyebrow: "Invoice",
            title: "INV-\(booking.number)",
            detail: "\(booking.money.balance > 0 ? "\(BookingFormat.money(booking.money.balance)) balance" : "Paid in full") · updated with every payment",
            button: "Download invoice",
            kind: .invoice
        )
    }

    private var headline: (String, String) {
        switch booking.status {
        case .signed: return ("Signed. One step left.", "Your date is held as soon as the retainer arrives.")
        case .booked: return ("Your date is secured.", "Everything's set. We'll be in touch before the day.")
        case .eventComplete: return ("Thank you for having us.", "We're editing your photos now.")
        case .delivered: return ("Your gallery preview is ready.", "Full-resolution downloads unlock with the final payment.")
        case .paid: return ("Paid in full. Thank you!", "Your full-resolution gallery is unlocked.")
        default: return ("Your booking", "")
        }
    }

    private func galleryLink(_ album: BookingAlbum) -> some View {
        NavigationLink(value: AlbumSummary(albumId: album.id ?? 0, albumName: album.name, slug: album.slug, imageCount: 0, albumPhotos: nil, locked: album.locked)) {
            HStack(spacing: EditorialSpacing.medium) {
                Image(systemName: "photo.on.rectangle")
                    .font(.system(size: 17))
                    .foregroundStyle(EditorialColors.brand)
                    .frame(width: 44, height: 44)
                    .background(EditorialColors.brand.opacity(0.1))
                VStack(alignment: .leading, spacing: 4) {
                    Text(album.locked ? "Gallery preview" : "Your gallery")
                        .font(EditorialTypography.sans(size: 10, weight: .medium))
                        .tracking(2.5)
                        .textCase(.uppercase)
                        .foregroundStyle(EditorialColors.textMuted)
                    Text(album.name)
                        .font(EditorialTypography.serif(size: 22))
                        .foregroundStyle(EditorialColors.textPrimary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                    HStack(alignment: .firstTextBaseline, spacing: 5) {
                        if album.locked { Image(systemName: "lock.fill").font(.system(size: 9)) }
                        Text(album.locked ? "Full-resolution downloads unlock after your final payment." : "Full resolution, ready to download.")
                    }
                    .font(EditorialTypography.sans(size: EditorialTypography.Size.hint))
                    .foregroundStyle(EditorialColors.textMuted)
                    .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 14))
                    .foregroundStyle(EditorialColors.textFaint)
            }
            .padding(EditorialSpacing.medium)
            .background(EditorialColors.surfaceElevated)
            .overlay(Rectangle().stroke(EditorialColors.borderSubtle, lineWidth: 1))
        }
        .buttonStyle(EditorialPressStyle())
    }

    private func documentCard(eyebrow: String, title: String, detail: String, button: String, kind: BookingDocument) -> some View {
        VStack(alignment: .leading, spacing: EditorialSpacing.medium) {
            VStack(alignment: .leading, spacing: 4) {
                Text(eyebrow)
                    .font(EditorialTypography.sans(size: 10, weight: .medium))
                    .tracking(2.5)
                    .textCase(.uppercase)
                    .foregroundStyle(EditorialColors.textMuted)
                Text(title)
                    .font(EditorialTypography.sans(size: EditorialTypography.Size.body))
                    .monospacedDigit()
                    .foregroundStyle(EditorialColors.textPrimary)
                if !detail.isEmpty {
                    Text(detail)
                        .font(EditorialTypography.sans(size: EditorialTypography.Size.caption))
                        .foregroundStyle(EditorialColors.textMuted)
                }
            }
            EditorialButton(
                button,
                style: .secondary,
                isLoading: store.state.openingDocument == kind
            ) { store.send(.openDocument(kind)) }
        }
        .padding(EditorialSpacing.medium)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(EditorialColors.surfaceElevated)
        .overlay(Rectangle().stroke(EditorialColors.borderSubtle, lineWidth: 1))
    }
}
