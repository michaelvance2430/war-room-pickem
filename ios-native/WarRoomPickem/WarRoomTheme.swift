import SwiftUI

enum WarRoomTheme {
    static let background = Color(red: 0.035, green: 0.043, blue: 0.055)
    static let panel = Color(red: 0.075, green: 0.086, blue: 0.105)
    static let panelRaised = Color(red: 0.095, green: 0.108, blue: 0.130)
    static let border = Color.white.opacity(0.10)
    static let gold = Color(red: 0.82, green: 0.67, blue: 0.22)
    static let danger = Color(red: 0.80, green: 0.15, blue: 0.12)
    static let success = Color(red: 0.25, green: 0.72, blue: 0.39)
    static let muted = Color.white.opacity(0.62)
}

extension View {
    func warRoomPanel(cornerRadius: CGFloat = 18) -> some View {
        self
            .background(WarRoomTheme.panel, in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(WarRoomTheme.border, lineWidth: 1)
            )
    }
}
