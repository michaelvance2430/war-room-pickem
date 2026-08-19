import SwiftUI

struct NflPostseasonCloudView: View {
    @EnvironmentObject private var auth: AuthStore
    let membership: LeagueMembership
    @State private var slate: NflPostseasonSlate?
    @State private var entry: NflPostseasonEntry?
    @State private var results: [String:String] = [:]
    @State private var scorecard: NflPostseasonScorecard?
    @State private var picks: [String:String] = [:]
    @State private var loading = true
    @State private var saving = false
    @State private var errorMessage: String?
    @State private var confirmingJdam = false
    @State private var showingFieldEditor = false
    @State private var showingResults = false
    @State private var foundryBotsSeeded: Int?

    private var seasonKey: Int { NflSeasonCalendar.seasonKey() }
    private var isCommissioner: Bool { auth.user.map { membership.isCommissioner(userId: $0.id) } ?? false }
    private var games: [NflBracketGame] { NflBracketEngine.games(teams: slate?.teams ?? [], picks: picks) }
    private var locked: Bool { entry?.lockedAt != nil }
    private var complete: Bool { Set(picks.keys).isSuperset(of: NflBracketEngine.requiredKeys) }

    var body: some View {
        ZStack {
            NflHomeBackdrop(phase: NflSeasonPhase.phase(week: membership.leagues.currentWeek))
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    hero
                    if loading { ProgressView("Opening postseason command…").tint(.cyan).frame(maxWidth:.infinity).padding(30) }
                    else if let slate {
                        if let scorecard { scorecardPanel(scorecard) }
                        if let foundryBotsSeeded {
                            Label("\(foundryBotsSeeded) BOT BRACKETS SEALED · 13 DECISIONS EACH", systemImage: "checkmark.shield.fill")
                                .font(.caption.weight(.black)).foregroundStyle(.cyan)
                                .frame(maxWidth: .infinity).padding(12)
                                .background(.blue.opacity(0.12), in: RoundedRectangle(cornerRadius: 7))
                                .overlay(RoundedRectangle(cornerRadius: 7).stroke(.cyan.opacity(0.45)))
                        }
                        progressRail
                        conferenceBoard("AFC", slate: slate)
                        conferenceBoard("NFC", slate: slate)
                        broadcastBreak
                        superBowlBoard
                        if locked { sealedPanel } else { lockButton; jdamPanel }
                        if isCommissioner {
                            Button { showingResults = true } label: {
                                commandLink("RESULTS CONTROL", "Record each official winner and certify the Final Thirteen.", "checkmark.seal.fill", .red)
                            }.buttonStyle(.plain)
                        }
                    } else {
                        noFieldPanel
                    }
                    if let errorMessage { Label(errorMessage, systemImage:"exclamationmark.triangle.fill").font(.footnote.weight(.bold)).foregroundStyle(.red).padding(14).frame(maxWidth:.infinity).background(.red.opacity(0.1),in:RoundedRectangle(cornerRadius:14)) }
                }.padding(16).padding(.bottom,36)
            }
        }
        .navigationTitle("NFL Playoffs").navigationBarTitleDisplayMode(.inline).preferredColorScheme(.dark)
        .task { await load() }
        .navigationDestination(isPresented: $showingFieldEditor) {
            NflPostseasonFieldEditor(membership: membership)
        }
        .navigationDestination(isPresented: $showingResults) {
            if let teams = slate?.teams {
                NflPostseasonResultsView(membership: membership, teams: teams)
            }
        }
        .onChange(of: showingFieldEditor) { _, isShowing in
            guard !isShowing else { return }
            loading = true
            Task { await load() }
        }
        .onChange(of: showingResults) { _, isShowing in
            guard !isShowing else { return }
            loading = true
            Task { await load() }
        }
        .alert("AUTHORIZE JDAM?",isPresented:$confirmingJdam){Button("KEEP CONTROL",role:.cancel){};Button("AUTHORIZE",role:.destructive){Task{await deployJdam()}}}message:{Text("JDAM replaces every human decision, fills all 13 picks, records the authorization in your permanent service history, and seals the bracket. No rerolls.")}
    }

    private var hero: some View {
        VStack(alignment:.leading,spacing:8){
            Label("NFL POSTSEASON COMMAND",systemImage:"shield.lefthalf.filled").font(.caption2.weight(.black)).tracking(2).foregroundStyle(.cyan)
            Text("THE FINAL THIRTEEN").font(.system(size:36,weight:.black)).fontWidth(.condensed)
            Text("\(membership.leagues.name.uppercased()) · 14 TEAMS · 13 DECISIONS · 1 RECEIPT").font(.system(size:8,weight:.black)).tracking(1.1).foregroundStyle(.white.opacity(0.48))
            Text("Wild Card weekend. Automatic Divisional reseeding. Two conference titles. One Super Bowl champion.").font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.68))
        }.frame(maxWidth:.infinity,alignment:.leading).padding(19)
            .background(LinearGradient(colors:[Color(red:0.01,green:0.08,blue:0.22),.black.opacity(0.96),Color(red:0.18,green:0.01,blue:0.04)],startPoint:.leading,endPoint:.trailing),in:RoundedRectangle(cornerRadius:7))
            .overlay(alignment:.top){HStack(spacing:0){Color.blue;Color.white;Color.red}.frame(height:4)}
            .overlay(RoundedRectangle(cornerRadius:7).stroke(.white.opacity(0.18)))
    }

    private var noFieldPanel: some View {
        VStack(spacing:14){
            Image(systemName:"rectangle.3.group.bubble.left.fill").font(.system(size:42,weight:.black)).foregroundStyle(.cyan)
            Text("THE FIELD IS NOT OFFICIAL YET").font(.title3.weight(.black)).multilineTextAlignment(.center)
            Text(isCommissioner ? "Publish the seven AFC and seven NFC seeds when the playoff field is official. Players only see verified teams." : "Your commissioner will publish the official 14-team field. The bracket opens the moment it arrives.").font(.subheadline.weight(.semibold)).foregroundStyle(.white.opacity(0.64)).multilineTextAlignment(.center)
            if isCommissioner { Button { showingFieldEditor = true } label:{Label("PUBLISH OFFICIAL FIELD",systemImage:"square.and.pencil").font(.headline.weight(.black)).frame(maxWidth:.infinity).padding(.vertical,12)}.buttonStyle(.borderedProminent).tint(.blue) }
        }.padding(22).background(.black.opacity(0.82),in:RoundedRectangle(cornerRadius:22)).overlay(RoundedRectangle(cornerRadius:22).stroke(.cyan.opacity(0.48)))
    }

    private var progressRail: some View {
        HStack(spacing:4){phaseChip("WC",keys:NflBracketEngine.requiredKeys.filter{$0.contains("-WC-")});phaseChip("DIV",keys:NflBracketEngine.requiredKeys.filter{$0.contains("-DIV-")});phaseChip("CONF",keys:["AFC-CONF","NFC-CONF"]);Text("BREAK").font(.system(size:7,weight:.black)).frame(maxWidth:.infinity).padding(.vertical,9).foregroundStyle(.red).background(.red.opacity(0.1),in:RoundedRectangle(cornerRadius:3));phaseChip("SB",keys:["SUPER-BOWL"]);phaseChip("SEAL",keys:locked ? NflBracketEngine.requiredKeys : [])}
    }
    private func phaseChip(_ title:String,keys:[String])->some View { let done = !keys.isEmpty && keys.allSatisfy{picks[$0] != nil}; return Text(done ? "✓ \(title)":title).font(.system(size:8,weight:.black)).frame(maxWidth:.infinity).padding(.vertical,9).foregroundStyle(done ? .black:.white.opacity(0.6)).background(done ? Color.cyan:Color.white.opacity(0.07),in:RoundedRectangle(cornerRadius:3)) }

    private func conferenceBoard(_ conference:String,slate:NflPostseasonSlate)->some View {
        VStack(alignment:.leading,spacing:12){
            HStack{Text(conference).font(.title2.weight(.black)).fontWidth(.condensed);Text("CONFERENCE BOARD").font(.system(size:8,weight:.black)).tracking(1.4).foregroundStyle(conference=="AFC" ? .red:.cyan);Spacer();if let bye=slate.teams.first(where:{$0.conference==conference && $0.seed==1}){Text("#1 \(bye.name)").font(.system(size:8,weight:.black)).foregroundStyle(.white)}}
            ForEach(["WILD CARD","DIVISIONAL","CONFERENCE"],id:\.self){round in
                Text(round).font(.system(size:8,weight:.black)).tracking(1.3).foregroundStyle(.white.opacity(0.4))
                ForEach(games.filter{$0.id.hasPrefix(conference) && $0.round==round}){game in pickCard(game)}
            }
        }.padding(16).background(.black.opacity(0.86),in:RoundedRectangle(cornerRadius:7)).overlay(alignment:.leading){Rectangle().fill(conference=="AFC" ? Color.red:Color.blue).frame(width:4).padding(.vertical,8)}.overlay(RoundedRectangle(cornerRadius:7).stroke((conference=="AFC" ? Color.red:Color.blue).opacity(0.62)))
    }

    private func pickCard(_ game:NflBracketGame)->some View {
        VStack(alignment:.leading,spacing:7){
            Text(game.title.uppercased()).font(.system(size:8,weight:.black)).tracking(1).foregroundStyle(.white.opacity(0.42))
            if game.teams.count==2 { ForEach(game.teams){team in
                Button{select(team,in:game)}label:{HStack{Text("#\(team.seed) \(team.name)").font(.caption.weight(.black));Spacer();if picks[game.id]==team.id{Text(resultMark(game,team:team)).font(.system(size:7,weight:.black)).tracking(0.7)}}.padding(.horizontal,12).frame(height:42)}
                    .buttonStyle(.plain).foregroundStyle(picks[game.id]==team.id ? .black:.white).background(picks[game.id]==team.id ? Color.cyan:Color.white.opacity(0.06),in:RoundedRectangle(cornerRadius:4)).overlay(RoundedRectangle(cornerRadius:4).stroke(picks[game.id]==team.id ? .cyan:.white.opacity(0.12))).disabled(locked)
            }} else { Text("AWAITING PRIOR ROUND").font(.caption2.weight(.black)).tracking(0.8).foregroundStyle(.white.opacity(0.3)).frame(maxWidth:.infinity).padding(12).background(.white.opacity(0.035),in:RoundedRectangle(cornerRadius:9)) }
        }.padding(11).background(.white.opacity(0.025),in:RoundedRectangle(cornerRadius:12))
    }

    private var broadcastBreak: some View {
        VStack(spacing:8){
            Text("PLEASE STAND BY").font(.system(size:8,weight:.black)).tracking(2).foregroundStyle(.red)
            Text("WE'LL BE RIGHT BACK\nAFTER THESE MESSAGES")
                .font(.title3.weight(.black)).fontWidth(.condensed).multilineTextAlignment(.center)
            Text("Conference champions get one week off. No picks, no points, no fake slate—then the Super Bowl takes the screen.")
                .font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.58)).multilineTextAlignment(.center)
        }
        .frame(maxWidth:.infinity).padding(17)
        .background(LinearGradient(colors:[.red.opacity(0.16),.black.opacity(0.94),.blue.opacity(0.14)],startPoint:.leading,endPoint:.trailing),in:RoundedRectangle(cornerRadius:7))
        .overlay(RoundedRectangle(cornerRadius:7).stroke(.white.opacity(0.16)))
    }
    private var superBowlBoard: some View { VStack(alignment:.leading,spacing:10){Label("SUPER BOWL · GAME WEEK 22 · DECISION 13",systemImage:"trophy.fill").font(.caption.weight(.black)).tracking(1.3).foregroundStyle(.white);if let game=games.first(where:{$0.id=="SUPER-BOWL"}){pickCard(game)}}.padding(17).background(LinearGradient(colors:[.blue.opacity(0.24),.black.opacity(0.94),.red.opacity(0.20)],startPoint:.leading,endPoint:.trailing),in:RoundedRectangle(cornerRadius:7)).overlay(RoundedRectangle(cornerRadius:7).stroke(.cyan.opacity(0.72),lineWidth:2)) }
    private var lockButton: some View { Button{Task{await lockBracket(usedJdam:false)}}label:{HStack{Spacer();if saving{ProgressView().tint(.white)}else{Label("SEAL ALL 13 PICKS",systemImage:"lock.fill").font(.headline.weight(.black))};Spacer()}.padding(.vertical,10)}.buttonStyle(.borderedProminent).tint(.blue).disabled(!complete||saving) }
    private var jdamPanel: some View { VStack(alignment:.leading,spacing:10){HStack{VStack(alignment:.leading){Text("POSTSEASON WEAPON · M.A.P.’S").font(.system(size:8,weight:.black)).tracking(1.3).foregroundStyle(.red);Text("JDAM OVERRIDE").font(.title3.weight(.black))};Spacer();Image(systemName:"scope").font(.title.weight(.black)).foregroundStyle(.red)};Text("Mutually Assured Picks replaces every selection and seals the full bracket in one permanent strike.").font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.64));Button("AUTHORIZE JDAM"){confirmingJdam=true}.font(.headline.weight(.black)).frame(maxWidth:.infinity).buttonStyle(.borderedProminent).tint(.red)}.padding(16).background(.red.opacity(0.08),in:RoundedRectangle(cornerRadius:7)).overlay(RoundedRectangle(cornerRadius:7).stroke(.red.opacity(0.58))) }
    private var sealedPanel: some View { VStack(spacing:8){Label(entry?.usedJdam == true ? "JDAM BRACKET SEALED":"BRACKET SEALED",systemImage:"checkmark.seal.fill").font(.headline.weight(.black)).foregroundStyle(.cyan);Text("Cloud receipt secured. This bracket follows you across every device.").font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.6))}.frame(maxWidth:.infinity).padding(18).background(.blue.opacity(0.12),in:RoundedRectangle(cornerRadius:7)).overlay(RoundedRectangle(cornerRadius:7).stroke(.cyan.opacity(0.48))) }
    private func scorecardPanel(_ row:NflPostseasonScorecard)->some View { VStack(alignment:.leading,spacing:10){Label("CERTIFIED PLAYOFF RECEIPT",systemImage:"list.clipboard.fill").font(.caption2.weight(.black)).tracking(1.5).foregroundStyle(.cyan);Text("\(row.totalPoints) POINTS").font(.system(size:30,weight:.black)).fontWidth(.condensed);HStack{metric("WC",row.wildCardPoints);metric("DIV",row.divisionalPoints);metric("CONF",row.conferencePoints);metric("SB",row.superBowlPoints)}}.padding(17).background(.black.opacity(0.88),in:RoundedRectangle(cornerRadius:7)).overlay(RoundedRectangle(cornerRadius:7).stroke(.blue.opacity(0.58))) }
    private func metric(_ label:String,_ value:Int)->some View { VStack{Text("\(value)").font(.headline.weight(.black));Text(label).font(.system(size:7,weight:.black)).foregroundStyle(.secondary)}.frame(maxWidth:.infinity) }
    private func commandLink(_ title:String,_ detail:String,_ icon:String,_ color:Color)->some View { HStack(spacing:12){Image(systemName:icon).font(.title2.weight(.black)).foregroundStyle(color);VStack(alignment:.leading){Text(title).font(.headline.weight(.black)).foregroundStyle(.white);Text(detail).font(.caption).foregroundStyle(.white.opacity(0.55))};Spacer();Image(systemName:"chevron.right").foregroundStyle(color)}.padding(15).background(.black.opacity(0.82),in:RoundedRectangle(cornerRadius:17)).overlay(RoundedRectangle(cornerRadius:17).stroke(color.opacity(0.45))) }

    private func resultMark(_ game:NflBracketGame,team:NflPostseasonTeam)->String { guard let result=results[game.id] else{return "ADVANCE"};return result==team.id ? "✓ CORRECT":"PICK" }
    private func select(_ team:NflPostseasonTeam,in game:NflBracketGame){picks[game.id]=team.id;NflBracketEngine.clearedDownstream(after:game.id,picks:&picks)}
    @MainActor private func load() async { defer{loading=false};guard let token=auth.token,let user=auth.user else{return};do{var loaded=try await SupabaseAPI.nflPostseasonSlate(token:token,leagueId:membership.leagueId,seasonKey:seasonKey);if loaded==nil && membership.leagues.mode=="foundry" && isCommissioner{loaded=try await SupabaseAPI.publishNflPostseasonSlate(token:token,leagueId:membership.leagueId,seasonKey:seasonKey,teams:Self.foundryField)};slate=loaded;if loaded != nil && membership.leagues.mode=="foundry" && isCommissioner{foundryBotsSeeded=try await SupabaseAPI.seedFoundryNflPostseason(token:token,leagueId:membership.leagueId,seasonKey:seasonKey).botsSeeded};async let loadedEntry=SupabaseAPI.nflPostseasonEntry(token:token,leagueId:membership.leagueId,userId:user.id,seasonKey:seasonKey);async let loadedResults=SupabaseAPI.nflPostseasonResults(token:token,leagueId:membership.leagueId,seasonKey:seasonKey);async let loadedScore=SupabaseAPI.nflPostseasonScorecard(token:token,leagueId:membership.leagueId,userId:user.id,seasonKey:seasonKey);entry=try await loadedEntry;picks=entry?.picks ?? [:];results=(try await loadedResults)?.winners ?? [:];scorecard=try await loadedScore}catch{errorMessage=error.localizedDescription} }
    @MainActor private func lockBracket(usedJdam:Bool) async {guard let token=auth.token else{return};saving=true;errorMessage=nil;do{entry=try await SupabaseAPI.lockNflPostseasonBracket(token:token,leagueId:membership.leagueId,seasonKey:seasonKey,picks:picks,usedJdam:usedJdam)}catch{errorMessage=error.localizedDescription};saving=false}
    @MainActor private func deployJdam() async {guard let teams=slate?.teams else{return};picks=NflBracketEngine.jdamPicks(teams:teams);guard complete else{errorMessage="JDAM could not resolve the bracket. Reopen postseason command and try again.";return};await lockBracket(usedJdam:true)}
    static var foundryField:[NflPostseasonTeam]{["AFC","NFC"].flatMap{conference in FootballTeamCatalog.nfl.filter{$0.conference.hasPrefix(conference)}.prefix(7).enumerated().map{index,team in .init(id:FootballTeamCatalog.normalizedTeamId(team.name),name:team.name,conference:conference,seed:index+1)}}}
}

private struct NflPostseasonFieldEditor: View {
    @EnvironmentObject private var auth:AuthStore;@Environment(\.dismiss) private var dismiss;let membership:LeagueMembership
    @State private var selections:[String:String]=[:];@State private var saving=false;@State private var error:String?
    private var seasonKey:Int{NflSeasonCalendar.seasonKey()}
    var body:some View{Form{Section{Text("OFFICIAL 14-TEAM FIELD").font(.title2.weight(.black));Text("Select one unique NFL team for every AFC and NFC seed. Publishing opens the verified bracket for the entire league.").font(.caption).foregroundStyle(.secondary)};ForEach(["AFC","NFC"],id:\.self){conference in Section(conference){ForEach(1...7,id:\.self){seed in Picker("#\(seed)",selection:binding(conference,seed)){Text("Select team").tag("");ForEach(FootballTeamCatalog.nfl.filter{$0.conference.hasPrefix(conference)}){team in Text(team.name).tag(team.name)}}.pickerStyle(.navigationLink)}}};Section{Button{Task{await publish()}}label:{HStack{Spacer();if saving{ProgressView()}else{Text("PUBLISH PLAYOFF FIELD").fontWeight(.black)};Spacer()}}.disabled(!valid||saving);if let error{Text(error).foregroundStyle(.red)}}}.navigationTitle("Playoff Field").navigationBarTitleDisplayMode(.inline)}
    private func key(_ c:String,_ s:Int)->String{"\(c)-\(s)"};private func binding(_ c:String,_ s:Int)->Binding<String>{Binding(get:{selections[key(c,s)] ?? ""},set:{selections[key(c,s)]=$0})};private var valid:Bool{selections.count==14 && selections.values.allSatisfy{!$0.isEmpty} && Set(selections.values).count==14}
    @MainActor private func publish()async{guard let token=auth.token else{return};saving=true;error=nil;let teams=["AFC","NFC"].flatMap{c in(1...7).compactMap{s->NflPostseasonTeam? in guard let name=selections[key(c,s)],!name.isEmpty else{return nil};return .init(id:FootballTeamCatalog.normalizedTeamId(name),name:name,conference:c,seed:s)}};do{_=try await SupabaseAPI.publishNflPostseasonSlate(token:token,leagueId:membership.leagueId,seasonKey:seasonKey,teams:teams);dismiss()}catch{self.error=error.localizedDescription};saving=false}
}

private struct NflPostseasonResultsView:View{
    @EnvironmentObject private var auth:AuthStore;let membership:LeagueMembership;let teams:[NflPostseasonTeam];@State private var winners:[String:String]=[:];@State private var saved:Set<String>=[];@State private var loading=true;@State private var saving=false;@State private var error:String?
    private var seasonKey:Int{NflSeasonCalendar.seasonKey()};private var games:[NflBracketGame]{NflBracketEngine.games(teams:teams,picks:winners)}
    var body:some View{ZStack{NflHomeBackdrop(phase:.wildCard);ScrollView{VStack(alignment:.leading,spacing:14){Text("OFFICIAL RESULTS CONTROL").font(.title2.weight(.black));Text("Record winners as games become final. Saved winners are permanent; later rounds unlock automatically.").font(.subheadline).foregroundStyle(.white.opacity(0.62));if loading{ProgressView().tint(.cyan)}else{ForEach(games){game in VStack(alignment:.leading,spacing:7){Text("\(game.round) · \(game.title)").font(.caption.weight(.black)).foregroundStyle(.cyan);if game.teams.count==2{ForEach(game.teams){team in Button{if !saved.contains(game.id){winners[game.id]=team.id;NflBracketEngine.clearedDownstream(after:game.id,picks:&winners)}}label:{HStack{Text("#\(team.seed) \(team.name)");Spacer();if winners[game.id]==team.id{Image(systemName:"checkmark.circle.fill")}}.padding(11).background(winners[game.id]==team.id ? .blue.opacity(0.35):.white.opacity(0.06),in:RoundedRectangle(cornerRadius:10))}.buttonStyle(.plain).disabled(saved.contains(game.id))}}else{Text("AWAITING PRIOR RESULTS").font(.caption2.weight(.black)).foregroundStyle(.secondary)}}.padding(12).background(.black.opacity(0.8),in:RoundedRectangle(cornerRadius:15))};Button{Task{await save()}}label:{HStack{Spacer();if saving{ProgressView()}else{Text("CERTIFY NEW RESULTS").fontWeight(.black)};Spacer()}}.buttonStyle(.borderedProminent).tint(.red).disabled(Set(winners.keys)==saved||saving)};if let error{Text(error).foregroundStyle(.red)}}.padding(16).padding(.bottom,30)}}.navigationTitle("NFL Results").navigationBarTitleDisplayMode(.inline).task{await load()}}
    @MainActor private func load()async{defer{loading=false};guard let token=auth.token else{return};do{winners=(try await SupabaseAPI.nflPostseasonResults(token:token,leagueId:membership.leagueId,seasonKey:seasonKey))?.winners ?? [:];saved=Set(winners.keys)}catch{self.error=error.localizedDescription}}
    @MainActor private func save()async{guard let token=auth.token else{return};saving=true;error=nil;do{let row=try await SupabaseAPI.saveNflPostseasonResults(token:token,leagueId:membership.leagueId,seasonKey:seasonKey,winners:winners);winners=row.winners;saved=Set(winners.keys)}catch{self.error=error.localizedDescription};saving=false}
}
