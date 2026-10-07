//
//  AdminBookingDetailStore.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 10/6/26.
//

import UIKit

@Observable
@MainActor
final class AdminBookingDetailStore {
    private(set) var state: AdminBookingDetailState
    private let api: APIClient

    init(api: APIClient, number: String) {
        self.api = api
        self.state = AdminBookingDetailState(number: number)
    }

    func send(_ intent: AdminBookingDetailIntent) {
        switch intent {
        case .load, .refresh:
            guard !state.isLoading else { return }
            state.isLoading = true
            Task { [api, number = state.number] in
                do {
                    self.send(.loaded(try await api.booking(number: number)))
                } catch {
                    self.send(.loadFailed(error.localizedDescription))
                }
            }

        case .loaded(let booking):
            state.booking = booking
            state.isLoading = false
            state.hasLoadedOnce = true
            state.error = nil
            loadMap(for: booking)

        case .loadFailed(let message):
            state.isLoading = false
            state.hasLoadedOnce = true
            state.error = message

        case .mapLoaded(let stops, let image):
            guard stops == state.mapStops else { return }
            state.map = image
            state.mapLoading = false

        // every mutation returns the whole booking, so the screen just swaps it in

        case .send:
            guard let b = state.booking else { return }
            run(.send) { api in
                let updated = try await api.sendBooking(number: b.number)
                if updated.emailSent == false { return (updated, "Saved, but the email didn't go out. Try Resend.") }
                return (updated, "Agreement sent to \(b.client.email)")
            }

        case .receive(let p, let cents, let method, let day, let note):
            guard let b = state.booking else { return }
            let trimmed = note.trimmingCharacters(in: .whitespacesAndNewlines)
            run(.receive(p.id)) { api in
                let updated = try await api.receivePayment(
                    number: b.number, paymentId: p.id, amountCents: cents, method: method,
                    receivedOn: BookingFormat.isoDay(day), note: trimmed.isEmpty ? nil : trimmed
                )
                return (updated, "\(p.label) received · receipt emailed to \(b.client.firstName)")
            }

        case .undo(let p):
            guard let b = state.booking else { return }
            run(.undo(p.id)) { api in
                (try await api.undoPayment(number: b.number, paymentId: p.id), "\(p.label) receipt undone")
            }

        case .addCharge(let label, let cents, let overtime):
            guard let b = state.booking else { return }
            run(.addCharge) { api in
                let updated = try await api.addCharge(number: b.number, label: label, amountCents: cents)
                let message = overtime
                    ? "Overtime added · \(BookingFormat.money(cents)) with the final payment"
                    : "\(label) added to the final payment"
                return (updated, message)
            }

        case .removeCharge(let p):
            guard let b = state.booking else { return }
            run(.removeCharge(p.id)) { api in
                (try await api.removeCharge(number: b.number, paymentId: p.id), "\(p.label) removed")
            }

        case .deliver:
            guard let b = state.booking else { return }
            run(.deliver) { api in
                (try await api.markDelivered(number: b.number), "Gallery preview sent to \(b.client.firstName)")
            }

        case .changed(let booking, let message):
            state.busy = nil
            state.completed += 1
            send(.loaded(booking))
            let warning = booking.emailSent == false
            send(.showToast(BookingToast(message: message, isError: warning)))

        case .changeFailed(let message):
            state.busy = nil
            send(.showToast(BookingToast(message: message, isError: true)))

        case .openDocument(let kind):
            guard state.openingDocument == nil, let b = state.booking else { return }
            state.openingDocument = kind
            Task { [api] in
                do {
                    let doc: PreviewDocument
                    switch kind {
                    case .contract:
                        // an unsigned booking only has a draft to show
                        let draft = !b.contract.signed
                        let data = try await api.contractPDF(number: b.number, preview: draft)
                        doc = try PreviewDocument.write(data, named: "\(b.number)-agreement\(draft ? "-draft" : "").pdf")
                    case .invoice:
                        let data = try await api.invoicePDF(number: b.number)
                        doc = try PreviewDocument.write(data, named: "Reactive Shots Studios Invoice INV-\(b.number).pdf")
                    }
                    self.send(.documentReady(doc))
                } catch {
                    self.send(.documentFailed(error.localizedDescription))
                }
            }

        case .documentReady(let doc):
            state.openingDocument = nil
            state.document = doc

        case .documentFailed(let message):
            state.openingDocument = nil
            send(.showToast(BookingToast(message: message, isError: true)))

        case .dismissDocument:
            state.document = nil

        case .showToast(let toast):
            state.toast = toast
            Task {
                try? await Task.sleep(for: .seconds(toast.isError ? 3.5 : 2.5))
                self.send(.clearToast(toast.id))
            }

        case .clearToast(let id):
            if state.toast?.id == id { state.toast = nil }
        }
    }

    private func run(_ action: AdminBookingAction, _ work: @escaping (APIClient) async throws -> (Booking, String)) {
        guard state.busy == nil else { return }
        state.busy = action
        Task { [api] in
            do {
                let (booking, message) = try await work(api)
                self.send(.changed(booking, message: message))
            } catch {
                self.send(.changeFailed(error.localizedDescription))
            }
        }
    }

    private func loadMap(for booking: Booking) {
        let stops = booking.stops.filter { $0.count > 5 }
        guard stops != state.mapStops else { return }
        state.mapStops = stops
        state.map = nil
        guard !stops.isEmpty else { state.mapLoading = false; return }
        state.mapLoading = true
        Task { [api] in
            let data = try? await api.stopsMap(stops)
            self.send(.mapLoaded(stops, data.flatMap(UIImage.init(data:))))
        }
    }
}
