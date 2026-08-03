# COMMISSIONER REVIEW 3 — FLOWS, COPY, TREE, SECTION NOTES

**Purpose:** Product-clarity review inputs (routing, onboarding, copy, component tree, section inventory).  
**Not a redesign.** Full source lives in REVIEW-1 and REVIEW-2.  
**Generated:** 2026-08-03

---

## 5. Route / query logic (which tab opens)

**Route:** `/commissioner`  
**Query params read:** `tab`, `first`  
**Hash:** `#commish-bots`

### Tab type
```ts
useState<"card" | "results" | "settings" | "picks">("card")
```

### Resolution order on boot (`useEffect` depends on `searchParams`)

1. Read `tabParam = searchParams.get("tab")`
2. Read `firstParam = searchParams.get("first")`
3. Read `hash` from `window.location.hash` (strip `#`)
4. **If** `tab` is one of `card | results | settings | picks`:
   - If `tab === "settings"` **and** user is **not** owner → force `card`
   - Else `setTab(tabParam)`
5. **Else if** `first === "1"` → `setTab("card")`
6. **Else if** user is **owner** → `setTab("settings")`  ⚠️ default owner lands Settings
7. **Else** (deputy/ops) → `setTab("card")`
8. **If** owner **and** hash `commish-bots` → `settings` + open advanced + scroll to `#commish-bots`
9. **Later (async after cloud):** if **no** `tabParam` and (`firstTime` **or** `first=1` **or** creator eyes `new_commissioner`) → force `setTab("card")`

### Deep links used by product

| URL | Intent |
|-----|--------|
| `/commissioner?tab=card&first=1` | First-hour Build Card + FirstCardWizard |
| `/commissioner?tab=card` | Build Card |
| `/commissioner?tab=picks` | Who's in |
| `/commissioner?tab=results` | Enter Results |
| `/commissioner?tab=settings` | League settings (owner only) |
| `/commissioner#commish-bots` | Settings + scroll bots (owner) |
| Onboarding `resolveHref: "commissionerCard"` | `/commissioner?tab=card&first=1` |
| Onboarding `resolveHref: "commissionerResults"` | `/commissioner?tab=results` |

### Gate: who can open the page

- `allowed` from `isOps()` (commissioner **or** deputy/mod ops)
- Not allowed → message + link Home
- `isOwner` from `isCommissioner()` — settings / pass / reset / deputies / many advanced tools

### Simple host / first-time chrome flags

| Flag | Source | Effect on UI |
|------|--------|----------------|
| `firstTime` | `isFirstTimeCommish` (no scored weeks + not graduated) **or** creator eyes `new_commissioner` | "Commish · first hour" chrome; FirstCardWizard path; hide View as Player + odds credits; hide CommishWeekChecklist; bury Settings tab unless link |
| `simpleHost` | `isSimpleHostSurface` (same graduation as first-time for normal hosts; creators false) | Similar simplified chrome |
| `labTools` | `showCommishLabTools()` (app creator / Foundry sticky / eyes / sandbox) | Demo week, dry-run odds, Foundry scoring lab, SandboxHopOptIn |
| `deepHostTools` | `canShowDeepHostTools` (app creator only) | Chaos bots, deep bot ops |
| `advancedOpen` | deep tools && !eyes && !firstTime by default | Collapsed advanced in settings |

---

## 6. First-time commissioner onboarding hooks that interact with this page

### A. Conversation engine (`src/lib/onboarding/*`)

- **Start:** `maybeStartOnboarding()` in `start.ts` — if `isActuallyCommissioner()` && `isFirstTimeCommish` && `needsJourney("commissioner")` → `startJourney("commissioner")`
- **Journey file:** `journeys/commissioner.ts` (Scrub #2 rewrite)
  - welcome → invite → **build_week** (resolves to `commissionerCard` = `/commissioner?tab=card&first=1`) → youre_ready
  - Peak celebrate on `warroom-card-published` event after publish
  - Scoring **not** in journey
- **Host UI:** `OnboardingHost` mounted from Nav (app shell), not inside CommissionerClient
  - On build_week: points at Commish nav; primary "Start here · Build the card"
  - `resolveHref: "commissionerCard"` → push card tab with first=1
- **Success after publish:** cloud publish fires `warroom-card-published` → engine celebrates → finish

### B. Local first-time flags (`commish-onboarding.ts`)

| Flag | Set when | Used for |
|------|----------|----------|
| `hostScreenSeen` | (available) | setup spine |
| `inviteCopied` | share/copy invite | banner + onboarding invite step (session `warroom-invite-shared`) |
| `firstCardPublished` | `markFirstCardPublished` after publish / demo publish | first-time bookkeeping |
| `practiceWeekDone` | demo generate in wizard (lab) | practice mark |
| `graduated` | first scored week or explicit | exit first-time |

`isFirstTimeCommish({ leagueId, scoredWeekCount })` → false if any scored week or graduated.

### C. Surfaces outside /commissioner that funnel in

- **CommishSetupBanner** (Home): Start here invite / Build practice week → `/commissioner?tab=card&first=1`; soft score link → `?tab=results`. Hidden partially when commissioner journey active except invite/build steps.
- **Home first-week chrome** text points at Start here
- **InviteFriends** can set invite flags that advance onboarding

### D. Inside CommissionerClient onboarding-adjacent behavior

- `first` query + `firstTime` shows **FirstCardWizard** when no published games
- `markFirstCardPublished` on successful publish / demo publish
- `markCommishGraduated` / firstTime false after first score path
- `markPracticeWeekDone` on lab demo slate generate
- Header still shows **"Three jobs: Build Card · Who's in · Enter Results"** and **"fake weeks live in Foundry"** when `firstTime || simpleHost` (note: conflicts with Scrub #2 journey copy still present on this page chrome)

---

## 7. Plain-text component tree (appearance order)

```
/commissioner (page.tsx)
└── dynamic CommissionerClient (ssr:false)
    └── Suspense → CommissionerPageInner
        │
        ├── [if allowed === false] Access denied card → Home link
        │
        ├── [if weekBootBusy] "Loading this week's card…"
        │
        ├── OpenRoomLeaveNudge
        ├── OpenRoomBotsNudge (modal, conditional open)
        ├── [preseason tools popup] Real season live dialog
        │
        └── <main>
            ├── Header
            │   ├── H1: "Commish · first hour" | "Commish" | "Deputy Ops"
            │   ├── Subtitle (first-hour path OR Settings·Build·Who's in·Results)
            │   ├── [firstTime||simpleHost && owner] THREE JOBS banner (Foundry mention)
            │   └── [!(firstTime||simpleHost)]
            │       ├── View as player strip → setViewAsPlayer + Home
            │       └── Odds API credits strip
            │
            ├── [!(firstTime||simpleHost)] CommishWeekChecklist
            │   └── steps 1–5 (Invite, Build, Bots?, Locks, Score) → onGoTab
            │
            ├── Tab bar (pill buttons)
            │   ├── [owner && !simple first] Settings
            │   ├── Build Card
            │   ├── Who's in
            │   └── Enter Results
            │
            ├── [owner && simple first] "League settings" text link
            │
            ├── TAB settings (owner only)
            │   ├── [simpleHost] Simple host mode blurb
            │   ├── [labTools] SandboxHopOptIn
            │   ├── [!simpleHost] SportPoolCommishPanel
            │   ├── League (name, code, regenerate, invite share text)
            │   ├── Season rules (cut %, crystal ball, tagline, theme)
            │   ├── Save settings
            │   ├── [simple host bots] Fill empty seats?
            │   ├── [advanced / deep] Trophy Room, bots chaos, etc.
            │   ├── Deputy commissioners (setMemberModeration)
            │   ├── Pass commissioner (transferCommissioner)
            │   ├── Start next season / Advanced reset
            │   └── Danger zone (delete league)
            │
            ├── TAB card (Build Card)
            │   ├── [first wizard conditions] FirstCardWizard
            │   ├── [lab + wizard] lab wall message
            │   └── [else full tools]
            │       ├── Lazy commissioner protection banner
            │       ├── Pick'em week chips
            │       ├── Pull Live Odds panel
            │       │   ├── [lab] Publish demo week / Generate demo / Dry run
            │       │   ├── Pull Odds button
            │       │   ├── rank heat filters
            │       │   └── game list multi-select (target 5)
            │       ├── Weekly prop panel (presets / custom)
            │       ├── Publish card CTA
            │       └── Published status / date range note
            │
            ├── TAB picks (Who's in)
            │   ├── Refresh / Announce who hasn't picked
            │   ├── Week chips
            │   ├── Status counts (complete/partial/missing)
            │   └── Roster rows → PlayerLink
            │
            └── TAB results (Enter Results)
                ├── Primary Score this week CTA
                │   ├── [practiceTools/lab] randomize & score
                │   └── [live] syncFinalScores(true)
                ├── [firstTime] green button coach blurb
                ├── [labTools] Foundry · advanced scoring lab (details)
                ├── Score which week? chips
                ├── Game results entry / Sync final scores
                ├── Prop Result
                ├── Save & Score / unlock paths
                └── Your Picks Scored summary
```

### Concurrent app chrome (not in tree but visible on /commissioner)

- App Nav (bottom) — includes Commish tab; mounts OnboardingHost
- FoundrySessionChrome (creator/Foundry sticky only) — "← Foundry" bar
- Any global modals (Gazette, etc.) unrelated to desk structure

---

## 8. Section notes (what user sees / action / when visible / real data?)

### Gate / loading
| Field | Detail |
|-------|--------|
| **Sees** | Pulse "Opening host tools…" (page/loading) or denied card |
| **Action** | Wait or go Home |
| **Visible** | Always on entry until client ready; deny if !isOps |
| **Real data?** | No writes |

### Header — titles & first-hour THREE JOBS
| Field | Detail |
|-------|--------|
| **Sees** | Title + path copy; first-time banner lists Build Card · Who's in · Enter Results + **Foundry** mention |
| **Action** | Orientation only |
| **Visible** | Always when allowed; THREE JOBS when owner && (firstTime \|\| simpleHost) |
| **Real data?** | No |

### View as player
| Field | Detail |
|-------|--------|
| **Sees** | Warning strip + "Enter player view →" |
| **Action** | `setViewAsPlayer(true)` localStorage; navigate Home; hides commish chrome app-wide |
| **Visible** | Owner path when NOT firstTime/simpleHost |
| **Real data?** | **No** — UI-only flag; server perms unchanged |

### Odds API credits
| Field | Detail |
|-------|--------|
| **Sees** | Credits remaining / used |
| **Action** | None |
| **Visible** | Same as View as player block when credits known |
| **Real data?** | Read-only external API meta |

### CommishWeekChecklist
| Field | Detail |
|-------|--------|
| **Sees** | Numbered weekly jobs 1–5 with done states |
| **Action** | Jump tabs / settings |
| **Visible** | NOT firstTime/simpleHost |
| **Real data?** | Reads cloud roster/card/picks/scored; no write |

### Tab: Settings — League
| Field | Detail |
|-------|--------|
| **Sees** | Name, invite code, regenerate, share helpers |
| **Action** | Rename league; regenerate code; copy/share invite |
| **Visible** | Owner + settings tab |
| **Real data?** | **Yes** — league row / code |

### Tab: Settings — Season rules / theme / tagline / crystal ball / cut %
| Field | Detail |
|-------|--------|
| **Sees** | Form controls for season presentation + cut |
| **Action** | Save league settings |
| **Visible** | Owner settings |
| **Real data?** | **Yes** — league.settings |

### Tab: Settings — Fill empty seats / bots
| Field | Detail |
|-------|--------|
| **Sees** | Add/remove trial bots, fill to 16, chaos (deep) |
| **Action** | Seed/clear bots; bot picks |
| **Visible** | Owner; simple host simplified; deep tools creator |
| **Real data?** | **Yes** — roster members, bot picks |

### Tab: Settings — Deputies / moderators
| Field | Detail |
|-------|--------|
| **Sees** | Roster with promote/demote mod |
| **Action** | `setMemberModeration` |
| **Visible** | Owner advanced/settings |
| **Real data?** | **Yes** — membership roles |

### Tab: Settings — Pass commissioner
| Field | Detail |
|-------|--------|
| **Sees** | Transfer gavel UI |
| **Action** | `transferCommissioner` |
| **Visible** | Owner |
| **Real data?** | **Yes** — ownership transfer |

### Tab: Settings — Start next season / Reset season / Danger zone
| Field | Detail |
|-------|--------|
| **Sees** | Confirm typed NEXT/RESET; delete league |
| **Action** | `startNextSeasonInCloud` / `resetSeasonInCloud` / `resetLeague` |
| **Visible** | Owner |
| **Real data?** | **Yes — destructive** season wipe / delete |

### Tab: Settings — SportPoolCommishPanel
| Field | Detail |
|-------|--------|
| **Sees** | Multi-sport pool management |
| **Action** | Pool config |
| **Visible** | !simpleHost owner settings |
| **Real data?** | **Yes** if configured |

### Tab: Settings — SandboxHopOptIn
| Field | Detail |
|-------|--------|
| **Sees** | Lab hop opt-in |
| **Action** | Creator sandbox hop |
| **Visible** | labTools only |
| **Real data?** | Lab/session; not regular host |

### Tab: Build Card — FirstCardWizard
| Field | Detail |
|-------|--------|
| **Sees** | Start here practice-week coach; Publish CTA; optional Lab demo details |
| **Action** | Publish; dismiss to full tools; lab demo |
| **Visible** | showFirstWizard && no published games && (firstTime \|\| first=1) |
| **Real data?** | Publish **yes**; demo lab only if labTools |

### Tab: Build Card — Lazy commissioner protection
| Field | Detail |
|-------|--------|
| **Sees** | 48h auto-post + two-miss gavel warning |
| **Action** | None (policy text) |
| **Visible** | When not (firstTime && empty card) in full tools |
| **Real data?** | Describes automated real behavior |

### Tab: Build Card — Week chips
| Field | Detail |
|-------|--------|
| **Sees** | Season weeks; scored strikethrough |
| **Action** | Change active week (local + cloud active week) |
| **Visible** | Full tools card tab |
| **Real data?** | Active week **yes** when set via cloud helpers |

### Tab: Build Card — Pull Live Odds
| Field | Detail |
|-------|--------|
| **Sees** | Pull Odds, filters, game multi-select, lab demo buttons |
| **Action** | Fetch odds API; select 5 games; dry-run (lab) |
| **Visible** | Full tools (always for real hosts; lab may gate behind wizard) |
| **Real data?** | Selection is draft until Publish; odds pull uses API credits |

### Tab: Build Card — Weekly prop
| Field | Detail |
|-------|--------|
| **Sees** | Preset categories / custom prop |
| **Action** | Edit draft prop |
| **Visible** | Full tools |
| **Real data?** | Draft only until Publish |

### Tab: Build Card — Publish
| Field | Detail |
|-------|--------|
| **Sees** | Publish button + status |
| **Action** | `publishWeekCard` → live My Picks for league |
| **Visible** | Full tools / wizard |
| **Real data?** | **Yes — critical** week card for all members |

### Tab: Who's in
| Field | Detail |
|-------|--------|
| **Sees** | Complete/partial/missing without pick contents; announce CTA |
| **Action** | Refresh status; `postMissingPicksAnnouncement` |
| **Visible** | picks tab (ops) |
| **Real data?** | Read picks status; announce **writes** news |

### Tab: Enter Results — primary Score
| Field | Detail |
|-------|--------|
| **Sees** | Big green score button |
| **Action** | Live: sync scores + score week; Lab: randomize & score |
| **Visible** | results tab |
| **Real data?** | **Yes — standings, gazette path, graduation** |

### Tab: Enter Results — Foundry advanced scoring lab
| Field | Detail |
|-------|--------|
| **Sees** | Auto-score range, randomize tools |
| **Action** | Sandbox auto-finish weeks |
| **Visible** | labTools only |
| **Real data?** | **Can write scores** if run on live league as creator — lab intent |

### Tab: Enter Results — manual results / prop / save
| Field | Detail |
|-------|--------|
| **Sees** | Per-game covers, prop winner, unlock |
| **Action** | `saveResultsAndScoreWeek`, clear scores |
| **Visible** | results tab |
| **Real data?** | **Yes** |

### OpenRoom nudges
| Field | Detail |
|-------|--------|
| **Sees** | Leave/bots nudges for open rooms |
| **Action** | Dismiss / bot fill prompts |
| **Visible** | Conditional open-room state |
| **Real data?** | Bot fill **yes** if accepted |

---

## 4. Commissioner-only / host-desk copy strings (catalog)

### Access / shell
- "Ops desk" / "Commish tools" / "Opening host tools…"
- "Loading this week's card…"
- Access denied messaging (ops only)

### Headers
- "Commish · first hour"
- "Commish"
- "Deputy Ops"
- "Invite → Pull Odds → pick 5 → publish → score when games die."
- "Settings · Build card · Who's in · Results"
- "Build card · Who's in · Results (settings stay with the commish)"
- "Commish · first hour" (banner kicker)
- "Three jobs: Build Card · Who's in · Enter Results. Live odds only — fake weeks live in Foundry for the shop. Settings stay buried until you score a week."

### View as player / credits
- "View as player"
- "Hide Commish tools and see the app like your league mates."
- "Enter player view →"
- "Odds API credits left:"
- Free plan credits explanatory copy (Pull Odds ≈ 1, Sync scores ≈ 2, Demo slate zero)

### Tabs
- "Settings"
- "Build Card"
- "Who's in"
- "Enter Results"
- "Need bots, open room, or advanced tools? League settings"

### Settings
- "Simple host mode" + jobs invite/post/fill/score
- "League" / "Season rules" / "Fill empty seats?"
- "Trophy Room"
- "Deputy commissioners"
- "Pass commissioner"
- "Start next season" / "Advanced · same wipe" / "Reset season (keep players)"
- "Danger zone" / "Delete league and reset app"
- Typed confirmations: NEXT / RESET

### Build Card
- FirstCardWizard (see component): "Start here", "Practice week · I'm with you", Pull Odds / Publish labels
- "Lazy commissioner protection" + 48h / two-week gavel copy
- "Pick'em week"
- "Pull Live Odds — {week}"
- "DRY RUN" lab copy
- "Publish demo week" / "Generate demo slate" (lab)
- "Weekly prop"
- Publish CTAs and "Everyone's My Picks refreshes…"

### Who's in
- "Who's in — {week}"
- "Shows who submitted a full card. You never see their sides…"
- "Refresh" / "Announce who hasn't picked"
- Complete / Partial / Missing labels
- RLS/policy help pointing at picks-privacy.sql

### Enter Results
- "Score this week"
- Live vs "Foundry lab: one tap can randomize…"
- "Score {week}" / "Score {week} (lab)" / already scored
- "Use the green button above…" (firstTime)
- "Foundry · advanced scoring lab"
- "Auto-score weeks (sandbox)"
- "Score which week?"
- "Prop Result" / "Your Picks Scored"
- Unlock / dry-run warnings

### Preseason popup
- PRESEASON_COMMISH_TOOLS_TITLE + body from season-mode
- "Live path: Pull Odds → publish → friends pick → Sync final scores → Save & Score."
- "Got it"

### Foundry / lab title attributes & toasts (examples)
- title "Foundry: fake 5 games + prop + publish + bots"
- "Foundry: load fake games only"
- Demo week published … Enter Results Randomize & score
- "Foundry only. Pull Odds without week date filter." (elsewhere in file)

### CommishWeekChecklist labels
- "1. Invite the room"
- "2. Build & publish the card"
- "3. Fill empty seats? (optional)"
- "4. Get locks in"
- "5. Score the week" (and related why/detail strings)

### Onboarding journey (coach, not page-local but lands here)
- See REVIEW-2 `commissioner.ts`: "This is your room.", "Build one practice week.", peak "Wow… you can actually run this."

### Invite copy bank
- Full multi-flavor SMS templates in `commish-onboarding.ts` (CFB + NFL) — entire file in REVIEW-2

---

## Foundry references inventory (production host desk)

| Location | User-visible? | Notes |
|----------|---------------|-------|
| first-hour THREE JOBS banner | **Yes** regular first-time hosts | "fake weeks live in Foundry for the shop" |
| Enter Results lab primary subtitle | Only if practiceTools | "Foundry lab: one tap…" |
| details summary | labTools | "Foundry · advanced scoring lab" |
| button titles / dry-run | labTools | title attributes |
| FirstCardWizard lab details | labTools | now "Lab · demo slate" (Scrub #2) |
| foundry-preview.ts | gate only | showCommishLabTools |
| Comments throughout client | No | many Foundry comments |

---

## Mutations that change real league data (summary)

| Action | Function(s) |
|--------|-------------|
| Publish card | `publishWeekCard` |
| Score week | `saveResultsAndScoreWeek` / score paths / `advanceLeagueAfterScore` |
| Sync finals | `fetchFootballScores` + build results |
| Save settings | `updateLeagueSettings` / `saveLeagueToCloud` |
| Regenerate code | `regenerateCodeInCloud` |
| Bots add/remove/fill | cloud bot APIs |
| Deputies | `setMemberModeration` |
| Pass commish | `transferCommissioner` |
| Season reset / next | `resetSeasonInCloud` / `startNextSeasonInCloud` |
| Delete league | `resetLeague` |
| Missing picks announce | `postMissingPicksAnnouncement` |
| Active week | `setLeagueActiveWeek` |

---

## Known product-clarity tensions (inventory only — not redesign)

1. Owner default tab without `?tab=` is **settings**, then async may force **card** if firstTime — possible flash.
2. Page still shows **"Three jobs"** + **Foundry** in first-hour chrome while conversation engine says hosting, not checklist.
3. Settings buried for simple host but link still available; checklist 5 jobs for graduated hosts is another framework.
4. FirstCardWizard Scrub #2 vs header THREE JOBS inconsistency.
5. Lab Foundry strings can appear if creator/Foundry session; regular hosts still see Foundry word in first-hour banner.

---

## File map for this package

| File | Contents |
|------|----------|
| `docs/COMMISSIONER-REVIEW-1-PAGE.md` | Full `page.tsx`, `loading.tsx`, `CommissionerClient.tsx` |
| `docs/COMMISSIONER-REVIEW-2-COMPONENTS.md` | Full sources of all direct + related components/hooks |
| `docs/COMMISSIONER-REVIEW-3-FLOWS.md` | This file (routing, onboarding, tree, notes, copy) |
| `docs/COMMISSIONER-FULL-REVIEW-PACKAGE.md` | Index + how to feed ChatGPT |
