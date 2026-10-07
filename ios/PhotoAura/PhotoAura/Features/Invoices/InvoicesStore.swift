//
//  InvoicesStore.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 10/6/26.
//

import Foundation

@Observable
@MainActor
final class InvoicesStore {
    private(set) var state = InvoicesState()
    private let api: APIClient

    init(api: APIClient) {
        self.api = api
    }

    func send(_ intent: InvoicesIntent) {
        switch intent {
        case .load, .refresh:
            guard !state.isLoading else { return }
            state.isLoading = true
            Task { [api] in
                do {
                    self.send(.loaded(try await api.myInvoices()))
                } catch {
                    self.send(.loadFailed(error.localizedDescription))
                }
            }
        case .loaded(let rows):
            state.invoices = rows
            state.isLoading = false
            state.hasLoadedOnce = true
            state.error = nil
        case .loadFailed(let message):
            state.isLoading = false
            state.hasLoadedOnce = true
            state.error = message

        case .open(let number):
            guard state.opening == nil else { return }
            state.opening = number
            // the invoice is generated on request, so it always reflects the latest payments
            Task { [api] in
                do {
                    let data = try await api.myInvoicePDF(number: number)
                    self.send(.documentReady(try PreviewDocument.write(data, named: "Reactive Shots Studios Invoice INV-\(number).pdf")))
                } catch {
                    self.send(.documentFailed)
                }
            }
        case .documentReady(let doc):
            state.opening = nil
            state.document = doc
        case .documentFailed:
            state.opening = nil
            let toast = BookingToast(message: "Couldn't download the invoice", isError: true)
            state.toast = toast
            Task {
                try? await Task.sleep(for: .seconds(3))
                self.send(.clearToast(toast.id))
            }
        case .dismissDocument:
            state.document = nil
        case .clearToast(let id):
            if state.toast?.id == id { state.toast = nil }
        }
    }
}
