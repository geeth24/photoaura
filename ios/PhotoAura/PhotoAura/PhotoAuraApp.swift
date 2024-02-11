//
//  PhotoAuraApp.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 1/31/24.
//

import SwiftUI

@main
struct PhotoAuraApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(ViewModel())
                .onOpenURL(perform: { url in
                    let urlString = url.absoluteString
                    if urlString.starts(with: "photoaura://url="),
                       let range = urlString.range(of: "photoaura://url=") {
                        let photoAuraURL = String(urlString[range.upperBound...])
                        UserDefaults.standard.set(photoAuraURL, forKey: "photoAuraURL")
                    }
                })
            
        }
    }
}

