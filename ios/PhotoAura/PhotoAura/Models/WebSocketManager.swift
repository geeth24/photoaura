//
//  WebSocketManager.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 2/13/24.
//

import Foundation

class WebSocketManager: ObservableObject {
    private var webSocketTask: URLSessionWebSocketTask?
    let urlString: String
    
    init(urlString: String) {
        self.urlString = urlString
    }
    
    func connect() {
        guard let url = URL(string: urlString) else {
            print("WebSocketManager: Invalid URL")
            return
        }
        webSocketTask = URLSession.shared.webSocketTask(with: url)
        webSocketTask?.resume()
        receiveMessage()
    }
    
    func disconnect() {
        webSocketTask?.cancel(with: .goingAway, reason: nil)
    }
    
    func sendMessage(_ message: String) {
        webSocketTask?.send(.string(message)) { error in
            if let error = error {
                print("WebSocket sending error: \(error)")
            }
        }
    }
    
    private func receiveMessage() {
        webSocketTask?.receive { [weak self] result in
            switch result {
            case .failure(let error):
                print("WebSocket receiving error: \(error)")
            case .success(.string(let text)):
                print("Received string: \(text)")
                // Handle received message, update your UI accordingly
                self?.receiveMessage() // Listen for the next message
            case .success(.data(let data)):
                print("Received data: \(data)")
                self?.receiveMessage() // Listen for the next message
            default:
                break
            }
        }
    }
}
