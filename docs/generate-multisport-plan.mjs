import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  Header,
  Footer,
  HeadingLevel,
  BorderStyle,
  WidthType,
  ShadingType,
  AlignmentType,
  PageNumber,
  LevelFormat,
} from "docx";
import fs from "fs";

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const headerBorder = { style: BorderStyle.SINGLE, size: 1, color: "1a1a1a" };
const headerBorders = {
  top: headerBorder,
  bottom: headerBorder,
  left: headerBorder,
  right: headerBorder,
};

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after ?? 120, before: opts.before ?? 0 },
    children: [
      new TextRun({
        text,
        font: "Arial",
        size: opts.size ?? 22,
        bold: opts.bold,
        italics: opts.italics,
        color: opts.color,
      }),
    ],
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200 },
    children: [
      new TextRun({
        text,
        font: "Arial",
        size: 32,
        bold: true,
        color: "111111",
      }),
    ],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 160 },
    children: [
      new TextRun({
        text,
        font: "Arial",
        size: 26,
        bold: true,
        color: "1a1a1a",
      }),
    ],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 120 },
    children: [
      new TextRun({
        text,
        font: "Arial",
        size: 24,
        bold: true,
        color: "333333",
      }),
    ],
  });
}

function bullet(text, ref = "bullets") {
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { after: 80 },
    children: [new TextRun({ text, font: "Arial", size: 22 })],
  });
}

function check(text, ref = "checks") {
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text, font: "Arial", size: 20 })],
  });
}

function cell(text, w, opts = {}) {
  return new TableCell({
    borders: opts.header ? headerBorders : borders,
    width: { size: w, type: WidthType.DXA },
    shading: opts.header
      ? { fill: "1B4332", type: ShadingType.CLEAR }
      : opts.fill
        ? { fill: opts.fill, type: ShadingType.CLEAR }
        : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            font: "Arial",
            size: opts.size ?? 18,
            bold: !!opts.header || !!opts.bold,
            color: opts.header ? "FFFFFF" : opts.color || "222222",
          }),
        ],
      }),
    ],
  });
}

function twoCol(a, b, wa = 2800, wb = 6560) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [wa, wb],
    rows: [
      new TableRow({
        children: [
          cell(a, wa, { bold: true, fill: "E8F5E9" }),
          cell(b, wb),
        ],
      }),
    ],
  });
}

function spacer() {
  return new Paragraph({ spacing: { after: 60 }, children: [] });
}

const sports = [
  {
    order: 1,
    id: "nfl",
    name: "NFL",
    season: "Sep-Feb (preseason optional, 18 regular + playoffs)",
    unit: "Week (Thu-Mon slate)",
    lock: "First kickoff of the card freezes the full card",
    pickMode: "ATS spreads (and/or moneyline + props)",
    lines: "The Odds API or similar - American football / NFL",
    calendar: "Week 1-18 RS, Wild Card, Divisional, Conference, Super Bowl",
    crystal: "Super Bowl champion pick (0 pts, pure pride)",
    trophies: "Championship · Toilet Bowl · Super Bowl Nerd (Crystal Ball)",
    badges:
      "Perfect Sunday, Primetime Sniper, Division Domination, Super Bowl Prophet, Bye Week Ghost, Road Dog, Cover King",
    flavor: "Sunday Ticket energy, milk-carton no-locks, primetime crown",
    hard: "TNF/SNF/MNF multi-day freeze; byes; international games",
  },
  {
    order: 2,
    id: "cfb",
    name: "NCAA D1 FBS (College Football)",
    season: "Aug-Jan (already live as flagship)",
    unit: "Week 0-18 War Room calendar (openers to CFP Final)",
    lock: "First kickoff freezes entire card (already built)",
    pickMode: "ATS + Best Bet + prop (current product)",
    lines: "Odds API NCAAF (current)",
    calendar: "Week 0, RS 1-13, Conf Champ, CFP R1-Final",
    crystal: "National champ Crystal Ball (live)",
    trophies: "Championship · Toilet · Village Nerd (live)",
    badges: "Existing CFB catalog + sport tag migration",
    flavor: "Keep as gold standard - every other sport copies this soul",
    hard: "Migrate current CFB into sport pack without breaking live leagues",
  },
  {
    order: 3,
    id: "nba",
    name: "NBA",
    season: "Oct-June",
    unit: "Weekly card recommended (e.g. Fri-Thu) for friend leagues",
    lock: "First tip of the card freezes; or per-game if multi-night",
    pickMode: "ATS / total / player props (start with ATS + 1 prop)",
    lines: "Odds API basketball NBA",
    calendar: "Regular season months + play-in + playoffs rounds",
    crystal: "NBA Finals champion pick",
    trophies: "Championship · Toilet · Finals Oracle",
    badges:
      "Triple-Double Night, Clutch Gene (OT cover), Back-to-Back Survivor, Playoff Heat, Tank Commander",
    flavor: "Late-night lock drama, load management roasts",
    hard: "Dense schedule - need clear week definition so friends do not burn out",
  },
  {
    order: 4,
    id: "march_madness",
    name: "March Madness",
    season: "March-April (short, high intensity)",
    unit: "Round-based (R64, R32, Sweet 16, Elite 8, Final Four, Title)",
    lock: "First tip of that round freezes the round card",
    pickMode: "Game winners + optional upset/margin props; optional full bracket",
    lines: "Odds + official bracket teams as they advance",
    calendar: "Selection Sunday through Championship Monday",
    crystal: "Title team before tip of R64 (or after Selection)",
    trophies: "Bracket King · Bust Bracket · Cinderella Whisperer",
    badges:
      "12-seed Believer, Chalk Eater, Final Four or Bust, Office Pool Menace",
    flavor: "Cutthroat short season - perfect special-event War Room mode",
    hard: "Bracket UI vs weekly card; auto-advance; empty slots after upsets",
  },
  {
    order: 5,
    id: "nascar",
    name: "NASCAR",
    season: "Feb-Nov (Cup Series default)",
    unit: "Race weekend",
    lock: "Green flag / before race start freezes picks",
    pickMode: "Race winner, top-5/10, stage props, DNFs (not classic ATS)",
    lines: "Odds race markets + entry list",
    calendar: "Full Cup schedule or playoff races only option",
    crystal: "Season Cup champion pick",
    trophies: "Checkered Flag · Last Place Tow · Stage Prophets",
    badges:
      "Polesitter Prophet, Restrictor Plate Gambler, Playoff Clincher, Caution Chaos",
    flavor: "Crash-outs as Gazette shame; milk carton = no race picks before green",
    hard: "Not spread-based - redesign card UX (driver lists, finish position)",
  },
  {
    order: 6,
    id: "mlb",
    name: "Baseball (MLB)",
    season: "Mar/Apr-Oct/Nov",
    unit: "Weekly card recommended (daily is optional advanced mode)",
    pickMode: "Run line (-1.5) + moneyline + totals; optional first-5",
    lines: "Odds API baseball MLB",
    calendar: "RS months + Wild Card / DS / CS / World Series",
    crystal: "World Series champ pick",
    trophies: "Championship · Toilet · Fall Classic Oracle",
    badges:
      "Bullpen Nightmare, Extra Innings Ice, Sweep Spotter, October Baseball",
    flavor: "Long season - iron lungs + volume badges matter more",
    hard: "Doubleheaders, postponements, rainouts, huge volume",
  },
  {
    order: 7,
    id: "soccer",
    name: "Soccer",
    season: "League-dependent (EPL Aug-May, MLS, UCL, World Cup windows)",
    unit: "Matchday / weekly slate",
    pickMode: "1X2 (home/draw/away) and/or Asian handicap + BTTS/O-U",
    lines: "Odds API soccer (primary competition per league setting)",
    calendar: "Configurable: EPL, MLS, UCL knockout, or World Cup mode",
    crystal: "League champion or tournament winner",
    trophies: "Championship · Toilet · Trophy Whisperer",
    badges:
      "Draw Merchant, Clean Sheet Prophet, Upset Away Day, Stoppage-Time Heartbreak",
    flavor: "Draws break American brains - Gazette gold",
    hard: "Competition picker; international windows; 1X2 vs two-way markets",
  },
];

const children = [];

children.push(
  new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({
        text: "WAR ROOM PICK'EM",
        font: "Arial",
        size: 20,
        bold: true,
        color: "2D6A4F",
      }),
    ],
  })
);
children.push(
  new Paragraph({
    spacing: { after: 120 },
    children: [
      new TextRun({
        text: "Multi-Sport Expansion Plan",
        font: "Arial",
        size: 40,
        bold: true,
        color: "111111",
      }),
    ],
  })
);
children.push(
  p(
    "How to add NFL, NCAA D1 FBS, NBA, March Madness, NASCAR, Baseball, and Soccer — without losing the War Room soul.",
    { italics: true, color: "555555", after: 80 }
  )
);
children.push(
  p(
    "Living checklist for the product folder · Keep all the same flavors · Sport-specific achievements · Multi-sport profile hardware",
    { size: 18, color: "777777", after: 200 }
  )
);
children.push(
  p(
    "Created for Mike V. · War Room Pick'em · " +
      new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    { size: 18, color: "888888", after: 280 }
  )
);

// 1
children.push(h1("1. Vision"));
children.push(
  p(
    "War Room Pick'em is not another generic pick'em site. It is a private-league locker room: Gazette drama, badges, profiles, career flex, Trophy Room, lock rules with teeth, and friend-group personality."
  )
);
children.push(
  p(
    "Multi-sport means the same clubhouse, different fields. When a commissioner creates a league, they pick the sport. Everything sticky stays. Only the slate, calendar, scoring markets, and sport-specific achievements change."
  )
);
children.push(
  p(
    "North star: a player profile can show an NFL championship plaque and a hockey (or CFB) ring side by side — sport-tagged hardware and badges that travel with the person, not just one season spreadsheet.",
    { after: 200 }
  )
);

// 2
children.push(h1("2. Commissioner sport picker (create-league)"));
children.push(
  p(
    "When someone creates a league as commissioner, they choose sport in this exact UI order:"
  )
);

children.push(
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [800, 3200, 2200, 3160],
    rows: [
      new TableRow({
        children: [
          cell("#", 800, { header: true }),
          cell("Sport", 3200, { header: true }),
          cell("Code", 2200, { header: true }),
          cell("Build priority", 3160, { header: true }),
        ],
      }),
      new TableRow({
        children: [
          cell("1", 800, { bold: true }),
          cell("NFL", 3200),
          cell("nfl", 2200),
          cell("First net-new pack after CFB is a pack", 3160),
        ],
      }),
      new TableRow({
        children: [
          cell("2", 800, { bold: true }),
          cell("NCAA D1 FBS", 3200),
          cell("cfb", 2200),
          cell("Already live — migrate to sport pack first", 3160),
        ],
      }),
      new TableRow({
        children: [
          cell("3", 800, { bold: true }),
          cell("NBA", 3200),
          cell("nba", 2200),
          cell("Third", 3160),
        ],
      }),
      new TableRow({
        children: [
          cell("4", 800, { bold: true }),
          cell("March Madness", 3200),
          cell("march_madness", 2200),
          cell("Seasonal event mode", 3160),
        ],
      }),
      new TableRow({
        children: [
          cell("5", 800, { bold: true }),
          cell("NASCAR", 3200),
          cell("nascar", 2200),
          cell("Non-ATS card redesign", 3160),
        ],
      }),
      new TableRow({
        children: [
          cell("6", 800, { bold: true }),
          cell("Baseball (MLB)", 3200),
          cell("mlb", 2200),
          cell("Long-season volume", 3160),
        ],
      }),
      new TableRow({
        children: [
          cell("7", 800, { bold: true }),
          cell("Soccer", 3200),
          cell("soccer", 2200),
          cell("1X2 + competition setting", 3160),
        ],
      }),
    ],
  })
);

children.push(
  p(
    "UI note: list always appears in that order. CFB remains the gold-standard implementation; treat it as a sport pack so NFL is mostly markets + calendar + badge pack.",
    { size: 18, color: "555555", before: 120, after: 120 }
  )
);
children.push(
  p(
    "Stretch later: NHL / Hockey is not on the launch picker yet, but profile trophies and career rings must support any sport_id so an NHL championship plaque can sit next to NFL on the same profile when you add it.",
    { size: 20, after: 200 }
  )
);

// 3
children.push(h1("3. Architecture: one app, sport packs"));
children.push(h2("3.1 Shared core (never fork the app)"));
[
  "Auth, leagues, memberships, divisions, join codes, capacity",
  "Profiles, avatars, join-order titles, PlayerLink",
  "Gazette (crown / shame / milk carton / standings drama)",
  "Locker Room, announcements, moderation, deputies",
  "Badge shelves, tiers, career cheevo bank, season cheevo, celebrations",
  "Trophy Room engraving (commissioner-only), pass commissioner",
  "First and Final, Elite Commish, game-creator legendary",
  "Rules, onboarding modals, My Picks UX shell",
  "Nav, Account multi-league switch",
].forEach((t) => children.push(bullet(t)));

children.push(h2("3.2 Sport pack interface (per sport)"));
[
  "sport_id, display name, emoji/icon, sort order for create-league picker",
  "Season calendar (weeks / rounds / race weekends / matchdays)",
  "Card builder: how games/events are listed and published",
  "Markets: ATS, ML, 1X2, race winner, bracket, props",
  "Lock rules: first kickoff / first tip / green flag / round freeze",
  "Scoring engine: points for cover, best bet, props, draws, etc.",
  "Odds / schedule provider adapters",
  "Sport-specific badge catalog slice",
  "Sport-specific trophy labels + Crystal Ball wording",
  "Copy/flavor strings (Gazette verbs, rules callouts, empty states)",
  "Optional secondary settings (soccer competition, NASCAR series, Madness year)",
].forEach((t) => children.push(bullet(t, "bullets2")));

children.push(h2("3.3 Data model additions (checklist)"));
[
  "leagues.sport_id (required on create; lock after first scored week)",
  "leagues.sport_settings jsonb (competition, series, season year, week model)",
  "Badge defs: sport_id null = universal; sport_id set = only that sport",
  "league_trophies store or inherit sport_id for profile history",
  "profile_hardware / career_rings: user_id, sport_id, trophy_type, season_year, league_id, title",
  "Career cheevos use unique badge ids per sport (e.g. nfl_perfect_sunday)",
  "Odds/API routes namespaced by sport",
].forEach((t) => children.push(check(t)));

children.push(h2("3.4 Dev workflow"));
children.push(
  p(
    "Build on local Next.js, test a sandbox league, push GitHub main, Vercel deploys. Do not maintain a separate multi-sport codebase. CFB live leagues must keep working while packs land."
  )
);

// 4
children.push(h1("4. Keep the same flavors (non-negotiables)"));
children.push(
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2800, 6560],
    rows: [
      new TableRow({
        children: [
          cell("Flavor", 2800, { header: true }),
          cell("Must stay in every sport", 6560, { header: true }),
        ],
      }),
      new TableRow({
        children: [
          cell("Gazette", 2800, { bold: true, fill: "F1F8F4" }),
          cell(
            "Weekly (or per-unit) paper: crown, shame, milk carton no-locks, deadlock jokes",
            6560
          ),
        ],
      }),
      new TableRow({
        children: [
          cell("Profiles", 2800, { bold: true }),
          cell(
            "Click any name; shelves; join titles; career + season cheevo; sport rings section",
            6560
          ),
        ],
      }),
      new TableRow({
        children: [
          cell("Badges", 2800, { bold: true, fill: "F1F8F4" }),
          cell(
            "Common to Legendary tiers; grey locked + how-to; celebrations; First and Final; Elite Commish; creator crown",
            6560
          ),
        ],
      }),
      new TableRow({
        children: [
          cell("Trophy Room", 2800, { bold: true }),
          cell(
            "Commissioner engraves; players view-only; survives season reset; passes with league",
            6560
          ),
        ],
      }),
      new TableRow({
        children: [
          cell("Lock culture", 2800, { bold: true, fill: "F1F8F4" }),
          cell(
            "Clear deadline; whole-card freeze at first event on slate (adapt wording per sport)",
            6560
          ),
        ],
      }),
      new TableRow({
        children: [
          cell("Career flex", 2800, { bold: true }),
          cell(
            "Career cheevo bank + multi-sport hardware on profile (NFL ring + hockey plaque)",
            6560
          ),
        ],
      }),
      new TableRow({
        children: [
          cell("Commish tools", 2800, { bold: true, fill: "F1F8F4" }),
          cell(
            "Card, results, deputies, reset season, pass commissioner",
            6560
          ),
        ],
      }),
      new TableRow({
        children: [
          cell("Social glue", 2800, { bold: true }),
          cell(
            "Locker, roast tone, Bottom Feeder join titles, YOU highlights",
            6560
          ),
        ],
      }),
    ],
  })
);

// 5
children.push(h1("5. Master checklist — every sport pack"));
children.push(
  p(
    "Copy this checklist for each sport. Do not ship a sport until the Must ship rows are done."
  )
);
children.push(h3("Must ship"));
[
  "Create-league: sport appears in ordered picker; saved on league",
  "League home / Nav labels use sport wording where needed",
  "Season calendar / unit selector works (weeks, rounds, races, matchdays)",
  "Commissioner can build + publish a card for the unit",
  "Players can fully lock (all required legs) before freeze",
  "Lock freeze rule implemented + Rules callout",
  "Results entry + scoring + standings update",
  "Who is locked / milk carton no-lock names",
  "Gazette generation with sport-neutral structure + sport verbs",
  "Crystal Ball (or sport equivalent) optional pride pick",
  "Trophy Room types labeled for sport; commissioner engrave only",
  "At least 8-12 sport-specific badges (mix of tiers) + progress where possible",
  "Universal badges still apply (recruit, face of franchise, First and Final, etc.)",
  "Profile shows sport-tagged earned badges and hardware",
  "Season reset keeps Trophy Room + career banks",
  "Sandbox / demo slate path for testing without live odds",
  "Rules page section for this sport lock + scoring",
  "QA: new league of this sport end-to-end for one full unit",
].forEach((t) => children.push(check(t, "checks2")));

children.push(h3("Should ship soon after"));
[
  "Real odds/schedule provider wired",
  "Reminders / nudge picks copy",
  "Sport-themed empty states and home taglines",
  "Power rankings / stats pages still make sense",
  "Brackets or playoff sub-mode if applicable",
].forEach((t) => children.push(check(t, "checks3")));

children.push(h3("Profile multi-sport hardware (global project)"));
[
  "Profile section: Rings and Hardware grid by sport",
  "Each engraved championship (and optional toilet/nerd) writes a career ring for the winner user_id",
  "Player can display NFL Championship 2026 + CFB Championship 2025 + future NHL Cup on one profile",
  "Hardware is permanent; leaving a league does not strip rings",
].forEach((t) => children.push(check(t, "checks4")));

// 6
children.push(h1("6. Per-sport build sheets"));
children.push(
  p(
    "Detail sheets in picker order. CFB is migration; NFL is first net-new after pack architecture."
  )
);

for (const s of sports) {
  children.push(h2(s.order + ". " + s.name + "  (" + s.id + ")"));
  const fields = [
    ["Season shape", s.season],
    ["Card unit", s.unit],
    ["Lock rule", s.lock],
    ["Pick markets", s.pickMode],
    ["Lines / data", s.lines],
    ["Calendar notes", s.calendar],
    ["Crystal Ball", s.crystal],
    ["Trophy labels", s.trophies],
    ["Badge ideas", s.badges],
    ["War Room flavor", s.flavor],
    ["Hard parts", s.hard],
  ];
  for (const [a, b] of fields) {
    children.push(twoCol(a, b));
    children.push(spacer());
  }
  children.push(p("Sport-specific checklist", { bold: true, size: 20, after: 60 }));
  [
    "Sport pack module scaffolded (id, labels, calendar, scoring hooks)",
    "Create-league option live in correct sort position",
    "Card + lock + score path green in sandbox",
    "Sport badge pack added; celebrations work",
    "Trophy meta strings + Crystal Ball copy",
    "Rules blurb",
    "Profile hardware test: engrave champ, ring on winner profile with sport tag",
    "Does not break CFB (or other) leagues",
  ].forEach((t) => children.push(check(t, "s" + s.order)));
}

// 7
children.push(h1("7. Achievements board strategy"));
children.push(h2("7.1 Layers"));
[
  "Universal — any sport (War Room Recruit, Face of the Franchise, First and Final, Cheevo King, Elite Commish, game creator legendary).",
  "Sport pack — only evaluated in leagues of that sport (e.g. Perfect Sunday for NFL, Draw Merchant for soccer).",
  "Career hardware — engraved trophies become permanent profile rings tagged by sport + year.",
].forEach((t) => children.push(bullet(t, "bullets3")));

children.push(h2("7.2 Badge ID convention"));
children.push(
  p(
    "Use prefixed ids so catalogs never collide: nfl_perfect_sunday, cfb_immortal_streak, nba_clutch_ot, mm_twelve_seed, nascar_green_flag_lock, mlb_extra_innings, soccer_draw_merchant."
  )
);
children.push(
  p(
    "Shelf UI: show this league sport + universal. Optional profile toggle: All sports | This sport."
  )
);

children.push(h2("7.3 Points"));
children.push(
  p(
    "Keep tier points (common 10 / rare 25 / epic 50 / legendary 150-250). Creator legendary stays career-only. Season cheevo is per-league-season; career bank is global across sports (true lifetime flex)."
  )
);

children.push(h2("7.4 Championship on profile (your example)"));
[
  "Commissioner engraves NFL Championship for 2026 — winner gets ring card: sport=nfl, type=championship, year=2026, league name snapshot.",
  "Same user later wins CFB or future hockey league — second ring on same profile.",
  "Toilet Bowl and Crystal Ball awards can also mint anti-hardware or pride plaques if you want the full joke set.",
  "Rings are separate from season cheevo points unless you also define a linked badge.",
].forEach((t) => children.push(bullet(t, "bullets4")));

// 8
children.push(h1("8. Recommended build phases"));
children.push(
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1600, 3200, 4560],
    rows: [
      new TableRow({
        children: [
          cell("Phase", 1600, { header: true }),
          cell("Focus", 3200, { header: true }),
          cell("Exit criteria", 4560, { header: true }),
        ],
      }),
      new TableRow({
        children: [
          cell("0", 1600, { bold: true, fill: "E8F5E9" }),
          cell("Sport-pack architecture", 3200, { fill: "E8F5E9" }),
          cell(
            "CFB runs as pack; leagues.sport_id; no user-facing multi-sport yet",
            4560,
            { fill: "E8F5E9" }
          ),
        ],
      }),
      new TableRow({
        children: [
          cell("1", 1600, { bold: true }),
          cell("Profile hardware + career rings", 3200),
          cell(
            "Engraved trophies appear on winner profiles by sport",
            4560
          ),
        ],
      }),
      new TableRow({
        children: [
          cell("2", 1600, { bold: true, fill: "E8F5E9" }),
          cell("Create-league sport picker UI", 3200, { fill: "E8F5E9" }),
          cell(
            "Ordered list; CFB default; others Coming soon until ready",
            4560,
            { fill: "E8F5E9" }
          ),
        ],
      }),
      new TableRow({
        children: [
          cell("3", 1600, { bold: true }),
          cell("NFL pack", 3200),
          cell("Full friend-league season viable", 4560),
        ],
      }),
      new TableRow({
        children: [
          cell("4", 1600, { bold: true, fill: "E8F5E9" }),
          cell("NBA pack", 3200, { fill: "E8F5E9" }),
          cell("Weekly card model proven", 4560, { fill: "E8F5E9" }),
        ],
      }),
      new TableRow({
        children: [
          cell("5", 1600, { bold: true }),
          cell("March Madness event mode", 3200),
          cell("One March run with friends", 4560),
        ],
      }),
      new TableRow({
        children: [
          cell("6", 1600, { bold: true, fill: "E8F5E9" }),
          cell("MLB + Soccer packs", 3200, { fill: "E8F5E9" }),
          cell("Long season + 1X2 patterns", 4560, { fill: "E8F5E9" }),
        ],
      }),
      new TableRow({
        children: [
          cell("7", 1600, { bold: true }),
          cell("NASCAR pack", 3200),
          cell("Non-spread card UX solid", 4560),
        ],
      }),
      new TableRow({
        children: [
          cell("8", 1600, { bold: true, fill: "E8F5E9" }),
          cell("NHL / more sports", 3200, { fill: "E8F5E9" }),
          cell(
            "Same checklist; rings already support sport_id",
            4560,
            { fill: "E8F5E9" }
          ),
        ],
      }),
    ],
  })
);

// 9
children.push(h1("9. Risks and guardrails"));
[
  "Do not hardcode CFB strings in shared components — centralize copy in pack + shared dictionary.",
  "Never let a half-ready sport appear as fully selectable without Coming soon.",
  "Odds API costs and rate limits scale with sports — cache aggressively.",
  "Friend burnout: NBA/MLB need weekly cards, not five picks every night unless the league opts in.",
  "Scoring bugs kill trust faster than missing badges — score path before badge flavor.",
  "Keep commissioner engraving sacred; auto-trophy only when logic is airtight.",
].forEach((t) => children.push(bullet(t, "bullets5")));

// 10
children.push(h1("10. Immediate next steps (when you greenlight build)"));
[
  "Add leagues.sport_id + sport_settings in Supabase; default existing leagues to cfb.",
  "Extract CFB calendar, odds route, scoring assumptions into src/sports/cfb/.",
  "Define SportPack TypeScript interface.",
  "Design profile Rings and Hardware UI.",
  "Ship create-league sport picker with CFB live and others disabled as Coming soon (in your order).",
  "Then open NFL pack as first net-new sport.",
].forEach((t) => children.push(check(t, "next")));

// 11
children.push(h1("11. Closing principle"));
children.push(
  p(
    "Every sport should feel like War Room first and the sport second. If a pack ships without Gazette energy, lock culture, profile flex, and commissioner theater, it is not done — even if the spreads are correct.",
    { italics: true, after: 200 }
  )
);
children.push(
  p(
    "This document lives in the game docs folder so the roadmap stays next to the code. Update checklists as packs ship.",
    { size: 18, color: "666666" }
  )
);

const checkRefs = sports.map((s) => ({
  reference: "s" + s.order,
  levels: [
    {
      level: 0,
      format: LevelFormat.BULLET,
      text: "☐",
      alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720, hanging: 360 } } },
    },
  ],
}));

const bulletLevel = (ref) => ({
  reference: ref,
  levels: [
    {
      level: 0,
      format: LevelFormat.BULLET,
      text: "•",
      alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720, hanging: 360 } } },
    },
  ],
});

const checkLevel = (ref) => ({
  reference: ref,
  levels: [
    {
      level: 0,
      format: LevelFormat.BULLET,
      text: "☐",
      alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720, hanging: 360 } } },
    },
  ],
});

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 32, bold: true, font: "Arial", color: "111111" },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 },
      },
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 26, bold: true, font: "Arial", color: "1a1a1a" },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 },
      },
      {
        id: "Heading3",
        name: "Heading 3",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: "333333" },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 },
      },
    ],
  },
  numbering: {
    config: [
      bulletLevel("bullets"),
      bulletLevel("bullets2"),
      bulletLevel("bullets3"),
      bulletLevel("bullets4"),
      bulletLevel("bullets5"),
      checkLevel("checks"),
      checkLevel("checks2"),
      checkLevel("checks3"),
      checkLevel("checks4"),
      checkLevel("next"),
      ...checkRefs,
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "War Room Pick'em  ·  Multi-Sport Expansion Plan",
                  font: "Arial",
                  size: 16,
                  color: "666666",
                }),
              ],
              border: {
                bottom: {
                  style: BorderStyle.SINGLE,
                  size: 6,
                  color: "2D6A4F",
                  space: 4,
                },
              },
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({
                  text: "Page ",
                  font: "Arial",
                  size: 16,
                  color: "888888",
                }),
                new TextRun({
                  children: [PageNumber.CURRENT],
                  font: "Arial",
                  size: 16,
                  color: "888888",
                }),
              ],
            }),
          ],
        }),
      },
      children,
    },
  ],
});

const outPath = new URL("./War-Room-Multi-Sport-Expansion-Plan.docx", import.meta.url);
const buf = await Packer.toBuffer(doc);
fs.writeFileSync(outPath, buf);
console.log("Wrote", outPath.pathname, buf.length, "bytes");
