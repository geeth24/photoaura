//
//  Extentions.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 1/31/24.
//

import Foundation
import SwiftUI

extension UINavigationController: @retroactive UIGestureRecognizerDelegate {
    override open func viewDidLoad() {
        super.viewDidLoad()
        interactivePopGestureRecognizer?.delegate = self
    }

    public func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
        // Ensure there's more than one view controller in the stack.
        guard viewControllers.count > 1 else {
            return false
        }

        // Check the location of the gesture.
        if let gesture = gestureRecognizer as? UIPanGestureRecognizer {
            let location = gesture.location(in: view)
            // Assuming the sidebar's width is 50, adjust this value if your sidebar's width is different.
            let sidebarWidth: CGFloat = 200

            // Only begin the gesture if it starts outside the sidebar's area.
            // This means the gesture should start to the right of the sidebar's width.
            if location.x > sidebarWidth {
                return true
            } else {
                return false
            }
        }

        return false
    }
}



extension UIApplication {
    func getRootViewController() -> UIViewController {
        
        guard let screen = self.connectedScenes.first as? UIWindowScene else {
            return .init()
        }
        
        guard let root = screen.windows.first?.rootViewController else {
            return .init()
        }
        
        return root
    }
    
    static var appVersion: String? {
        return Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
    }
    
    static var appBuild: String? {
        return Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String
    }
}
