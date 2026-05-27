//
//  NetworkMonitor.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 5/27/26.
//

import Foundation
import Network

@Observable
@MainActor
final class NetworkMonitor {
    private(set) var isOnline: Bool = true

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "photoaura.network-monitor", qos: .utility)

    init() {
        monitor.pathUpdateHandler = { [weak self] path in
            let online = path.status == .satisfied
            Task { @MainActor [weak self] in
                self?.isOnline = online
            }
        }
        monitor.start(queue: queue)
    }

    deinit { monitor.cancel() }
}
