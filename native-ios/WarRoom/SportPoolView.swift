import SwiftUI

struct SportPoolView: View {
    @EnvironmentObject private var auth: AuthStore
    let membership: LeagueMembership
    @State private var poll: SportPoolPoll?
    @State private var targetSport = "nfl"
    @State private var proposedName = ""
    @State private var message = "Same idiots. Different sport. Seven days to report for duty."
    @State private var loading = true
    @State private var working = false
    @State private var error: String?
    @State private var launch: SportPoolLaunch?
    @State private var now = Date()
    private var identity: SportIdentity { SportIdentity(membership.leagues.sportId) }
    private var accent: Color { identity.isNFL ? .cyan : .orange }

    private var commissioner: Bool { auth.user.map { membership.isCommissioner(userId:$0.id) } ?? false }
    private func yesPercent(_ poll: SportPoolPoll) -> Int {
        guard poll.eligibleCount > 0 else { return 0 }
        return Int((Double(poll.yesCount) / Double(poll.eligibleCount) * 100).rounded(.down))
    }
    private func crewPercent(_ poll: SportPoolPoll) -> Int {
        guard poll.eligibleCount > 0 else { return 0 }
        return Int((Double(poll.crewOverlapCount ?? 0) / Double(poll.eligibleCount) * 100).rounded(.down))
    }
    private var expiry: Date? { ISO8601DateFormatter().date(from:poll?.expiresAt ?? "") }
    private var remaining: String {
        guard let expiry else{return "SEVEN DAYS"};let seconds=max(0,Int(expiry.timeIntervalSince(now)))
        if seconds==0{return "VOTING CLOSED"};return "\(seconds/86400)D \((seconds%86400)/3600)H \((seconds%3600)/60)M LEFT"
    }

    var body: some View {
        ZStack {
            if identity.isNFL { NflHomeBackdrop(phase: .regularSeason) }
            else { LinearGradient(colors:[.black,Color(red:0.16,green:0.05,blue:0.01),.black],startPoint:.topLeading,endPoint:.bottomTrailing).ignoresSafeArea() }
            ScrollView { VStack(alignment:.leading,spacing:16) {
                VStack(alignment:.leading,spacing:7) {
                    Text(identity.isNFL ? "FRANCHISE EXPANSION OFFICE" : "OFFSEASON RECRUITING COMMAND").font(.caption2.weight(.black)).tracking(2).foregroundStyle(accent)
                    Text(identity.isNFL ? "EXPAND THE ROOM?" : "RUN IT BACK?").font(.system(size:40,weight:.black)).fontWidth(.condensed)
                    Text("Nobody gets drafted against their will. The room has seven days to volunteer for the next sport.").font(.subheadline.weight(.semibold)).foregroundStyle(.white.opacity(0.58))
                }.commandPanel(accent: accent, cornerRadius: identity.isNFL ? 6 : 15)
                if loading { ProgressView("Checking the recruiting board…").tint(accent).frame(maxWidth:.infinity).padding(30) }
                else if let poll { activePoll(poll) }
                else if commissioner { createPanel }
                else { ContentUnavailableView("No vote in the field",systemImage:"person.3.sequence",description:Text("The commissioner has not opened recruiting for another sport.")) }
                if let error { Text(error).font(.footnote.weight(.bold)).foregroundStyle(.red).commandPanel(accent: accent, cornerRadius: identity.isNFL ? 6 : 15) }
            }.padding(16).padding(.bottom,36) }
        }.navigationTitle("Run It Back").navigationBarTitleDisplayMode(.inline).preferredColorScheme(.dark)
        .task { await reload() }
        .task { while !Task.isCancelled { try? await Task.sleep(for:.seconds(30));now=Date() } }
    }

    private func activePoll(_ poll: SportPoolPoll) -> some View {
        VStack(alignment:.leading,spacing:14) {
            HStack { VStack(alignment:.leading) { Text(poll.targetSportId.uppercased()).font(.caption.weight(.black)).foregroundStyle(accent);Text(poll.proposedName).font(.title2.weight(.black)) };Spacer();Text(remaining).font(.caption2.weight(.black)).foregroundStyle(poll.status=="open" ? (identity.isNFL ? .cyan : .yellow):.red) }
            Text(poll.message).font(.body.weight(.semibold)).foregroundStyle(.white.opacity(0.68))
            let crewCount = poll.status == "spun_up" ? (poll.crewOverlapCount ?? 0) : poll.yesCount
            let percent = poll.status == "spun_up" ? crewPercent(poll) : yesPercent(poll)
            let crewLine = poll.crewRequired ?? poll.requiredYes
            HStack(spacing:8) { metric(poll.status == "spun_up" ? "JOINED" : "YES",crewCount,identity.isNFL ? .cyan : .green);metric("PERCENT",percent,.yellow);metric("ORIGINAL",poll.eligibleCount,.white) }
            ProgressView(value:Double(crewCount),total:Double(max(crewLine,1))).tint(crewCount >= crewLine ? .green : accent)
            Text("65% CONSTITUTES A CREW FOR CHEEVOS · \(crewCount) OF \(crewLine) NEEDED")
                .font(.caption2.weight(.black)).tracking(1).foregroundStyle(crewCount >= crewLine ? .green : .white.opacity(0.48))
            if poll.status=="open" {
                HStack(spacing:10) { voteButton("YES, MOVE ME","yes",identity.isNFL ? .blue : .green,poll);voteButton("NO","no",.red,poll) }
                Text("You can change your vote until the clock expires.").font(.caption2.weight(.bold)).foregroundStyle(.white.opacity(0.38)).frame(maxWidth:.infinity,alignment:.center)
            }
            if commissioner {
                Divider().overlay(accent.opacity(0.4))
                Text("YES ROSTER · COMMISSIONER EYES ONLY").font(.caption2.weight(.black)).tracking(1.4).foregroundStyle(accent)
                if poll.yesVoters.isEmpty { Text("Nobody has volunteered yet. Inspiring leadership.").foregroundStyle(.secondary) }
                ForEach(poll.yesVoters) { voter in Label(voter.name,systemImage:"checkmark.seal.fill").font(.subheadline.weight(.bold)).foregroundStyle(identity.isNFL ? .cyan : .green) }
                Button { Task{await launchLeague(poll)} } label: { Label(working ? "MOVING THE WILLING…":"CREATE LEAGUE + MOVE YES VOTERS",systemImage:"arrow.right.square.fill").font(.headline.weight(.black)).frame(maxWidth:.infinity).padding(16).foregroundStyle(identity.isNFL ? .white : .black).background(poll.canLaunch ? (identity.isNFL ? Color.blue : Color.orange):.gray,in:RoundedRectangle(cornerRadius:identity.isNFL ? 6 : 14)) }.buttonStyle(.plain).disabled(!poll.canLaunch || working)
                if poll.status=="open" { Text("You can launch whenever you want. Reaching 65% makes this group a Crew for Cheevos.").font(.caption.weight(.bold)).foregroundStyle(.yellow.opacity(0.7)) }
                if poll.status != "open" {
                    Button { launch=nil;self.poll=nil } label: {
                        Label("OPEN ANOTHER CREW VOTE",systemImage:"arrow.clockwise.circle.fill")
                            .font(.headline.weight(.black)).frame(maxWidth:.infinity).padding(15)
                    }.buttonStyle(.borderedProminent).tint(accent)
                }
            }
            if let launch { Text("\(launch.seats) PLAYERS MOVED · CODE \(launch.code ?? "CREATED")").font(.headline.weight(.black)).foregroundStyle(identity.isNFL ? .cyan : .green).frame(maxWidth:.infinity).padding(15).background((identity.isNFL ? Color.blue : Color.green).opacity(0.12),in:RoundedRectangle(cornerRadius:identity.isNFL ? 6 : 14)) }
        }.commandPanel(accent: accent, cornerRadius: identity.isNFL ? 6 : 15)
    }

    private var createPanel: some View {
        VStack(alignment:.leading,spacing:13) {
            Text(identity.isNFL ? "OPEN A SEVEN-DAY EXPANSION VOTE" : "OPEN A SEVEN-DAY DRAFT").font(.headline.weight(.black)).foregroundStyle(accent)
            Picker("SPORT",selection:$targetSport) { Text("NFL").tag("nfl");Text("CFB").tag("cfb") }.pickerStyle(.segmented)
            TextField("New league name",text:$proposedName).textFieldStyle(.roundedBorder)
            TextField("Message to the room",text:$message,axis:.vertical).lineLimit(3...5).textFieldStyle(.roundedBorder)
            Button { Task{await create()} } label: { Label(working ? "OPENING VOTE…":"OPEN 7-DAY VOTE",systemImage:"megaphone.fill").font(.headline.weight(.black)).frame(maxWidth:.infinity).padding(16).foregroundStyle(identity.isNFL ? .white : .black).background(proposedName.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty ? Color.gray:(identity.isNFL ? Color.blue : Color.orange),in:RoundedRectangle(cornerRadius:identity.isNFL ? 6 : 14)) }.buttonStyle(.plain).disabled(working || proposedName.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty)
        }.commandPanel(accent: accent, cornerRadius: identity.isNFL ? 6 : 15).onAppear { if proposedName.isEmpty { targetSport=membership.leagues.sportId.lowercased()=="nfl" ? "cfb":"nfl";proposedName="\(membership.leagues.name) · \(targetSport.uppercased())" } }
    }

    private func metric(_ label:String,_ value:Int,_ color:Color)->some View { VStack { Text("\(value)").font(.title.weight(.black)).foregroundStyle(color);Text(label).font(.caption2.weight(.black)).tracking(1) }.frame(maxWidth:.infinity).padding(13).background(color.opacity(0.1),in:RoundedRectangle(cornerRadius:12)).overlay(RoundedRectangle(cornerRadius:12).stroke(color.opacity(0.35))) }
    private func voteButton(_ title:String,_ response:String,_ color:Color,_ poll:SportPoolPoll)->some View { Button { Task{await vote(response,poll)} } label: { HStack { Image(systemName:poll.myVote==response ? "checkmark.circle.fill":"circle");Text(title) }.font(.subheadline.weight(.black)).frame(maxWidth:.infinity).padding(14).foregroundStyle(poll.myVote==response ? .black:color).background(poll.myVote==response ? color:color.opacity(0.1),in:RoundedRectangle(cornerRadius:12)).overlay(RoundedRectangle(cornerRadius:12).stroke(color.opacity(0.6))) }.buttonStyle(.plain).disabled(working) }
    @MainActor private func reload() async { defer{loading=false};guard let token=auth.token else{return};do{poll=try await SupabaseAPI.sportPoolPoll(token:token,leagueId:membership.leagueId);error=nil}catch{self.error=error.localizedDescription} }
    @MainActor private func create() async { guard let token=auth.token else{return};working=true;defer{working=false};do{let created=try await SupabaseAPI.createSportPoolPoll(token:token,leagueId:membership.leagueId,targetSport:targetSport,name:proposedName,message:message);poll=created;if membership.leagues.mode=="foundry"{try await SupabaseAPI.seedFoundrySportPoolVotes(token:token,pollId:created.id);await reload()};error=nil}catch{self.error=error.localizedDescription} }
    @MainActor private func vote(_ response:String,_ poll:SportPoolPoll) async { guard let token=auth.token else{return};working=true;defer{working=false};do{try await SupabaseAPI.voteSportPool(token:token,pollId:poll.id,response:response);await reload()}catch{self.error=error.localizedDescription} }
    @MainActor private func launchLeague(_ poll:SportPoolPoll) async { guard let token=auth.token else{return};working=true;defer{working=false};do{launch=try await SupabaseAPI.launchSportPoolLeague(token:token,pollId:poll.id);await reload()}catch{self.error=error.localizedDescription} }
}
