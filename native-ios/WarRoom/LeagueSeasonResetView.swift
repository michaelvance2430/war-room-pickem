import SwiftUI

struct LeagueSeasonResetView: View {
    @EnvironmentObject private var auth: AuthStore
    let membership: LeagueMembership
    @State private var confirmation = ""
    @State private var showingFinalWarning = false
    @State private var resetting = false
    @State private var complete = false
    @State private var error: String?
    private var identity: SportIdentity { SportIdentity(membership.leagues.sportId) }

    var body: some View {
        ZStack {
            if identity.isNFL { NflHomeBackdrop(phase: .regularSeason) }
            else { LinearGradient(colors:[.black,.red.opacity(0.22),.black],startPoint:.top,endPoint:.bottom).ignoresSafeArea() }
            ScrollView { VStack(alignment:.leading,spacing:17) {
                Label("COMMISSIONER FIRE CONTROL",systemImage:"exclamationmark.octagon.fill").font(.caption.weight(.black)).tracking(1.8).foregroundStyle(.red)
                Text("RESET THE\nSEASON").font(.system(size:42,weight:.black)).fontWidth(.condensed)
                Text("This is a new-season restart—not a rage button. The roster, trophies, ranks, permanent cheevos, Locker Room, and weapon history survive.").font(.body.weight(.semibold)).foregroundStyle(.white.opacity(0.68))
                VStack(alignment:.leading,spacing:9) {
                    resetRow("ERASED", identity.isNFL ? "Cards, picks, scores, standings totals, Dispatch editions, and NFL playoff brackets" : "Cards, picks, scores, standings totals, Dispatch editions, Crystal Ball picks, and postseason boards",.red)
                    resetRow("PRESERVED","Players, trophies, cheevos, ranks, profile schwag, Locker Room, and weapon history",identity.isNFL ? .cyan : .green)
                    resetRow("RESTARTS AT","Week \(identity.openingWeek) with the existing league and commissioner",identity.isNFL ? .blue : .yellow)
                }.commandPanel(accent: identity.isNFL ? .cyan : .green, cornerRadius: identity.isNFL ? 6 : 15)
                Text("TYPE THE EXACT LEAGUE NAME").font(.caption2.weight(.black)).tracking(1.3).foregroundStyle(.red)
                Text(membership.leagues.name).font(.headline.weight(.black))
                TextField("League name",text:$confirmation).textInputAutocapitalization(.never).autocorrectionDisabled().textFieldStyle(.roundedBorder)
                Button { showingFinalWarning=true } label: { Label(resetting ? "RESETTING…":"ARM SEASON RESET",systemImage:"lock.open.fill").font(.headline.weight(.black)).frame(maxWidth:.infinity).padding(16).foregroundStyle(.white).background(confirmation==membership.leagues.name ? Color.red:.gray,in:RoundedRectangle(cornerRadius:14)) }.buttonStyle(.plain).disabled(confirmation != membership.leagues.name || resetting || complete)
                if complete { Label("SEASON RESET · WEEK \(identity.openingWeek) READY",systemImage:"checkmark.seal.fill").font(.headline.weight(.black)).foregroundStyle(identity.isNFL ? .cyan : .green).frame(maxWidth:.infinity).padding(16).background((identity.isNFL ? Color.blue : Color.green).opacity(0.12),in:RoundedRectangle(cornerRadius:identity.isNFL ? 6 : 14)) }
                if let error { Text(error).font(.footnote.weight(.bold)).foregroundStyle(.red).commandPanel(accent: identity.isNFL ? .cyan : .green, cornerRadius: identity.isNFL ? 6 : 15) }
            }.padding(20).padding(.bottom,40) }
        }.navigationTitle("Season Reset").navigationBarTitleDisplayMode(.inline).preferredColorScheme(.dark)
        .alert("Erase the active season?",isPresented:$showingFinalWarning) {
            Button("CANCEL",role:.cancel){}
            Button("RESET TO WEEK \(identity.openingWeek)",role:.destructive){Task{await reset()}}
        } message:{Text(identity.isNFL ? "This permanently clears the active season’s cards, picks, scores, Dispatch, and NFL playoff data. It cannot be undone." : "This permanently clears the active season’s cards, picks, scores, Dispatch, Crystal Ball, and postseason data. It cannot be undone.")}
    }
    private func resetRow(_ label:String,_ detail:String,_ color:Color)->some View { HStack(alignment:.top) { Text(label).font(.caption2.weight(.black)).foregroundStyle(color).frame(width:74,alignment:.leading);Text(detail).font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.64)) } }
    @MainActor private func reset() async { guard let token=auth.token else{return};resetting=true;error=nil;defer{resetting=false};do{try await SupabaseAPI.resetLeagueSeason(token:token,leagueId:membership.leagueId,confirmationName:confirmation);complete=true}catch{self.error=error.localizedDescription} }
}
