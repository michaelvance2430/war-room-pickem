import SwiftUI

enum NflSeasonTimeline {
    static let regularSeasonWeeks = 18
    static let playoffRounds = 4
    static let playableWeeks = regularSeasonWeeks + playoffRounds
    static let elapsedCalendarWeeks = playableWeeks + 1
    static let hasConferenceChampionshipBye = true

    /// The NFL command cycle turns over Tuesday. The selectable game slate
    /// opens Thursday and Monday Night Football closes it.
    static func operationalWeek(containing date: Date, calendar input: Calendar = .current) -> (start: Date, end: Date)? {
        let calendar = input
        let day = calendar.startOfDay(for: date)
        let weekday = calendar.component(.weekday, from: day)
        let daysSinceTuesday = (weekday - 3 + 7) % 7
        guard let start = calendar.date(byAdding: .day, value: -daysSinceTuesday, to: day),
              let end = calendar.date(byAdding: .day, value: 6, to: start) else { return nil }
        return (start, end)
    }

    static func regularSeasonSlate(week: Int, openingThursday: Date, calendar: Calendar = .current) -> (start: Date, end: Date)? {
        guard (1...regularSeasonWeeks).contains(week),
              let start = calendar.date(byAdding: .day, value: (week - 1) * 7, to: openingThursday),
              let end = calendar.date(byAdding: .day, value: 4, to: start) else { return nil }
        return (start, end)
    }
}

enum NflSeasonPhase: String {
    case regularSeason
    case wildCard
    case divisional
    case conferenceChampionships
    case superBowl
    case seasonComplete

    static func phase(week: Int) -> NflSeasonPhase {
        switch week {
        case ...NflSeasonTimeline.regularSeasonWeeks: return .regularSeason
        case 19: return .wildCard
        case 20: return .divisional
        case 21: return .conferenceChampionships
        case 22: return .superBowl
        default: return .seasonComplete
        }
    }

    var kicker: String {
        switch self {
        case .regularSeason: return "WEEKS 1–18 · SUNDAY OPERATIONS"
        case .wildCard: return "PLAYOFF PHASE I · WILD CARD"
        case .divisional: return "PLAYOFF PHASE II · DIVISIONAL"
        case .conferenceChampionships: return "PLAYOFF PHASE III · CONFERENCE TITLES"
        case .superBowl: return "PLAYOFF PHASE IV · SUPER BOWL"
        case .seasonComplete: return "NFL CAMPAIGN · COMPLETE"
        }
    }

    var title: String {
        switch self {
        case .regularSeason: return "EVERY SUNDAY LEAVES A RECEIPT."
        case .wildCard: return "FOURTEEN ENTER. THE BRACKET BITES BACK."
        case .divisional: return "THE ONE-SEEDS HAVE ENTERED THE ROOM."
        case .conferenceChampionships: return "TWO CONFERENCES. TWO TICKETS."
        case .superBowl: return "ONE PICK FOR THE WHOLE DAMN SEASON."
        case .seasonComplete: return "THE FINAL RECEIPT IS ON FILE."
        }
    }

    var detail: String {
        switch self {
        case .regularSeason: return "No preseason. Five games, confidence, Best Bet, and one prop from Week 1 through Week 18."
        case .wildCard: return "Build the 13-decision playoff bracket. Conference reseeding is handled automatically."
        case .divisional: return "The lowest remaining seed visits the one-seed. Your Wild Card calls determine the board."
        case .conferenceChampionships: return "Choose the AFC and NFC champions, then send them to the final table."
        case .superBowl: return "Name the champion—or authorize JDAM and surrender all 13 decisions to the machine."
        case .seasonComplete: return "Standings, scorecards, and the championship bracket remain available as permanent evidence."
        }
    }
}

struct NflHomeBackdrop: View {
    let phase: NflSeasonPhase

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(red: 0.015, green: 0.04, blue: 0.11), Color(red: 0.005, green: 0.01, blue: 0.025), Color(red: 0.14, green: 0.008, blue: 0.028)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            GeometryReader { proxy in
                Path { path in
                    let band: CGFloat = 76
                    stride(from: -proxy.size.height, through: proxy.size.width, by: band).forEach { x in
                        path.move(to: CGPoint(x: x, y: 0))
                        path.addLine(to: CGPoint(x: x + proxy.size.height * 0.33, y: proxy.size.height))
                    }
                }
                .stroke(.white.opacity(0.028), lineWidth: 1)
                Path { path in
                    let center = proxy.size.width / 2
                    path.move(to: CGPoint(x: center, y: 0))
                    path.addLine(to: CGPoint(x: center, y: proxy.size.height))
                    for y in stride(from: 80.0, through: proxy.size.height, by: 138.0) {
                        path.move(to: CGPoint(x: center - 9, y: y)); path.addLine(to: CGPoint(x: center + 9, y: y))
                    }
                }.stroke(.white.opacity(0.045), lineWidth: 1)
            }
            RadialGradient(colors: [Color.cyan.opacity(0.16), .clear], center: .topLeading, startRadius: 10, endRadius: 330)
            RadialGradient(colors: [accent.opacity(0.22), .clear], center: .topTrailing, startRadius: 20, endRadius: 390)
        }
        .ignoresSafeArea()
    }

    private var accent: Color { phase == .regularSeason ? .blue : .red }
}

struct NflBroadcastHeader: View {
    let leagueName: String
    let week: Int
    let dateRange: String?
    let commissioner: Bool
    var kickoff: Date? = nil

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                HStack(spacing: 6) {
                    Circle().fill(.red).frame(width: 7, height: 7).shadow(color: .red, radius: 5)
                    Text("WAR ROOM LIVE").font(.system(size: 9, weight: .black)).tracking(1.5)
                }
                Spacer()
                Text(commissioner ? "COMMISSIONER FEED" : "PLAYER FEED")
                    .font(.system(size: 8, weight: .black)).tracking(1.1).foregroundStyle(.cyan)
            }
            .padding(.horizontal, 14).padding(.vertical, 10)
            .background(Color(red: 0.03, green: 0.17, blue: 0.36))

            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("PRO FOOTBALL COMMAND")
                        .font(.system(size: 8, weight: .black)).tracking(1.65).foregroundStyle(.white.opacity(0.46))
                    Text(leagueName.uppercased())
                        .font(.system(size: 25, weight: .black)).fontWidth(.condensed).lineLimit(1).minimumScaleFactor(0.62)
                }
                Spacer(minLength: 4)
                VStack(spacing: 0) {
                    Text("WEEK").font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(.white.opacity(0.48))
                    Text("\(week)").font(.system(size: 34, weight: .black, design: .rounded)).monospacedDigit()
                }
                .frame(width: 58).padding(.vertical, 7)
                .background(.white.opacity(0.07))
                .overlay(alignment: .leading) { Rectangle().fill(.red).frame(width: 3) }
            }
            .padding(14).background(.black.opacity(0.92))

            HStack {
                Label("THURSDAY KICKOFF", systemImage: "bolt.fill")
                Spacer()
                Text(dateRange ?? "THURSDAY → MONDAY")
                Spacer()
                Label("MONDAY CLOSE", systemImage: "moon.stars.fill")
            }
            .font(.system(size: 7, weight: .black)).tracking(0.65).foregroundStyle(.white.opacity(0.55))
            .padding(.horizontal, 12).padding(.vertical, 7)
            .background(Color(red: 0.13, green: 0.015, blue: 0.035))

            if let kickoff {
                CompactMissionClockRow(kickoff: kickoff, sportId: "nfl", week: week)
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(.black.opacity(0.96))
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(.white.opacity(0.16)))
        .shadow(color: .blue.opacity(0.24), radius: 18, y: 8)
    }
}

struct NflPhaseHomeBanner: View {
    let phase: NflSeasonPhase

    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 4).fill(accent.opacity(0.20))
                Image(systemName: phase == .regularSeason ? "football.fill" : "trophy.fill")
                    .font(.title.weight(.black)).foregroundStyle(.white)
            }.frame(width: 58, height: 72)
            VStack(alignment: .leading, spacing: 5) {
                Text(phase.kicker).font(.system(size: 8, weight: .black)).tracking(1.4).foregroundStyle(accent)
                Text(phase.title).font(.headline.weight(.black)).fontWidth(.condensed)
                Text(phase.detail).font(.caption2.weight(.semibold)).foregroundStyle(.white.opacity(0.58)).fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(14)
        .background(LinearGradient(colors: [.black.opacity(0.93), Color(red: 0.02, green: 0.10, blue: 0.23)], startPoint: .leading, endPoint: .trailing), in: RoundedRectangle(cornerRadius: 8))
        .overlay(alignment: .bottom) { Rectangle().fill(LinearGradient(colors: [accent, .white, .red], startPoint: .leading, endPoint: .trailing)).frame(height: 3) }
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(.white.opacity(0.14)))
    }

    private var accent: Color { phase == .regularSeason ? .blue : .red }
}

struct NflScoreboardStrip: View {
    let players: Int
    let games: Int
    let cardStatus: String
    let commissioner: Bool

    var body: some View {
        HStack(spacing: 1) {
            cell(value: "\(players)", label: "ROSTER")
            cell(value: "\(games)", label: "ON SLATE")
            cell(value: cardStatus, label: commissioner ? "CARDS IN" : "MY CARD")
        }
        .padding(1).background(.white.opacity(0.17), in: RoundedRectangle(cornerRadius: 7))
        .clipShape(RoundedRectangle(cornerRadius: 7))
    }

    private func cell(value: String, label: String) -> some View {
        VStack(spacing: 2) {
            Text(value).font(.system(size: 21, weight: .black, design: .rounded)).monospacedDigit().minimumScaleFactor(0.65)
            Text(label).font(.system(size: 7, weight: .black)).tracking(1.1).foregroundStyle(.cyan)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 11).background(.black.opacity(0.88))
    }
}

struct NflPrimaryActionCard: View {
    let kicker: String
    let title: String
    let detail: String
    let icon: String
    var urgent = false
    @State private var pulse = false

    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 4).fill((urgent ? Color.white : Color.blue).opacity(urgent ? (pulse ? 0.32 : 0.14) : 0.20))
                Image(systemName: icon).font(.title2.weight(.black)).foregroundStyle(.white)
            }.frame(width: 54, height: 58)
            VStack(alignment: .leading, spacing: 4) {
                Text(kicker).font(.system(size: urgent ? 10 : 8, weight: .black)).tracking(1.3).foregroundStyle(urgent ? .white : .cyan)
                Text(title).font(.headline.weight(.black)).foregroundStyle(.white)
                Text(detail).font(.caption2.weight(.semibold)).foregroundStyle(.white.opacity(0.54)).lineLimit(3)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right").font(.caption.weight(.black)).foregroundStyle(urgent ? .red : .cyan)
        }
        .padding(urgent ? 18 : 14)
        .background(urgent ? Color.red.opacity(pulse ? 0.98 : 0.68) : Color.black.opacity(0.88), in: RoundedRectangle(cornerRadius: 8))
        .overlay(alignment: .leading) { Rectangle().fill(urgent ? .white : .blue).frame(width: urgent ? 8 : 4).padding(.vertical, 8) }
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(urgent ? Color.white.opacity(pulse ? 1 : 0.48) : Color.blue.opacity(0.55), lineWidth: urgent ? (pulse ? 5 : 2) : 1))
        .shadow(color: urgent ? .red.opacity(pulse ? 0.9 : 0.4) : .clear, radius: urgent ? (pulse ? 30 : 14) : 0, y: urgent ? 8 : 0)
        .scaleEffect(urgent && pulse ? 1.012 : 1)
        .animation(urgent ? .easeInOut(duration: 0.7).repeatForever(autoreverses: true) : .default, value: pulse)
        .onAppear { if urgent { pulse = true } }
    }
}

struct NflBroadcastSectionLabel: View {
    let title: String
    let detail: String

    var body: some View {
        HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.caption.weight(.black)).tracking(1.55)
                Text(detail).font(.system(size: 7, weight: .black)).tracking(0.9).foregroundStyle(.white.opacity(0.38))
            }
            Spacer()
            HStack(spacing: 3) { Rectangle().frame(width: 20); Rectangle().fill(.red).frame(width: 7) }
                .frame(height: 3).foregroundStyle(.blue)
        }
    }
}

struct NflSundayOperationsPanel: View {
    let week: Int

    var body: some View {
        HStack(spacing: 13) {
            ZStack {
                RoundedRectangle(cornerRadius: 12).fill(.blue.opacity(0.16))
                RoundedRectangle(cornerRadius: 12).stroke(.blue.opacity(0.55))
                Image(systemName: "football.fill").font(.title2.weight(.black)).foregroundStyle(.white)
            }.frame(width: 50, height: 50)
            VStack(alignment: .leading, spacing: 4) {
                Text("NFL WEEK \(week) · PLAYER COMMAND")
                    .font(.system(size: 8, weight: .black)).tracking(1.35).foregroundStyle(.cyan)
                Text("PLAYER PICKS ONLY").font(.headline.weight(.black))
                Text("You own every regular-season call. JDAM stays sealed until the playoff bracket.")
                    .font(.caption2.weight(.semibold)).foregroundStyle(.white.opacity(0.55)).fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 17))
        .overlay(RoundedRectangle(cornerRadius: 17).stroke(.blue.opacity(0.42)))
    }
}

struct NflPickMissionHeader: View {
    let leagueName: String
    let week: Int
    let complete: Int
    let total: Int
    let saved: Bool
    let ready: Bool

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                HStack(spacing: 6) {
                    Circle().fill(ready ? .cyan : .red).frame(width: 7, height: 7)
                    Text(saved ? "CARD ON FILE" : "LIVE PICK DESK").font(.system(size: 8, weight: .black)).tracking(1.45)
                }
                Spacer()
                Text("\(complete)/\(total) CALLS").font(.system(size: 9, weight: .black)).monospacedDigit().foregroundStyle(.cyan)
            }.padding(11).background(Color(red: 0.025, green: 0.15, blue: 0.34))
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(leagueName.uppercased()).font(.caption.weight(.black)).tracking(1).foregroundStyle(.white.opacity(0.48))
                    Text("WEEK \(week) · BUILD THE CARD").font(.system(size: 28, weight: .black)).fontWidth(.condensed)
                    Text("FIVE GAMES · CONFIDENCE · BEST BET · ONE PROP").font(.system(size: 7, weight: .black)).tracking(0.75).foregroundStyle(.white.opacity(0.46))
                }
                Spacer()
                Image(systemName: "football.fill").font(.system(size: 34, weight: .black)).foregroundStyle(.white)
            }.padding(14).background(.black.opacity(0.92))
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Color.white.opacity(0.08)
                    Rectangle().fill(LinearGradient(colors: [.blue, .cyan, .red], startPoint: .leading, endPoint: .trailing))
                        .frame(width: proxy.size.width * CGFloat(complete) / CGFloat(max(total, 1)))
                }
            }.frame(height: 4)
        }
        .clipShape(RoundedRectangle(cornerRadius: 7))
        .overlay(RoundedRectangle(cornerRadius: 7).stroke(.blue.opacity(0.55)))
    }
}
