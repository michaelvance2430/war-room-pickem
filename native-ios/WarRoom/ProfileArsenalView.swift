import SwiftUI

struct ProfileArsenalView: View {
    @EnvironmentObject private var auth: AuthStore
    let userId: UUID
    let sportId: String
    @State private var service = WeaponServiceSummary.empty
    @State private var loading = true
    private var identity: SportIdentity { SportIdentity(sportId) }
    private var accent: Color { identity.isNFL ? .cyan : .yellow }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(identity.isNFL ? "PRO FOOTBALL ORDNANCE FILE" : "PROFILE ARSENAL").font(.system(size: 9, weight: .black)).tracking(2).foregroundStyle(accent)
                    Text("WEAPONS SERVICE RECORD").font(.title3.weight(.black)).fontWidth(.condensed)
                    Text(loading ? "PULLING PERMANENT ORDERS…" : "\(service.totalAuthorizations) CAREER AUTHORIZATION\(service.totalAuthorizations == 1 ? "" : "S") · \(service.campaigns) CAMPAIGN\(service.campaigns == 1 ? "" : "S")")
                        .font(.system(size: 8, weight: .black)).tracking(0.7).foregroundStyle(.white.opacity(0.46))
                }
                Spacer()
                ArsenalInsignia(kind: .maps, size: 58, active: service.totalAuthorizations > 0, accentOverride: identity.isNFL ? .cyan : nil)
            }
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 9) {
                if sportId.lowercased() == "nfl" {
                    weapon(.jdam, "JDAM", service.jdams)
                } else if sportId.lowercased() == "cbb" {
                    weapon(.hellfire, "HELLFIRE", service.hellfires)
                } else {
                    weapon(.nuke, "TACTICAL NUKE", service.tacticalNukes)
                    weapon(.deadHand, "DEAD HAND", service.deadHands)
                }
            }
            Text("REHEARSAL IS TEMPORARY. PRODUCTION BECOMES HISTORY.")
                .font(.system(size: 7, weight: .black)).tracking(0.9).foregroundStyle(.white.opacity(0.38)).frame(maxWidth: .infinity)
        }
        .padding(16)
        .background(LinearGradient(colors: [Color(red: 0.07, green: 0.10, blue: 0.16), .black.opacity(0.94)], startPoint: .top, endPoint: .bottom), in: UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: 22, bottomTrailingRadius: 4, topTrailingRadius: 22))
        .overlay(UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: 22, bottomTrailingRadius: 4, topTrailingRadius: 22).stroke(.gray.opacity(0.55), lineWidth: 1.5))
        .task(id: userId) { await load() }
    }

    private func weapon(_ kind: ArsenalKind, _ name: String, _ count: Int) -> some View {
        VStack(spacing: 7) {
            ArsenalInsignia(kind: kind, size: 58, active: count > 0, accentOverride: identity.isNFL && kind == .jdam ? .blue : nil)
            Text(name).font(.system(size: 9, weight: .black)).tracking(0.5).multilineTextAlignment(.center)
            Text(count > 0 ? "\(count) CAREER CALL\(count == 1 ? "" : "S")" : "NOT YET CALLED")
                .font(.system(size: 7, weight: .black)).foregroundStyle(count > 0 ? accent : .white.opacity(0.28))
        }
        .frame(maxWidth: .infinity, minHeight: 105).padding(9)
        .background((count > 0 ? accent.opacity(0.09) : Color.black.opacity(0.38)), in: RoundedRectangle(cornerRadius: identity.isNFL ? 6 : 12))
        .overlay(RoundedRectangle(cornerRadius: identity.isNFL ? 6 : 12).stroke(count > 0 ? accent.opacity(0.48) : .gray.opacity(0.28)))
    }

    private func load() async {
        guard let token = auth.token else { loading = false; return }
        service = (try? await SupabaseAPI.weaponServiceSummary(token: token, userId: userId)) ?? .empty
        loading = false
    }
}

private enum ArsenalKind: Equatable { case maps, nuke, deadHand, jdam, hellfire }

private struct ArsenalInsignia: View {
    let kind: ArsenalKind
    let size: CGFloat
    let active: Bool
    var accentOverride: Color? = nil

    private var accent: Color {
        guard active else { return .gray }
        if let accentOverride { return accentOverride }
        switch kind { case .maps: return .yellow; case .nuke: return .green; case .deadHand: return .red; case .jdam: return .blue; case .hellfire: return .orange }
    }

    var body: some View {
        ZStack {
            ArsenalHexagon().fill(.black.opacity(0.92)).overlay(ArsenalHexagon().stroke(.gray.opacity(0.7), lineWidth: 2))
            Circle().stroke(accent.opacity(0.75), lineWidth: 2).padding(size * 0.12)
            mark.padding(size * 0.22)
        }
        .frame(width: size, height: size)
        .foregroundStyle(active ? accent : .gray.opacity(0.48))
        .shadow(color: active ? accent.opacity(0.34) : .clear, radius: 8)
        .accessibilityLabel(label)
    }

    @ViewBuilder private var mark: some View {
        switch kind {
        case .maps:
            HStack(spacing: 1) { Rectangle(); Rectangle().opacity(0.55); Rectangle() }.rotationEffect(.degrees(-8))
                .overlay(Path { p in p.move(to: .init(x: 3, y: 22)); p.addLine(to: .init(x: 15, y: 10)); p.addLine(to: .init(x: 27, y: 17)) }.stroke(.red, lineWidth: 3))
        case .nuke:
            ZStack { Capsule().frame(width: 11); Circle().stroke(lineWidth: 3).frame(width: 28, height: 28); Circle().frame(width: 7, height: 7) }
        case .deadHand:
            Image(systemName: "hand.raised.fill").resizable().scaledToFit()
        case .jdam:
            ZStack { Capsule().frame(width: 9); Circle().stroke(lineWidth: 2); Rectangle().frame(width: 2); Rectangle().frame(height: 2) }
        case .hellfire:
            ZStack { Image(systemName: "flame.fill").resizable().scaledToFit(); Capsule().frame(width: 7, height: 30).rotationEffect(.degrees(45)).foregroundStyle(.white.opacity(0.75)) }
        }
    }

    private var label: String {
        switch kind { case .maps: return "M.A.P.'s insignia"; case .nuke: return "Tactical Nuclear Button insignia"; case .deadHand: return "Dead Hand insignia"; case .jdam: return "JDAM insignia"; case .hellfire: return "Hellfire insignia" }
    }
}

private struct ArsenalHexagon: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.midX, y: rect.minY + 2))
        path.addLine(to: CGPoint(x: rect.maxX - 8, y: rect.minY + rect.height * 0.22))
        path.addLine(to: CGPoint(x: rect.maxX - 2, y: rect.midY))
        path.addLine(to: CGPoint(x: rect.maxX - 10, y: rect.maxY - 8))
        path.addLine(to: CGPoint(x: rect.midX, y: rect.maxY - 2))
        path.addLine(to: CGPoint(x: rect.minX + 10, y: rect.maxY - 8))
        path.addLine(to: CGPoint(x: rect.minX + 2, y: rect.midY))
        path.addLine(to: CGPoint(x: rect.minX + 8, y: rect.minY + rect.height * 0.22))
        path.closeSubpath()
        return path
    }
}
