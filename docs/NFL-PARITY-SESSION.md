# NFL parity session (dev) — for Mike

Autonomous push toward CFB-level polish with NFL-specific heartbeat. Main/CFB freeze untouched.

## Already done before this session
- NFL theme (navy/crimson), home chrome, brand mark
- Odds + scores APIs, demo slate with NFL teams
- Crystal Ball default **off** for NFL
- `nfl-voice`: Gazette crowns/shame, lock roasts, hot takes, WTF desk lines
- Sport-aware home tagline presets

## This session — shipped on `dev`

### Calendar & odds (P0)
- **NFL week map** in `season-calendar.ts`: separate 2026 date windows; week labels = Wild Card / Divisional / Conference / Super Bowl (not CFP)
- Auto-detect sport via `getLeague()` so existing `weekTitle()` callers pick NFL labels in NFL rooms
- **Odds filter** (`odds.ts` + `/api/odds/nfl`) uses NFL windows
- Demo slate kickoffs use sport-aware windows

### Rules & onboarding
- `getRulesForSport("nfl")` — pro intro, no Crystal Ball section, playoff language, inactive-list lock copy
- `RulesContent` reads active league sport
- Rules onboarding modal hides CB blurb for NFL / CB-off
- Player tutorial: “save before kickoff” (not Saturday)

### Invites
- Full **NFL invite bank** for every flavor (warroom → chaos): Sundays / primetime / inactive list — not Alabama/Saturday campus

### Achievements (foundation for dual-sport)
- `nfl-achievements.ts` — ~20 NFL cheevos (common → legendary)
- `nfl-badge-eval.ts` — live eval for most; partial for playoff/title
- Wired into `getPlayerBadges` in NFL rooms only
- CFB-only badges hidden in NFL (Crystal Ball etc.)
- **Display overlay**: Perfect Saturday → Perfect Sunday, etc. in NFL context
- Equipable titles: Perfect Sunday, Primetime General, Red Zone Assassin, Film Don't Lie, Immortal Sunday, Super Bowl Desk, Late Window Legend

### Chrome & copy polish
- Home week hero: crimson glow for NFL
- Season open welcome: primetime copy + crimson glow
- Join: CFB **and** NFL live; “playoff weeks” not “CFP weeks”
- Commish settings: NFL season map + CB blurb
- Championship / Toilet Bowl: playoff language (not CFP/Conf Champ only)
- Registry blurb + Super Bowl pride label
- Mock bot roast: sport-neutral

### Still later (honest backlog)
- Full dual-sport “earn X in CFB **and** Y in NFL” cheevos + bridge titles
- Career bank scoped by sport (points can still bleed across until scoped)
- Guest demo NFL path
- Deeper playoff hardware / Super Bowl desk eval polish
- Commish “finish remaining → CFP Final” string still CFB-leaning in a few places
- Cross-sport passport UI shelf (WWC-style stamp chrome for NFL)

## How to smoke
1. Create/open **NFL** league on dev
2. Check home hero glow, week labels, rules page, invite share text
3. Pull odds / demo week (windows should match NFL dates)
4. Score sandbox week → Gazette voice + hot takes
5. Open Status / profile badges → NFL bank + Sunday renames
