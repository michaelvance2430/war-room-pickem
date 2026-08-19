import SwiftUI

private struct PassportStamp: Identifiable {
    let id: String
    let label: String
    let name: String
    let detail: String
    let flavor: String
    let year: Int
    let symbol: String
    let color: Color
}

struct ProfilePassportView: View {
    @EnvironmentObject private var auth: AuthStore
    let userId: UUID
    let isOwner: Bool
    @State private var stamps: [PassportStamp] = []
    @State private var selected: PassportStamp?

    var body: some View {
        if !stamps.isEmpty {
            VStack(alignment: .leading, spacing: 13) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("PASSPORT").font(.system(size: 9, weight: .black)).tracking(2).foregroundStyle(.blue)
                        Text("CAMPAIGN STAMPS").font(.title3.weight(.black)).fontWidth(.condensed)
                        Text("Quiet marks from the road. Zero points. Permanent proof you were there.")
                            .font(.caption).foregroundStyle(.white.opacity(0.48)).fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer()
                    Image(systemName: "globe.americas.fill").font(.system(size: 36, weight: .black)).foregroundStyle(.blue)
                }
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 92), spacing: 9)], spacing: 9) {
                    ForEach(stamps) { stamp in
                        Button { selected = stamp } label: { stampView(stamp) }.buttonStyle(.plain)
                    }
                }
                if isOwner {
                    Text("FOUNDER BINDER · PASSPORTS REWARD PARTICIPATION, NOT PERFORMANCE.")
                        .font(.system(size: 7, weight: .black)).tracking(0.7).foregroundStyle(.white.opacity(0.32)).frame(maxWidth: .infinity)
                }
            }
            .padding(16)
            .background {
                ZStack {
                    LinearGradient(colors: [Color(red: 0.05, green: 0.12, blue: 0.20), Color(red: 0.015, green: 0.025, blue: 0.05)], startPoint: .topLeading, endPoint: .bottomTrailing)
                    ForEach(0..<9, id: \.self) { line in
                        Rectangle().fill(.white.opacity(0.018)).frame(height: 1).rotationEffect(.degrees(-12)).offset(y: CGFloat(line * 24 - 90))
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 18))
            }
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(.blue.opacity(0.48), lineWidth: 1.5))
            .overlay(alignment: .leading) { Rectangle().fill(.blue.opacity(0.22)).frame(width: 2).padding(.vertical, 13).padding(.leading, 7) }
            .task(id: userId) { await load() }
            .sheet(item: $selected) { stamp in
                PassportStampDetailView(stamp: stamp).presentationDetents([.medium]).presentationDragIndicator(.visible)
            }
        } else {
            Color.clear.frame(height: 0).task(id: userId) { await load() }
        }
    }

    private func stampView(_ stamp: PassportStamp) -> some View {
        VStack(spacing: 9) {
            PassportStampSeal(stamp: stamp, size: 88)
            VStack(spacing: 2) {
                Text(stamp.name.uppercased()).font(.system(size: 10, weight: .black)).tracking(0.7).foregroundStyle(stamp.color)
                Text("\(stamp.label) · \(String(stamp.year))").font(.system(size: 8, weight: .black)).tracking(0.8).foregroundStyle(.white.opacity(0.46))
            }
        }
        .frame(maxWidth: .infinity, minHeight: 134).padding(10)
        .background(LinearGradient(colors: [Color(red: 0.83, green: 0.80, blue: 0.67).opacity(0.13), .black.opacity(0.52)], startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 6))
        .overlay(RoundedRectangle(cornerRadius: 6).stroke(stamp.color.opacity(0.30)))
        .rotationEffect(.degrees(stamp.id == "cfb" ? -1.5 : stamp.id == "nfl" ? 1.2 : -0.6))
        .shadow(color: .black.opacity(0.38), radius: 5, y: 3)
        .accessibilityLabel("\(stamp.name), \(stamp.year). Tap for passport details.")
    }

    private func load() async {
        guard let token = auth.token else { return }
        let memberships = (try? await SupabaseAPI.leagueMemberships(token: token, userId: userId)) ?? []
        let sports = Set(memberships.map { $0.leagues.sportId.lowercased() })
        let year = Calendar.current.component(.year, from: Date())
        var rows: [PassportStamp] = []
        if sports.contains("cfb") {
            rows.append(.init(id: "cfb", label: "CFB", name: "Campus Fall", detail: "A college football campaign in the book.", flavor: "Nobody told you to collect these.", year: year, symbol: "football.fill", color: .orange))
        }
        if sports.contains("nfl") {
            rows.append(.init(id: "nfl", label: "NFL", name: "Sunday Desk", detail: "A pro football campaign in the book.", flavor: "Late window. Long memory.", year: year, symbol: "tv.fill", color: .blue))
        }
        if sports.contains("soccer_wwc") {
            rows.append(.init(id: "wwc", label: "WWC", name: "World Cup Visa", detail: "Tournament energy, passport realness.", flavor: "Emerald heat. Gold ink.", year: year, symbol: "globe.americas.fill", color: .green))
        }
        stamps = rows
    }
}

private struct PassportStampDetailView: View {
    let stamp: PassportStamp
    var body: some View {
        ZStack {
            LinearGradient(colors: [stamp.color.opacity(0.24), Color(red: 0.025, green: 0.035, blue: 0.06), .black], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            VStack(spacing: 15) {
                Text("WAR ROOM PASSPORT · \(String(stamp.year))").font(.caption2.weight(.black)).tracking(2).foregroundStyle(stamp.color)
                PassportStampSeal(stamp: stamp, size: 164).rotationEffect(.degrees(-2))
                    .shadow(color: stamp.color.opacity(0.28), radius: 18)
                Text(stamp.name.uppercased()).font(.title.weight(.black)).fontWidth(.condensed)
                Text(stamp.detail).font(.headline.weight(.semibold)).multilineTextAlignment(.center)
                Text(stamp.flavor).font(.subheadline.italic()).foregroundStyle(.white.opacity(0.52)).multilineTextAlignment(.center)
                HStack {
                    Text("VISA · \(stamp.label)")
                    Spacer()
                    Text("FILE \(stamp.id.uppercased())-\(String(stamp.year))")
                }
                .font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(.white.opacity(0.36))
                .padding(11).background(.black.opacity(0.38), in: RoundedRectangle(cornerRadius: 8))
                Text("ZERO POINTS · PERMANENT STAMP").font(.system(size: 8, weight: .black)).tracking(1.3).foregroundStyle(stamp.color)
            }.padding(24)
        }.preferredColorScheme(.dark)
    }
}

private struct PassportStampSeal: View {
    let stamp: PassportStamp
    let size: CGFloat

    var body: some View {
        ZStack {
            Circle().stroke(stamp.color.opacity(0.22), lineWidth: size * 0.055).offset(x: 1.5, y: -1)
            Circle().stroke(stamp.color.opacity(0.88), style: StrokeStyle(lineWidth: size * 0.035, dash: [size * 0.075, size * 0.035]))
            Circle().stroke(stamp.color.opacity(0.72), lineWidth: size * 0.018).padding(size * 0.09)
            Circle().stroke(stamp.color.opacity(0.34), style: StrokeStyle(lineWidth: 1, dash: [2, 5])).padding(size * 0.16)
            VStack(spacing: size * 0.03) {
                Text("WAR ROOM").font(.system(size: size * 0.085, weight: .black)).tracking(size * 0.012)
                Image(systemName: stamp.symbol).font(.system(size: size * 0.25, weight: .black))
                Text(String(stamp.year)).font(.system(size: size * 0.105, weight: .black, design: .monospaced))
            }
            .foregroundStyle(stamp.color.opacity(0.90))
            Text(stamp.label).font(.system(size: size * 0.10, weight: .black)).tracking(size * 0.012).foregroundStyle(stamp.color)
                .padding(.horizontal, size * 0.075).padding(.vertical, size * 0.018)
                .background(Color(red: 0.03, green: 0.04, blue: 0.06))
                .overlay(Rectangle().stroke(stamp.color.opacity(0.75), lineWidth: 1))
                .rotationEffect(.degrees(-7)).offset(y: size * 0.27)
            Rectangle().fill(stamp.color.opacity(0.18)).frame(width: size * 0.62, height: 1).rotationEffect(.degrees(22)).offset(y: -size * 0.18)
        }
        .frame(width: size, height: size)
        .rotationEffect(.degrees(stamp.id == "cfb" ? -5 : stamp.id == "nfl" ? 4 : -2))
        .accessibilityHidden(true)
    }
}
