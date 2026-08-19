import SwiftUI

struct LobbyRoom: Decodable, Identifiable, Sendable {
    let id: UUID
    let name: String
    let sportId: String
    let accessMode: String
    let humanCount: Int
    let maxHumanMembers: Int
    let seatsLeft: Int
    let isFull: Bool
    let isMember: Bool
    let requestStatus: String?

    enum CodingKeys: String, CodingKey {
        case id, name
        case sportId = "sport_id"
        case accessMode = "access_mode"
        case humanCount = "human_count"
        case maxHumanMembers = "max_human_members"
        case seatsLeft = "seats_left"
        case isFull = "is_full"
        case isMember = "is_member"
        case requestStatus = "request_status"
    }
}

struct LobbyPlayerLeader: Decodable, Identifiable, Sendable {
    let gameHandle: String
    let cheevoPoints: Int
    var id: String { gameHandle }
    enum CodingKeys: String, CodingKey {
        case gameHandle = "game_handle"
        case cheevoPoints = "cheevo_points"
    }
}

struct LobbyCrewLeader: Decodable, Identifiable, Sendable {
    let crewName: String
    let cheevoPoints: Int
    var id: String { crewName }
    enum CodingKeys: String, CodingKey {
        case crewName = "crew_name"
        case cheevoPoints = "cheevo_points"
    }
}

private struct LobbyRoomsPayload: Decodable { let rooms: [LobbyRoom] }
private struct LobbyBoardsPayload: Decodable {
    let players: [LobbyPlayerLeader]
    let crews: [LobbyCrewLeader]
}

extension SupabaseAPI {
    static func lobbyRooms(token: String) async throws -> [LobbyRoom] {
        let payload: LobbyRoomsPayload = try await lobbyRPC(
            "list_lobby_rooms",
            token: token,
            body: ["p_sport_id": NSNull(), "p_limit": 60]
        )
        return payload.rooms
    }

    static func lobbyLeaderboards(token: String) async throws -> (players: [LobbyPlayerLeader], crews: [LobbyCrewLeader]) {
        let payload: LobbyBoardsPayload = try await lobbyRPC("list_lobby_leaderboards", token: token, body: [:])
        return (payload.players, payload.crews)
    }

    static func requestLobbyRoom(token: String, leagueId: UUID) async throws {
        let _: LobbyActionPayload = try await lobbyRPC(
            "request_private_room_join",
            token: token,
            body: ["p_league_id": leagueId.uuidString.lowercased()]
        )
    }

    static func joinPublicLobbyRoom(token: String, leagueId: UUID) async throws {
        let _: LobbyActionPayload = try await lobbyRPC(
            "join_open_league_by_id",
            token: token,
            body: ["p_league_id": leagueId.uuidString.lowercased()]
        )
    }

    private static func lobbyRPC<T: Decodable>(_ name: String, token: String, body: [String: Any]) async throws -> T {
        let url = SupabaseConfiguration.baseURL.appending(path: "rest/v1/rpc/\(name)")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(SupabaseConfiguration.publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let raw = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])
            let message = (raw?["message"] as? String) ?? (raw?["error"] as? String) ?? "The Lobby refused the request."
            throw LobbyRequestError(message: message)
        }
        return try JSONDecoder().decode(T.self, from: data)
    }
}

private struct LobbyActionPayload: Decodable {
    let ok: Bool?
    let status: String?
}

struct LeagueCreationPayload: Decodable, Sendable {
    let ok: Bool
    let leagueId: UUID
    let code: String
    let sportId: String
    let name: String

    enum CodingKeys: String, CodingKey {
        case ok, code, name
        case leagueId = "league_id"
        case sportId = "sport_id"
    }
}

extension SupabaseAPI {
    static func createLeague(
        token: String,
        name: String,
        sportId: String,
        visibility: String,
        crystalBallEnabled: Bool,
        maxMembers: Int
    ) async throws -> LeagueCreationPayload {
        let created: LeagueCreationPayload = try await lobbyRPC(
            "create_league_with_commissioner_seat",
            token: token,
            body: [
                "p_name": name,
                "p_sport_id": sportId,
                "p_list_as_open": visibility == "public",
                "p_crystal_ball_enabled": crystalBallEnabled,
                "p_current_week": SportIdentity(sportId).openingWeek,
                "p_cut_percent": 50,
                "p_max_human_members": maxMembers,
                "p_late_join_policy": "reinforcement_credit"
            ]
        )
        let _: LobbyActionPayload = try await lobbyRPC(
            "set_league_lobby_visibility",
            token: token,
            body: ["p_league_id": created.leagueId.uuidString.lowercased(), "p_visibility": visibility]
        )
        return created
    }
}

private struct LobbyRequestError: LocalizedError {
    let message: String
    var errorDescription: String? {
        if message.localizedCaseInsensitiveContains("league_full") { return "That room is full." }
        if message.localizedCaseInsensitiveContains("not_requestable") { return "That private room is not taking requests." }
        return message.replacingOccurrences(of: "lobby:", with: "").replacingOccurrences(of: "_", with: " ")
    }
}

struct LobbyView: View {
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.dismiss) private var dismiss
    @State private var rooms: [LobbyRoom] = []
    @State private var players: [LobbyPlayerLeader] = []
    @State private var crews: [LobbyCrewLeader] = []
    @State private var selection: String?
    @State private var loading = true
    @State private var busyRoom: UUID?
    @State private var notice: String?

    private var publicRooms: [LobbyRoom] { rooms.filter { $0.accessMode == "public" } }
    private var privateRooms: [LobbyRoom] { rooms.filter { $0.accessMode == "private" } }
    private var selectedRooms: [LobbyRoom] {
        selection == "public" ? publicRooms : selection == "private" ? privateRooms : []
    }

    var body: some View {
        ZStack {
            Image("MusterBackdrop").resizable().scaledToFill().ignoresSafeArea().opacity(0.58)
            LinearGradient(colors: [.black.opacity(0.12), .black.opacity(0.72), .black], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            ScrollView {
                VStack(spacing: 17) {
                    titleBlock
                    createLeagueDoor
                    playerBoard
                    crewBoard
                    roomDoors
                    if let selection { roomList(title: selection) }
                    if let notice {
                        Text(notice).font(.footnote.weight(.bold)).foregroundStyle(.yellow)
                            .frame(maxWidth: .infinity, alignment: .leading).padding(13)
                            .background(.yellow.opacity(0.10), in: RoundedRectangle(cornerRadius: 13))
                            .overlay(RoundedRectangle(cornerRadius: 13).stroke(.yellow.opacity(0.32)))
                    }
                    Text("YOU BROWSE FIRST. A SEAT IS NEVER ASSIGNED UNTIL YOU CHOOSE A ROOM.")
                        .font(.system(size: 8, weight: .black)).tracking(1.15).foregroundStyle(.white.opacity(0.35))
                        .multilineTextAlignment(.center).padding(.top, 4)
                }.padding(.horizontal, 15).padding(.top, 12).padding(.bottom, 42)
            }
            .refreshable { await load() }
        }
        .navigationTitle("The Muster").navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private var titleBlock: some View {
        VStack(spacing: 8) {
            Label("WAR ROOM NETWORK", systemImage: "shield.lefthalf.filled")
                .font(.system(size: 9, weight: .black)).tracking(2.4).foregroundStyle(.green)
            Text("THE MUSTER").font(.system(size: 36, weight: .black)).fontWidth(.condensed).minimumScaleFactor(0.72).lineLimit(1)
            Text("FIND YOUR CREW. MAKE YOUR NAME.")
                .font(.system(size: 12, weight: .black)).tracking(1.4).foregroundStyle(.green)
            Text("See who owns the board. Find a War Room. Claim your seat before somebody else does.")
                .font(.footnote.weight(.semibold)).foregroundStyle(.white.opacity(0.62)).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 15).padding(.vertical, 17)
        .background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 22))
        .overlay(RoundedRectangle(cornerRadius: 22).stroke(.green.opacity(0.34)))
    }

    private var createLeagueDoor: some View {
        NavigationLink {
            CreateLeagueView()
        } label: {
            HStack(spacing: 13) {
                Image(systemName: "plus.circle.fill").font(.title.weight(.black)).foregroundStyle(.black)
                VStack(alignment: .leading, spacing: 3) {
                    Text("BUILD YOUR OWN CREW").font(.system(size: 8, weight: .black)).tracking(1.5).foregroundStyle(.black.opacity(0.58))
                    Text("CREATE NEW LEAGUE").font(.headline.weight(.black)).foregroundStyle(.black)
                }
                Spacer()
                Image(systemName: "chevron.right").font(.headline.weight(.black)).foregroundStyle(.black)
            }
            .padding(16).background(.green, in: RoundedRectangle(cornerRadius: 18))
        }.buttonStyle(.plain)
    }

    private var playerBoard: some View {
        VStack(alignment: .leading, spacing: 13) {
            boardHeader("LIVE CHEEVO VOLTAGE", "TOP 10 PLAYERS", .green)
            if loading && players.isEmpty { ProgressView("Reading the board…").tint(.green).frame(maxWidth: .infinity).padding(24) }
            else {
                HStack(alignment: .top, spacing: 8) {
                    ForEach(Array(players.prefix(3).enumerated()), id: \.element.id) { index, player in
                        podiumPlayer(player, rank: index + 1)
                    }
                }
                ForEach(Array(players.dropFirst(3).prefix(7).enumerated()), id: \.element.id) { offset, player in
                    HStack(spacing: 11) {
                        Text("\(offset + 4)").font(.headline.weight(.black)).foregroundStyle(.white.opacity(0.28)).frame(width: 24)
                        Text(player.gameHandle).font(.subheadline.weight(.black)).lineLimit(1)
                        Spacer()
                        Text("\(player.cheevoPoints)").font(.headline.weight(.black)).monospacedDigit().foregroundStyle(.green)
                        Text("PTS").font(.system(size: 7, weight: .black)).foregroundStyle(.white.opacity(0.3))
                    }.padding(.vertical, 1)
                }
            }
        }.musterPanel(.green)
    }

    private func podiumPlayer(_ player: LobbyPlayerLeader, rank: Int) -> some View {
        VStack(spacing: 7) {
            Text("#\(rank)").font(.caption.weight(.black)).foregroundStyle(rank == 1 ? .yellow : .green)
            Image(systemName: rank == 1 ? "crown.fill" : rank == 2 ? "bolt.fill" : "flame.fill")
                .font(.title3.weight(.black)).foregroundStyle(rank == 1 ? .yellow : .green)
            Text(player.gameHandle)
                .font(.caption.weight(.black)).multilineTextAlignment(.center)
                .lineLimit(2).minimumScaleFactor(0.7).frame(maxWidth: .infinity, minHeight: 30)
            Text("\(player.cheevoPoints)").font(.title3.weight(.black)).monospacedDigit().foregroundStyle(.green)
            Text("CHEEVO PTS").font(.system(size: 6, weight: .black)).tracking(0.5).foregroundStyle(.white.opacity(0.36))
        }
        .frame(maxWidth: .infinity).padding(.vertical, 12).padding(.horizontal, 5)
        .background((rank == 1 ? Color.yellow : Color.green).opacity(0.08), in: RoundedRectangle(cornerRadius: 15))
        .overlay(RoundedRectangle(cornerRadius: 15).stroke((rank == 1 ? Color.yellow : Color.green).opacity(0.38)))
    }

    private var crewBoard: some View {
        VStack(alignment: .leading, spacing: 12) {
            boardHeader("CREW POWER RANKINGS", "TOP 5 CREWS", .cyan)
            ForEach(Array(crews.prefix(5).enumerated()), id: \.element.id) { index, crew in
                HStack {
                    Text("\(index + 1)").font(.subheadline.weight(.black)).foregroundStyle(.cyan).frame(width: 22)
                    Text(crew.crewName).font(.subheadline.weight(.black)).lineLimit(1)
                    Spacer()
                    Text("\(crew.cheevoPoints)").font(.subheadline.weight(.black)).monospacedDigit().foregroundStyle(.cyan)
                }
            }
        }.musterPanel(.cyan)
    }

    private var roomDoors: some View {
        VStack(spacing: 11) {
            VStack(spacing: 3) {
                Text("CHOOSE YOUR DOOR").font(.system(size: 8, weight: .black)).tracking(2).foregroundStyle(.green)
                Text("FIND A WAR ROOM").font(.title2.weight(.black))
                Text("Public rooms join immediately. Private rooms require commissioner approval.")
                    .font(.caption).foregroundStyle(.white.opacity(0.48)).multilineTextAlignment(.center)
            }.padding(.vertical, 5)
            roomDoor("PUBLIC ROOMS", detail: "INSTANT ACCESS", rooms: publicRooms, color: .green)
            roomDoor("PRIVATE ROOMS", detail: "COMMISSIONER CLEARANCE", rooms: privateRooms, color: .yellow)
        }
    }

    private func roomDoor(_ title: String, detail: String, rooms: [LobbyRoom], color: Color) -> some View {
        let key = title.lowercased().hasPrefix("public") ? "public" : "private"
        let open = rooms.filter { !$0.isFull }.count
        let seats = rooms.reduce(0) { $0 + $1.seatsLeft }
        return Button {
            withAnimation(.snappy) { selection = selection == key ? nil : key }
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 5) {
                    Text(detail).font(.system(size: 8, weight: .black)).tracking(1.4).foregroundStyle(color)
                    Text(title).font(.headline.weight(.black)).foregroundStyle(.white)
                    Text("\(open) OPEN  ·  \(seats) SEATS").font(.system(size: 9, weight: .black)).tracking(1).foregroundStyle(.white.opacity(0.42))
                }
                Spacer()
                Image(systemName: selection == key ? "chevron.down.circle.fill" : "arrow.right.circle.fill").font(.title2.weight(.black)).foregroundStyle(color)
            }.padding(17).background(.black.opacity(0.76), in: RoundedRectangle(cornerRadius: 20))
                .overlay(RoundedRectangle(cornerRadius: 20).stroke(color.opacity(selection == key ? 0.75 : 0.35)))
        }.buttonStyle(.plain)
    }

    private func roomList(title: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("\(title.uppercased()) ROOMS").font(.caption.weight(.black)).tracking(1.6).foregroundStyle(title == "public" ? .green : .yellow)
            if selectedRooms.isEmpty {
                Text("No \(title) rooms are broadcasting yet.").font(.footnote).foregroundStyle(.secondary).padding(.vertical, 18).frame(maxWidth: .infinity)
            } else {
                ForEach(selectedRooms) { room in roomCard(room) }
            }
        }.padding(13).background(.black.opacity(0.58), in: RoundedRectangle(cornerRadius: 22))
            .overlay(RoundedRectangle(cornerRadius: 22).stroke(.white.opacity(0.10)))
    }

    private func roomCard(_ room: LobbyRoom) -> some View {
        let pending = room.requestStatus == "pending"
        let color: Color = room.isFull ? .red : room.accessMode == "private" ? .yellow : .green
        let label = room.isMember ? "ENTER ROOM" : room.isFull ? "ROOM FULL" : pending ? "REQUEST SENT" : room.accessMode == "private" ? "REQUEST TO JOIN" : "JOIN ROOM"
        return VStack(alignment: .leading, spacing: 11) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(room.name).font(.headline.weight(.black))
                    Text("\(room.sportId.uppercased()) · \(room.accessMode.uppercased())").font(.system(size: 8, weight: .black)).tracking(1.2).foregroundStyle(color)
                }
                Spacer()
                Text("\(room.humanCount)/\(room.maxHumanMembers)").font(.headline.weight(.black)).monospacedDigit()
            }
            ProgressView(value: Double(room.humanCount), total: Double(max(room.maxHumanMembers, 1))).tint(color)
            HStack {
                Text(room.isFull ? "NO OPENINGS" : "\(room.seatsLeft) SEATS OPEN").font(.system(size: 8, weight: .black)).tracking(1).foregroundStyle(color)
                Spacer()
                Button(label) { Task { await act(on: room) } }
                    .font(.system(size: 9, weight: .black)).tracking(0.8)
                    .buttonStyle(.borderedProminent).tint(color)
                    .disabled(busyRoom != nil || (!room.isMember && (room.isFull || pending)))
            }
        }.padding(15).background(.black.opacity(0.82), in: RoundedRectangle(cornerRadius: 17))
            .overlay(RoundedRectangle(cornerRadius: 17).stroke(color.opacity(0.28)))
    }

    private func boardHeader(_ kicker: String, _ title: String, _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(kicker).font(.system(size: 8, weight: .black)).tracking(1.8).foregroundStyle(color)
            Text(title).font(.title2.weight(.black))
        }
    }

    @MainActor private func load() async {
        guard let token = auth.token else { return }
        loading = true
        do {
            async let loadedRooms = SupabaseAPI.lobbyRooms(token: token)
            async let loadedBoards = SupabaseAPI.lobbyLeaderboards(token: token)
            rooms = try await loadedRooms
            let boards = try await loadedBoards
            players = boards.players
            crews = boards.crews
            notice = nil
        } catch { notice = error.localizedDescription }
        loading = false
    }

    @MainActor private func act(on room: LobbyRoom) async {
        guard let token = auth.token else { return }
        if room.isMember { auth.selectLeague(room.id); dismiss(); return }
        guard !room.isFull else { return }
        busyRoom = room.id
        defer { busyRoom = nil }
        do {
            if room.accessMode == "private" {
                try await SupabaseAPI.requestLobbyRoom(token: token, leagueId: room.id)
                notice = "Request sent to \(room.name). The commissioner can approve you now."
                await load()
            } else {
                try await SupabaseAPI.joinPublicLobbyRoom(token: token, leagueId: room.id)
                auth.selectLeague(room.id)
                dismiss()
            }
        } catch { notice = error.localizedDescription }
    }
}

struct CreateLeagueView: View {
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var sportId = "cfb"
    @State private var visibility = "private"
    @State private var crystalBallEnabled = true
    @State private var maxMembers = 16
    @State private var creating = false
    @State private var errorMessage: String?
    @State private var createdCode: String?

    private var cleanName: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        ZStack {
            LinearGradient(colors: [.black, .green.opacity(0.14), .black], startPoint: .topLeading, endPoint: .bottomTrailing).ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 7) {
                        Label("COMMISSIONER COMMISSION", systemImage: "hammer.fill")
                            .font(.caption2.weight(.black)).tracking(1.8).foregroundStyle(.green)
                        Text("BUILD A NEW\nWAR ROOM").font(.system(size: 34, weight: .black)).fontWidth(.condensed)
                        Text("Name it. Choose the desk. Decide who gets through the door.")
                            .font(.subheadline.weight(.semibold)).foregroundStyle(.white.opacity(0.58))
                    }.padding(.bottom, 4)

                    VStack(alignment: .leading, spacing: 10) {
                        createLabel("ROOM NAME")
                        TextField("Example: Fourth & Regret", text: $name)
                            .textInputAutocapitalization(.words).padding(14)
                            .background(.black.opacity(0.72), in: RoundedRectangle(cornerRadius: 13))
                            .overlay(RoundedRectangle(cornerRadius: 13).stroke(.green.opacity(0.35)))
                        Text("\(cleanName.count)/80").font(.caption2.weight(.bold)).foregroundStyle(cleanName.count > 80 ? .red : .secondary).frame(maxWidth: .infinity, alignment: .trailing)
                    }.createLeaguePanel()

                    VStack(alignment: .leading, spacing: 11) {
                        createLabel("FOOTBALL DESK")
                        Picker("Sport", selection: $sportId) {
                            Text("CFB · SATURDAY").tag("cfb")
                            Text("NFL · SUNDAY").tag("nfl")
                        }.pickerStyle(.segmented)
                        Text(sportId == "nfl" ? "Starts at NFL Week 1. No preseason." : "Starts at the CFB opening week.")
                            .font(.caption).foregroundStyle(.white.opacity(0.45))
                    }.createLeaguePanel()

                    VStack(alignment: .leading, spacing: 11) {
                        createLabel("LOBBY DOOR")
                        Picker("Visibility", selection: $visibility) {
                            Text("PRIVATE").tag("private")
                            Text("PUBLIC").tag("public")
                        }.pickerStyle(.segmented)
                        Label(visibility == "public" ? "Players can join immediately while seats remain." : "Players can see the room but must request commissioner approval.", systemImage: visibility == "public" ? "door.left.hand.open" : "lock.shield.fill")
                            .font(.caption.weight(.semibold)).foregroundStyle(visibility == "public" ? .green : .yellow)
                    }.createLeaguePanel()

                    VStack(alignment: .leading, spacing: 12) {
                        createLabel("ROOM RULES")
                        Stepper("\(maxMembers) HUMAN SEATS", value: $maxMembers, in: 2...64, step: 2).font(.subheadline.weight(.black))
                        Toggle("CRYSTAL BALL", isOn: $crystalBallEnabled).font(.subheadline.weight(.black)).tint(.green)
                    }.createLeaguePanel()

                    if let errorMessage {
                        Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                            .font(.footnote.weight(.bold)).foregroundStyle(.red)
                    }
                    if let createdCode {
                        Label("ROOM CREATED · INVITE CODE \(createdCode)", systemImage: "checkmark.seal.fill")
                            .font(.footnote.weight(.black)).foregroundStyle(.green)
                    }

                    Button { Task { await createLeague() } } label: {
                        HStack {
                            Spacer()
                            if creating { ProgressView().tint(.black) }
                            else { Label("CREATE LEAGUE", systemImage: "plus.circle.fill").font(.headline.weight(.black)) }
                            Spacer()
                        }.padding(16).foregroundStyle(.black).background(canCreate ? Color.green : .gray, in: RoundedRectangle(cornerRadius: 15))
                    }.buttonStyle(.plain).disabled(!canCreate || creating)
                }.padding(17).padding(.bottom, 34)
            }
        }
        .navigationTitle("Create League").navigationBarTitleDisplayMode(.inline).preferredColorScheme(.dark)
    }

    private var canCreate: Bool { !cleanName.isEmpty && cleanName.count <= 80 }
    private func createLabel(_ text: String) -> some View {
        Text(text).font(.system(size: 8, weight: .black)).tracking(1.6).foregroundStyle(.green)
    }

    @MainActor private func createLeague() async {
        guard canCreate, let token = auth.token else { return }
        creating = true
        errorMessage = nil
        do {
            let created = try await SupabaseAPI.createLeague(
                token: token, name: cleanName, sportId: sportId, visibility: visibility,
                crystalBallEnabled: crystalBallEnabled, maxMembers: maxMembers
            )
            createdCode = created.code
            auth.selectLeague(created.leagueId)
            try? await Task.sleep(for: .milliseconds(450))
            dismiss()
        } catch {
            errorMessage = error.localizedDescription.replacingOccurrences(of: "d1b:", with: "").replacingOccurrences(of: "_", with: " ")
        }
        creating = false
    }
}

private extension View {
    func musterPanel(_ color: Color) -> some View {
        padding(17).background(.black.opacity(0.82), in: RoundedRectangle(cornerRadius: 23))
            .overlay(RoundedRectangle(cornerRadius: 23).stroke(color.opacity(0.30)))
            .shadow(color: color.opacity(0.08), radius: 24)
    }

    func createLeaguePanel() -> some View {
        padding(15).background(.black.opacity(0.78), in: RoundedRectangle(cornerRadius: 17))
            .overlay(RoundedRectangle(cornerRadius: 17).stroke(.green.opacity(0.22)))
    }
}
