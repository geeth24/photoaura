//
//  ProofBanner.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 10/6/26.
//

import SwiftUI
import EditorialStyle

/// Sits above a proof-locked album's grid. The studio sees the same thing in its own words.
struct ProofBanner: View {
    let studio: Bool
    let bookingNumber: String?
    let amountCents: Int?

    var body: some View {
        EditorialNotice(systemImage: "lock", title: title, message: message) {
            if let bookingNumber {
                NavigationLink(value: BookingRoute(number: bookingNumber)) {
                    HStack(spacing: 6) {
                        Text(studio ? "Booking \(bookingNumber)" : "View booking")
                        Image(systemName: "arrow.up.right").font(.system(size: 9, weight: .bold))
                    }
                    .font(EditorialTypography.sans(size: 10, weight: .semibold))
                    .tracking(1.8)
                    .textCase(.uppercase)
                    .foregroundStyle(EditorialColors.textSecondary)
                    .padding(.horizontal, 12)
                    .frame(height: 34)
                    .overlay(Rectangle().stroke(EditorialColors.borderDefault, lineWidth: 1))
                }
                .buttonStyle(EditorialPressStyle())
                .padding(.top, 6)
            }
        }
    }

    private var title: String {
        if studio {
            return "Gallery preview — the client's full-resolution downloads unlock when the final payment is marked received."
        }
        let amount = amountCents.map { " (\(BookingFormat.money($0)))" } ?? ""
        return "Gallery preview — full-resolution downloads unlock after your final payment\(amount)."
    }

    private var message: String {
        studio ? "Downloads are off for everyone until then." : "Until then you're seeing watermarked previews."
    }
}
