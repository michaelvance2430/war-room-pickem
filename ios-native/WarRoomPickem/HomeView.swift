import SwiftUI

struct HomeView: View {
    var body: some View {
        ZStack {
            WarRoomTheme.background.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 16) {
                    masthead
                    missionCard
                    actionGrid
                    footerActions
                }
                .padding(.horizontal, 16)
                .padding(.top, 10)
                .padding(.bottom, 32)
            }
        }
    }

    private var masthead: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(.black)
                    Image(systemName: "scope")
                        .font(.title2.weight(.black))
                        .foregroundStyle(WarRoomTheme.gold)
                }
                .frame(width: 46, height: 46)

                VStack(alignment: .leading, spacing: 1) {
                    Text("WAR ROOM")
                        .font(.headline.weight(.black))
                        .tracking(1.4)
                    Text("SATURDAY SITUATION ROOM")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(WarRoomTheme.muted)
                        .tracking(0.7)
                }

                Spacer()

                Button(action: {}) {
                    Image(systemName: "square.and.arrow.up")
                        .font(.body.weight(.bold))
                        .frame(width: 42, height: 42)
                }
                .buttonStyle(.plain)
                .foregroundStyle(.white)
                .background(WarRoomTheme.panelRaised, in: Circle())
            }

            Text("SATURDAY\nSITUATION ROOM")
                .font(.system(size: 34, weight: .black, design: .rounded))
                .minimumScaleFactor(0.75)
                .lineSpacing(-4)

            Text("Good teams show up. Bad picks don’t.")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(WarRoomTheme.muted)
        }
    }

    private var missionCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("THIS WEEK")
                        .font(.caption.weight(.black))
                        .tracking(1.6)
                        .foregroundStyle(WarRoomTheme.gold)
                    Text("Week 0")
                        .font(.title2.weight(.black))
                }
                Spacer()
                Text("OPEN")
                    .font(.caption2.weight(.black))
                    .tracking(1.2)
                    .foregroundStyle(WarRoomTheme.success)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(WarRoomTheme.success.opacity(0.12), in: Capsule())
            }

            Divider().overlay(WarRoomTheme.border)

            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("MISSION")
                        .font(.caption2.weight(.black))
                        .tracking(1.2)
                        .foregroundStyle(WarRoomTheme.muted)
                    Text("Make your picks")
                        .font(.title3.weight(.bold))
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.headline.weight(.black))
                    .foregroundStyle(WarRoomTheme.gold)
            }

            Button(action: {}) {
                HStack {
                    Image(systemName: "scope")
                    Text("ENTER PICKS")
                    Spacer()
                    Image(systemName: "arrow.right")
                }
                .font(.subheadline.weight(.black))
                .tracking(0.8)
                .foregroundStyle(.black)
                .padding(.horizontal, 16)
                .frame(maxWidth: .infinity, minHeight: 52)
                .background(WarRoomTheme.gold, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .buttonStyle(.plain)
        }
        .padding(18)
        .warRoomPanel(cornerRadius: 20)
    }

    private var actionGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            homeTile(title: "Standings", subtitle: "See who’s surviving", icon: "list.number")
            homeTile(title: "Locker Room", subtitle: "Talk your shit", icon: "bubble.left.and.bubble.right.fill")
            homeTile(title: "The Dispatch", subtitle: "This week’s damage report", icon: "newspaper.fill")
            homeTile(title: "Profile", subtitle: "Rank, Arsenal, hardware", icon: "person.crop.circle.fill")
        }
    }

    private func homeTile(title: String, subtitle: String, icon: String) -> some View {
        Button(action: {}) {
            VStack(alignment: .leading, spacing: 14) {
                Image(systemName: icon)
                    .font(.title2.weight(.bold))
                    .foregroundStyle(WarRoomTheme.gold)

                Spacer(minLength: 6)

                Text(title)
                    .font(.headline.weight(.black))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(WarRoomTheme.muted)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(16)
            .frame(maxWidth: .infinity, minHeight: 142, alignment: .leading)
            .warRoomPanel(cornerRadius: 18)
        }
        .buttonStyle(.plain)
    }

    private var footerActions: some View {
        VStack(spacing: 10) {
            Button(action: {}) {
                Label("Join with code", systemImage: "person.badge.plus")
                    .font(.subheadline.weight(.bold))
                    .frame(maxWidth: .infinity, minHeight: 48)
            }
            .buttonStyle(.plain)
            .foregroundStyle(.white)
            .warRoomPanel(cornerRadius: 14)

            Button(action: {}) {
                Label("Start new league", systemImage: "plus.circle.fill")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(WarRoomTheme.muted)
            }
            .buttonStyle(.plain)
            .padding(.top, 4)
        }
    }
}

#Preview {
    HomeView()
        .preferredColorScheme(.dark)
}
