//
//  BookingDetailStore.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 10/6/26.
//

import UIKit

@Observable
@MainActor
final class BookingDetailStore {
    private(set) var state: BookingDetailState
    private let api: APIClient

    init(api: APIClient, number: String) {
        self.api = api
        self.state = BookingDetailState(number: number)
    }

    func send(_ intent: BookingDetailIntent) {
        switch intent {
        case .load, .refresh:
            guard !state.isLoading else { return }
            state.isLoading = true
            Task { [api, number = state.number] in
                do {
                    self.send(.loaded(try await api.myBooking(number: number)))
                } catch {
                    let missing = (error as? APIError)?.statusCode == 404
                    self.send(.loadFailed(error.localizedDescription, notFound: missing))
                }
            }

        case .loaded(let booking):
            state.booking = booking
            state.isLoading = false
            state.hasLoadedOnce = true
            state.error = nil
            state.notFound = false
            loadMap(for: booking)

        case .loadFailed(let message, let notFound):
            state.isLoading = false
            state.hasLoadedOnce = true
            state.error = message
            state.notFound = notFound

        case .mapLoaded(let stops, let image):
            guard stops == state.mapStops else { return }
            state.map = image
            state.mapLoading = false

        case .nameChanged(let name):
            state.signName = name

        case .consentChanged(let on):
            state.consent = on

        case .sign:
            guard state.canSign, let booking = state.booking, let hash = booking.contract.hash else { return }
            state.signing = true
            let name = state.signName.trimmingCharacters(in: .whitespaces)
            Task { [api] in
                do {
                    self.send(.signed(try await api.signBooking(number: booking.number, fullName: name, contractHash: hash)))
                } catch let e as APIError where e.statusCode == 409 {
                    self.send(.contractChanged)
                } catch {
                    self.send(.signFailed(error.localizedDescription))
                }
            }

        case .signed(let booking):
            state.signing = false
            state.stale = false
            send(.loaded(booking))
            send(.showToast(BookingToast(message: "Signed. A copy is on its way to your inbox.")))

        case .signFailed(let message):
            state.signing = false
            send(.showToast(BookingToast(message: message, isError: true)))

        case .contractChanged:
            state.signing = false
            state.stale = true
            state.consent = false
            send(.showToast(BookingToast(message: "The contract was updated — please review again.", isError: true)))
            send(.refresh)

        case .openDocument(let kind):
            guard state.openingDocument == nil, let booking = state.booking else { return }
            state.openingDocument = kind
            Task { [api] in
                do {
                    let doc: PreviewDocument
                    switch kind {
                    case .contract:
                        let data = try await api.contractPDF(number: booking.number)
                        doc = try PreviewDocument.write(data, named: "\(booking.number)-agreement.pdf")
                    case .invoice:
                        let data = try await api.myInvoicePDF(number: booking.number)
                        doc = try PreviewDocument.write(data, named: "Reactive Shots Studios Invoice INV-\(booking.number).pdf")
                    }
                    self.send(.documentReady(doc))
                } catch {
                    self.send(.documentFailed(kind == .contract ? "Couldn't download the agreement" : "Couldn't download the invoice"))
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

    private func loadMap(for booking: Booking) {
        // half-typed addresses aren't worth a map
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
