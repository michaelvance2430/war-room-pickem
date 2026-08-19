import SwiftUI

private struct CampaignDogTag: Identifiable {
    let year: Int
    let league: String
    let record: String
    let finish: String
    let honor: String
    var id: String { "\(year)-\(league)" }
}

struct CampaignDogTagsView: View {
    let userId: UUID
    @State private var selected: CampaignDogTag?

    private let mariaId = UUID(uuidString: "131b404e-db8e-4adf-86f4-f78aacf2a5bc")!

    private var campaigns: [CampaignDogTag] {
        if AppIdentity.isCreator(userId) {
            return [.init(year: 2025, league: "Vonnaggio Fantasy", record: "9–9", finish: "League Runner-Up", honor: "AFC Champion")]
        }
        if userId == mariaId {
            return [.init(year: 2025, league: "Vonnaggio Fantasy", record: "9–9", finish: "Super Bowl Champion", honor: "NFC Champion")]
        }
        return []
    }

    var body: some View {
        if !campaigns.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                Text("COMPLETED CAMPAIGNS").font(.system(size: 9, weight: .black)).tracking(2).foregroundStyle(.white.opacity(0.72))
                Text("Dog tags are stamped when a season closes. Tap one for its service record.")
                    .font(.caption).foregroundStyle(.white.opacity(0.48))
                ForEach(campaigns) { tag in
                    Button { selected = tag } label: { dogTag(tag) }.buttonStyle(.plain)
                }
            }
            .padding(16)
            .background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 18))
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(.gray.opacity(0.38)))
            .sheet(item: $selected) { tag in
                DogTagServiceRecordView(tag: tag)
                    .presentationDetents([.medium]).presentationDragIndicator(.visible)
            }
        }
    }

    private func dogTag(_ tag: CampaignDogTag) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("WAR ROOM · \(tag.year) CAMPAIGN").font(.system(size: 9, weight: .black)).tracking(1.4)
                Spacer()
                Circle().fill(.black.opacity(0.75)).frame(width: 13, height: 13).overlay(Circle().stroke(.black.opacity(0.55)))
            }
            Text(tag.league.uppercased()).font(.title3.weight(.black)).lineLimit(1).minimumScaleFactor(0.75)
            Divider().overlay(.black.opacity(0.45))
            HStack {
                Text(tag.honor.uppercased())
                Spacer()
                Text("RECORD \(tag.record)")
            }.font(.system(size: 9, weight: .black)).tracking(0.5)
        }
        .foregroundStyle(Color(red: 0.08, green: 0.09, blue: 0.10))
        .padding(16)
        .background(LinearGradient(colors: [Color(white: 0.76), Color(white: 0.92), Color(white: 0.40), Color(white: 0.72), Color(white: 0.31)], startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 17))
        .overlay(RoundedRectangle(cornerRadius: 17).stroke(.white.opacity(0.55)))
        .shadow(color: .black.opacity(0.42), radius: 14, y: 8)
        .accessibilityLabel("\(tag.year) \(tag.league), \(tag.honor), record \(tag.record). Tap for service record.")
    }
}

private struct DogTagServiceRecordView: View {
    let tag: CampaignDogTag

    var body: some View {
        ZStack {
            LinearGradient(colors: [Color(white: 0.14), .black], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            VStack(spacing: 15) {
                Text("PERMANENT SERVICE RECORD").font(.caption2.weight(.black)).tracking(2).foregroundStyle(.yellow)
                Image(systemName: "tag.fill").font(.system(size: 48, weight: .black)).foregroundStyle(.gray)
                Text("\(tag.year) CAMPAIGN").font(.title.weight(.black))
                Text(tag.league.uppercased()).font(.headline.weight(.black)).foregroundStyle(.yellow)
                Divider().overlay(.white.opacity(0.2))
                record("RECORD", tag.record)
                record("HONOR", tag.honor)
                record("FINAL STANDING", tag.finish)
                Text("Campaign completed and permanently entered into the service record.")
                    .font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.52)).multilineTextAlignment(.center).padding(.top, 5)
            }.padding(24)
        }.preferredColorScheme(.dark)
    }

    private func record(_ label: String, _ value: String) -> some View {
        HStack { Text(label).font(.caption2.weight(.black)).tracking(1.2).foregroundStyle(.secondary); Spacer(); Text(value).font(.headline.weight(.black)) }
    }
}
