import SwiftUI

enum SeasonalSkin: String, CaseIterable, Equatable {
    case halloween, thanksgiving, christmas, newYears

    var asset: String {
        switch self {
        case .halloween: "HalloweenWarRoom"
        case .thanksgiving: "ThanksgivingWarRoom"
        case .christmas: "ChristmasWarRoom"
        case .newYears: "NewYearsWarRoom"
        }
    }

    var title: String {
        switch self {
        case .halloween: "NIGHT WATCH"
        case .thanksgiving: "FEAST MODE"
        case .christmas: "OPERATION MERRY & BRIGHT"
        case .newYears: "MIDNIGHT COMMAND"
        }
    }

    static func active(on date: Date, calendar source: Calendar = .current, arguments: [String] = ProcessInfo.processInfo.arguments) -> SeasonalSkin? {
        if arguments.contains("--preview-halloween") { return .halloween }
        if arguments.contains("--preview-thanksgiving") { return .thanksgiving }
        if arguments.contains("--preview-christmas") { return .christmas }
        if arguments.contains("--preview-new-years") { return .newYears }

        var calendar = source
        calendar.timeZone = source.timeZone
        let day = calendar.startOfDay(for: date)
        let year = calendar.component(.year, from: day)
        func localDate(_ year: Int, _ month: Int, _ day: Int) -> Date {
            calendar.date(from: DateComponents(year: year, month: month, day: day))!
        }
        func isWithin(_ center: Date) -> Bool {
            guard let start = calendar.date(byAdding: .day, value: -1, to: center),
                  let end = calendar.date(byAdding: .day, value: 1, to: center) else { return false }
            return day >= start && day <= end
        }

        if isWithin(localDate(year, 10, 31)) { return .halloween }
        let novemberFirst = localDate(year, 11, 1)
        let firstWeekday = calendar.component(.weekday, from: novemberFirst)
        let firstThursdayOffset = (5 - firstWeekday + 7) % 7
        let thanksgiving = calendar.date(byAdding: .day, value: firstThursdayOffset + 21, to: novemberFirst)!
        if isWithin(thanksgiving) { return .thanksgiving }
        if isWithin(localDate(year, 12, 25)) { return .christmas }
        if isWithin(localDate(year, 1, 1)) || isWithin(localDate(year + 1, 1, 1)) { return .newYears }
        return nil
    }
}

struct SeasonalWarRoomBackdrop: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let skin: SeasonalSkin

    var body: some View {
        TimelineView(.animation(minimumInterval: reduceMotion ? 60 : 0.45)) { context in
            let pulse = reduceMotion ? 0.65 : (sin(context.date.timeIntervalSinceReferenceDate * 3) + 1) / 2
            ZStack {
                Image(skin.asset).resizable().scaledToFill().ignoresSafeArea()
                LinearGradient(colors: [.black.opacity(0.18), .black.opacity(0.46), .black.opacity(0.82)], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
                if skin == .christmas { christmasLights(phase: pulse) }
                if skin == .halloween { halloweenEyes(phase: pulse) }
            }
        }
        .accessibilityHidden(true)
    }

    private func christmasLights(phase: Double) -> some View {
        GeometryReader { proxy in
            ZStack {
                ForEach(0..<18, id: \.self) { index in
                    let colors: [Color] = [.red, .green, .cyan, .yellow, .pink]
                    let bulb = colors[index % colors.count]
                    let brightness = index.isMultiple(of: 2) ? phase : 1 - phase
                    let spacing = max(CGFloat(16), (proxy.size.width - 36) / 17)
                    let x = CGFloat(18) + CGFloat(index) * spacing
                    let y = CGFloat(54 + (index % 3) * 10)
                    Circle()
                        .fill(bulb)
                        .frame(width: 8, height: 8)
                        .shadow(color: bulb, radius: 7 + 8 * brightness)
                        .opacity(0.42 + 0.58 * brightness)
                        .position(x: x, y: y)
                }
            }
        }.ignoresSafeArea()
    }

    private func halloweenEyes(phase: Double) -> some View {
        GeometryReader { proxy in
            HStack {
                eyePair(phase: phase)
                Spacer()
                eyePair(phase: 1 - phase)
            }
            .padding(.horizontal, 24).padding(.top, 76)
        }.ignoresSafeArea()
    }

    private func eyePair(phase: Double) -> some View {
        HStack(spacing: 7) {
            ForEach(0..<2, id: \.self) { _ in
                Capsule().fill(.orange).frame(width: 8, height: 3)
                    .shadow(color: .orange, radius: 8 + 12 * phase)
            }
        }.opacity(0.55 + 0.45 * phase)
    }
}
