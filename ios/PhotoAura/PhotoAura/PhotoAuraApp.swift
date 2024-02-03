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

        }
    }
}
