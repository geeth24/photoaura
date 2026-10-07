//
//  NextPaymentCard.swift
//  PhotoAura
//
//  Created by Geeth Gunnampalli on 10/6/26.
//

import SwiftUI
import EditorialStyle

/// What's owed next; once it's due, how to pay it (Zelle address + memo to copy).
struct NextPaymentCard: View {
    let booking: Booking
    let next: NextPayment

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 8) {
                Text(next.due ? "Next payment · due now" : "Coming up")
                    .font(EditorialTypography.sans(size: 10, weight: .medium))
                    .tracking(2.5)
                    .textCase(.uppercase)
                    .foregroundStyle(next.due ? EditorialColors.brand : EditorialColors.textMuted)
                Text(BookingFormat.money(next.amountCents))
                    .font(EditorialTypography.serif(size: 42))
                    .monospacedDigit()
                    .foregroundStyle(EditorialColors.textPrimary)
                Text(labelLine)
                    .font(EditorialTypography.sans(size: EditorialTypography.Size.caption))
                    .foregroundStyle(EditorialColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(EditorialSpacing.medium)
            .frame(maxWidth: .infinity, alignment: .leading)

            if next.due {
                Rectangle().fill(EditorialColors.borderSubtle).frame(height: 1)
                howToPay
            }
        }
        .background(EditorialColors.surfaceElevated)
        .overlay(Rectangle().stroke(next.due ? EditorialColors.borderAccent : EditorialColors.borderSubtle, lineWidth: 1))
    }

    private var labelLine: String {
        var s = next.label
        if next.kind == "event_day" && !next.due {
            s += " · due after coverage on \(BookingFormat.day(booking.event.date, .short))"
        }
        if next.isClosing && !next.due { s += " · due when your gallery is delivered" }
        let extras = next.isClosing ? booking.money.extras : 0
        if extras > 0 { s += " · includes \(BookingFormat.money(extras)) in added charges" }
        return s
    }

    private var howToPay: some View {
        VStack(alignment: .leading, spacing: EditorialSpacing.medium) {
            Text("How to pay")
                .font(EditorialTypography.sans(size: 10, weight: .medium))
                .tracking(2.5)
                .textCase(.uppercase)
                .foregroundStyle(EditorialColors.textMuted)

            HStack(alignment: .top, spacing: EditorialSpacing.small) {
                Image(systemName: "iphone")
                    .font(.system(size: 14))
                    .foregroundStyle(EditorialColors.brand)
                    .frame(width: 18)
                VStack(alignment: .leading, spacing: 8) {
                    Text("\(Text("Zelle").foregroundStyle(EditorialColors.textPrimary)) — fastest")
                        .font(EditorialTypography.sans(size: EditorialTypography.Size.subtitle))
                        .foregroundStyle(EditorialColors.textMuted)
                    EditorialCopyField("Send to", value: booking.paymentInstructions?.zelle ?? BookingFormat.zelle)
                    EditorialCopyField("Or phone", value: booking.paymentInstructions?.zellePhone ?? BookingFormat.zellePhone)
                    EditorialCopyField("Memo", value: booking.paymentInstructions?.memo ?? booking.number)
                }
            }

            method(icon: "banknote", name: "Cash", rest: "in person, at your session or event.")
            method(icon: "building.columns", name: "Check", rest: "hand it over in person, with \(booking.number) on the memo line.")

            Rectangle().fill(EditorialColors.borderSubtle).frame(height: 1)
            Text("We'll email you a receipt as soon as it's marked received.")
                .editorialHint()
        }
        .padding(EditorialSpacing.medium)
    }

    private func method(icon: String, name: String, rest: String) -> some View {
        HStack(alignment: .top, spacing: EditorialSpacing.small) {
            Image(systemName: icon)
                .font(.system(size: 13))
                .foregroundStyle(EditorialColors.textMuted)
                .frame(width: 18)
            Text("\(Text(name).foregroundStyle(EditorialColors.textPrimary)) — \(rest)")
                .font(EditorialTypography.sans(size: EditorialTypography.Size.subtitle))
                .foregroundStyle(EditorialColors.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
