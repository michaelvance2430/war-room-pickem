/**
 * Easter eggs — Founder Binder law
 * --------------------------------
 * Discoverable, not announced. Never in a “Secret Stuff” menu.
 * NEVER: points · standings impact · competitive advantage · payment.
 * ONLY: curiosity, loyalty, joy — “…did you know…” moments.
 *
 * ACCOUNT-WIDE (not sport-specific): one find sticks across CFB, NFL, every pack.
 * Discover while playing any sport. Rare sport-tied moments are the exception,
 * not the rule — we don’t force multi-sport homework for the catalog.
 *
 * Milestone flexes (7 / 10 / full) are PLATFORM-WIDE newspapers — every player
 * in every league sees them. Ready Player One energy.
 *
 * Discoveries are separate from season/career cheevo scoring (always 0 pts).
 */

export const EVENT_EASTER_EGG = "warroom-easter-egg";
export const EVENT_PASSPORT_STAMP = "warroom-passport-stamp";

/** Acrostic across twelve weeks — Type 11 */
export const GAZETTE_SECRET_PHRASE = "NEVER GIVE UP";

export type DiscoveryKind =
  | "anniversary"
  | "secret_tap"
  | "hidden_headline"
  | "leap_day"
  | "birthday"
  | "rivalry"
  | "perfect_timing"
  | "streak"
  | "holiday"
  | "championship_repeat"
  | "secret_code"
  | "developer_tribute"
  | "impossible"
  | "mascot"
  | "veteran"
  | "passport"
  | "welcome_home";

export type DiscoveryDef = {
  id: string;
  name: string;
  /** Short blurb when they open it later */
  description: string;
  /** Shown only after earn — never a how-to farm guide for competitive eggs */
  flavor: string;
  kind: DiscoveryKind;
  icon: string;
  /** Passport stamp label (optional) */
  stampLabel?: string;
};

/** Zero-point discovery catalog — not cheevo banked */
export const DISCOVERY_CATALOG: DiscoveryDef[] = [
  {
    id: "egg_anniversary",
    name: "One Year of Bad Picks",
    description: "You came back for another season of feelings.",
    flavor: "Confetti. A Gazette that knew your name. No points. Just history.",
    kind: "anniversary",
    icon: "🎉",
    stampLabel: "Year one",
  },
  {
    id: "egg_curiosity_trophy",
    name: "Curiosity Didn't Kill the Cat",
    description: "You tapped the hardware until it spun.",
    flavor: "Five taps in a row. One spin. Zero competitive edge.",
    kind: "secret_tap",
    icon: "🏆",
    stampLabel: "Curious hands",
  },
  {
    id: "egg_hidden_headline",
    name: "Ink Stain",
    description: "You caught a Gazette that shouldn't exist.",
    flavor: "Local Commissioner Still Blaming Referees — and worse.",
    kind: "hidden_headline",
    icon: "📰",
    stampLabel: "Extra absurd",
  },
  {
    id: "egg_leap_day",
    name: "Time Traveler",
    description: "Opened War Room on February 29.",
    flavor: "One day every four years. The calendar winked.",
    kind: "leap_day",
    icon: "🌍",
    stampLabel: "Leap",
  },
  {
    id: "egg_birthday",
    name: "Local Legend Aged Up",
    description: "The paper noticed your birthday.",
    flavor: "BREAKING: somehow got older. Still locking bad sides.",
    kind: "birthday",
    icon: "🎂",
    stampLabel: "Birthday",
  },
  {
    id: "egg_sibling_supremacy",
    name: "Sibling Supremacy",
    description: "Ten seasons above the same last-name rival.",
    flavor: "Nobody published the rulebook. The room just knows.",
    kind: "rivalry",
    icon: "🩸",
    stampLabel: "Blood sport",
  },
  {
    id: "egg_lucky_seven",
    name: "Lucky Seven",
    description: "Locked a card at 7:07:07.",
    flavor: "Perfect timing. Zero standings help. Infinite smug.",
    kind: "perfect_timing",
    icon: "7️⃣",
    stampLabel: "7:07:07",
  },
  {
    id: "egg_obsession",
    name: "Authorities Concerned",
    description: "365 consecutive days in the War Room.",
    flavor: "Not a popup farm. A Gazette roast. Touch grass (optional).",
    kind: "streak",
    icon: "🕵️",
    stampLabel: "Daily",
  },
  {
    id: "egg_halloween",
    name: "Boo!",
    description: "Opened the room on Halloween.",
    flavor: "Pumpkins optional. Courage mandatory.",
    kind: "holiday",
    icon: "👻",
    stampLabel: "Halloween",
  },
  {
    id: "egg_christmas",
    name: "Candy Cane Edition",
    description: "Opened the room on Christmas Day.",
    flavor: "Borders got festive. Dignity did not.",
    kind: "holiday",
    icon: "🎄",
    stampLabel: "Christmas",
  },
  {
    id: "egg_thanksgiving",
    name: "Gravy Boat",
    description: "Opened the room on Thanksgiving.",
    flavor: "Spread thicker than the mashed potatoes.",
    kind: "holiday",
    icon: "🦃",
    stampLabel: "Thanksgiving",
  },
  {
    id: "egg_newyear",
    name: "Resolution Already Broken",
    description: "Opened the room on New Year's Day.",
    flavor: "New year. Same confidence ranking.",
    kind: "holiday",
    icon: "✨",
    stampLabel: "New Year",
  },
  {
    id: "egg_three_peat",
    name: "Dynasty Ink",
    description: "Three straight championship years.",
    flavor: "The ring ceremony changed. People noticed.",
    kind: "championship_repeat",
    icon: "💍",
    stampLabel: "Three-peat",
  },
  {
    id: "egg_never_give_up",
    name: "Never Give Up",
    description: "You assembled the quiet letters in the paper.",
    flavor: "Twelve weeks. One phrase. Community went feral (probably).",
    kind: "secret_code",
    icon: "🔤",
    stampLabel: "Acrostic",
  },
  {
    id: "egg_developer_thanks",
    name: "Believer",
    description: "You saw the one-line thank you.",
    flavor: "No explanation. Just gratitude from the desk.",
    kind: "developer_tribute",
    icon: "🛠️",
    stampLabel: "Thanks",
  },
  {
    id: "egg_impossible",
    name: "???",
    description: "???",
    flavor: "If you're reading this, you already know. Or you don't.",
    kind: "impossible",
    icon: "❓",
    stampLabel: "???",
  },
  {
    id: "egg_mascot_scout",
    name: "Mascot Spotter",
    description: "You found the helmet in the wild.",
    flavor: "One week behind the Gazette. Another on the scoreboard.",
    kind: "mascot",
    icon: "🪖",
    stampLabel: "Sighting",
  },
  {
    id: "egg_veterans",
    name: "The Veterans Have Returned",
    description: "Fifth season energy (and every fifth after).",
    flavor: "Not welcome back. Welcome home to the room that remembers.",
    kind: "veteran",
    icon: "🫡",
    stampLabel: "Veteran",
  },
  {
    id: "egg_welcome_home",
    name: "Welcome Home",
    description: "A decade in the War Room.",
    flavor:
      "No achievement pad. No purchase. Just: thank you for building this community.",
    kind: "welcome_home",
    icon: "🏠",
    stampLabel: "Decade",
  },
  // Passport event stamps (silent collection)
  {
    id: "stamp_cfb_season",
    name: "Campus Fall",
    description: "A college football season in the book.",
    flavor: "Nobody told you to collect these.",
    kind: "passport",
    icon: "🏈",
    stampLabel: "CFB",
  },
  {
    id: "stamp_nfl_season",
    name: "Sunday Desk",
    description: "A pro football season in the book.",
    flavor: "Late window. Long memory.",
    kind: "passport",
    icon: "📺",
    stampLabel: "NFL",
  },
  {
    id: "stamp_wwc",
    name: "World Cup Visa",
    description: "Tournament energy, passport realness.",
    flavor: "Emerald heat. Gold ink.",
    kind: "passport",
    icon: "🌍",
    stampLabel: "WWC",
  },
];

export type EarnedDiscovery = {
  id: string;
  earnedAt: string;
  /** Optional context (year, headline, etc.) */
  note?: string;
};

export type EasterEggMoment = {
  id: string;
  title: string;
  body: string;
  icon: string;
  /** Full-screen confetti / special treatment */
  confetti?: boolean;
  /** Replace home welcome line */
  homeHeadline?: string;
  /** Soft Gazette personal overlay */
  gazetteHeadline?: string;
  gazetteDeck?: string;
};

type PlayerEggState = {
  discoveries: EarnedDiscovery[];
  /** YYYY-MM-DD strings of days the app was opened */
  openDays: string[];
  /** Current consecutive open-day streak */
  openStreak: number;
  lastOpenDay: string | null;
  /** Consecutive trophy taps in the current streak (resets if you pause) */
  trophyTaps: number;
  /** Last championship trophy tap (ms) — for consecutive-window reset */
  lastTrophyTapAt: number | null;
  mascotFinds: string[];
  /** Letters collected toward NEVER GIVE UP (unique week keys) */
  secretLetters: Record<string, string>;
  /** Last year anniversary moment was shown */
  anniversaryShownYear: number | null;
  veteransShownYears: number[];
  welcomeHomeShown: boolean;
  developerThanksYear: number | null;
  /** Optional MM-DD birthday */
  birthdayMmd: string | null;
  /** lastName → consecutive seasons finished above them */
  siblingStreaks: Record<string, number>;
  siblingLastSeasonYear: number | null;
  /** Years we already stamped for sport seasons */
  sportSeasonStamps: string[];
  /** Three-peat already celebrated */
  threePeatNoted: boolean;
  /** Obsession already celebrated */
  obsessionNoted: boolean;
};

const STORE_KEY = "warroom-easter-eggs-v1";

function canStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function emptyState(): PlayerEggState {
  return {
    discoveries: [],
    openDays: [],
    openStreak: 0,
    lastOpenDay: null,
    trophyTaps: 0,
    lastTrophyTapAt: null,
    mascotFinds: [],
    secretLetters: {},
    anniversaryShownYear: null,
    veteransShownYears: [],
    welcomeHomeShown: false,
    developerThanksYear: null,
    birthdayMmd: null,
    siblingStreaks: {},
    siblingLastSeasonYear: null,
    sportSeasonStamps: [],
    threePeatNoted: false,
    obsessionNoted: false,
  };
}

function readAll(): Record<string, PlayerEggState> {
  if (!canStorage()) return {};
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, PlayerEggState>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, PlayerEggState>) {
  if (!canStorage()) return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function getEggState(playerId: string): PlayerEggState {
  if (!playerId) return emptyState();
  const map = readAll();
  return { ...emptyState(), ...(map[playerId] || {}) };
}

function saveEggState(playerId: string, state: PlayerEggState) {
  if (!playerId) return;
  const map = readAll();
  map[playerId] = state;
  writeAll(map);
}

export function getDiscoveryDef(id: string): DiscoveryDef | undefined {
  return DISCOVERY_CATALOG.find((d) => d.id === id);
}

export function listEarnedDiscoveries(playerId: string): EarnedDiscovery[] {
  return getEggState(playerId).discoveries;
}

export function hasDiscovery(playerId: string, id: string): boolean {
  return getEggState(playerId).discoveries.some((d) => d.id === id);
}

/**
 * True egg catalog (not silent sport passport stamps).
 * Profile tracker shows “found / xx” — never the real total (no spoiler map).
 */
export function listEasterEggDefs(): DiscoveryDef[] {
  return DISCOVERY_CATALOG.filter(
    (d) => d.kind !== "passport" && d.id.startsWith("egg_")
  );
}

export function getEasterEggProgress(playerId: string): {
  found: number;
  /** Catalog size — internal only; UI should show "xx" not this number */
  total: number;
  /** True once they've found at least one real egg — safe to show the counter */
  unlocked: boolean;
  /** Public display e.g. "3 / xx" — never leaks catalog size */
  display: string;
} {
  const catalog = listEasterEggDefs();
  const total = catalog.length;
  if (!playerId) return { found: 0, total, unlocked: false, display: "0 / xx" };
  const earned = new Set(listEarnedDiscoveries(playerId).map((d) => d.id));
  let perm: string[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getPermanentBadgeIds } = require("./permanent-badges") as typeof import("./permanent-badges");
    perm = getPermanentBadgeIds(playerId);
  } catch {
    /* local only */
  }
  let found = 0;
  for (const d of catalog) {
    if (earned.has(d.id) || perm.includes(d.id)) found += 1;
  }
  return {
    found,
    total,
    unlocked: found > 0,
    display: `${found} / xx`,
  };
}

function emitMoment(moment: EasterEggMoment) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent(EVENT_EASTER_EGG, { detail: moment })
    );
  } catch {
    /* ignore */
  }
}

/** Grant discovery if new. Never awards pick'em points. Cloud + badge shelf. */
export function grantDiscovery(
  playerId: string,
  discoveryId: string,
  opts?: { note?: string; silent?: boolean; moment?: Partial<EasterEggMoment> }
): boolean {
  if (!playerId || !discoveryId) return false;
  const def = getDiscoveryDef(discoveryId);
  if (!def) return false;
  const state = getEggState(playerId);
  if (state.discoveries.some((d) => d.id === discoveryId)) return false;
  state.discoveries = [
    ...state.discoveries,
    {
      id: discoveryId,
      earnedAt: new Date().toISOString(),
      note: opts?.note,
    },
  ];
  saveEggState(playerId, state);

  // Permanent badge so it shows on the shelf like other achievements
  if (discoveryId.startsWith("egg_")) {
    try {
      const { grantPermanentBadgeId } = require("./permanent-badges") as typeof import("./permanent-badges");
      grantPermanentBadgeId(playerId, discoveryId);
    } catch {
      /* ignore */
    }
    // Cloud + maybe Ready Player One flex (7 / 10 / full)
    try {
      const { getSession } = require("./league") as typeof import("./league");
      const name =
        getSession()?.playerName ||
        opts?.note ||
        "A player";
      void import("./egg-cloud").then(({ syncEasterEggFindToCloud }) => {
        void syncEasterEggFindToCloud({
          discoveryId,
          playerName: name,
        }).then((res) => {
          if (res.flexesInserted && res.flexesInserted > 0) {
            try {
              window.dispatchEvent(
                new CustomEvent("warroom-egg-flex-check", {
                  detail: res,
                })
              );
            } catch {
              /* ignore */
            }
          }
        });
      });
    } catch {
      /* ignore */
    }
  }

  if (!opts?.silent) {
    emitMoment({
      id: discoveryId,
      title: def.name,
      body: opts?.moment?.body || def.flavor,
      icon: def.icon,
      confetti: opts?.moment?.confetti,
      homeHeadline: opts?.moment?.homeHeadline,
      gazetteHeadline: opts?.moment?.gazetteHeadline,
      gazetteDeck: opts?.moment?.gazetteDeck,
    });
  }
  try {
    window.dispatchEvent(
      new CustomEvent(EVENT_PASSPORT_STAMP, {
        detail: { playerId, discoveryId },
      })
    );
  } catch {
    /* ignore */
  }
  return true;
}

export function setPlayerBirthday(playerId: string, mmdd: string | null) {
  if (!playerId) return;
  const state = getEggState(playerId);
  // Accept MM-DD only
  if (mmdd && !/^\d{2}-\d{2}$/.test(mmdd)) return;
  state.birthdayMmd = mmdd;
  saveEggState(playerId, state);
}

export function getPlayerBirthday(playerId: string): string | null {
  return getEggState(playerId).birthdayMmd;
}

function dayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function mmdd(d = new Date()): string {
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yearsSince(iso: string | null | undefined, now = new Date()): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 0;
  const ms = now.getTime() - t;
  return Math.max(0, ms / (365.25 * 24 * 60 * 60 * 1000));
}

function isLeapDay(d = new Date()) {
  return d.getMonth() === 1 && d.getDate() === 29;
}

function isHalloween(d = new Date()) {
  return d.getMonth() === 9 && d.getDate() === 31;
}
function isChristmas(d = new Date()) {
  return d.getMonth() === 11 && d.getDate() === 25;
}
function isThanksgivingUS(d = new Date()) {
  // 4th Thursday of November
  if (d.getMonth() !== 10) return false;
  const first = new Date(d.getFullYear(), 10, 1);
  const firstThu = 1 + ((11 - first.getDay() + 7) % 7);
  const fourth = firstThu + 21;
  return d.getDate() === fourth;
}
function isNewYearsDay(d = new Date()) {
  return d.getMonth() === 0 && d.getDate() === 1;
}

/** Deterministic “random” day-of-year for developer tribute (stable per year). */
function developerTributeDayOfYear(year: number): number {
  // Spread 40–320 so not on holidays clutter
  return 40 + ((year * 47) % 280);
}

function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86400000);
}

/** Rare absurd Gazette headlines — Type 3 */
export const RARE_GAZETTE_HEADLINES: { headline: string; deck: string }[] = [
  {
    headline: "Local Commissioner Still Blaming Referees",
    deck: "Sources confirm the spread was the real problem.",
  },
  {
    headline: "Area Man Convinced This Is His Year",
    deck: "Historical data unavailable for comment. Dignity declined interview.",
  },
  {
    headline: "Group Chat Declares Martial Law After Week Scores",
    deck: "No injuries reported. Several egos listed as day-to-day.",
  },
  {
    headline: "Scientists Baffled by Confidence Ranking Choices",
    deck: "Peer review suggested 'touch grass.' Peer was muted.",
  },
  {
    headline: "War Room Printer Jams Itself Out of Mercy",
    deck: "Ink cites 'emotional labor.' Paper files for asylum.",
  },
  {
    headline: "Breaking: Someone's Uncle Has a Lock",
    deck: "The uncle was wrong. The legend continues.",
  },
  {
    headline: "League Votes to Ban Vibes-Based Analytics",
    deck: "Measure fails 1–11. The vibe lobby celebrates.",
  },
];

/** ~4% of editions get a rare absurd line (stable per league+week). */
export function pickRareGazetteLine(
  leagueId: string,
  weekIndex: number
): { headline: string; deck: string } | null {
  const seed = `${leagueId || "x"}:w${weekIndex}:rare`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  if (h % 25 !== 0) return null; // ~4%
  return RARE_GAZETTE_HEADLINES[h % RARE_GAZETTE_HEADLINES.length];
}

/** Secret letter for week — cycles NEVER GIVE UP */
export function gazetteSecretLetterForWeek(weekIndex: number): string {
  const phrase = GAZETTE_SECRET_PHRASE.replace(/\s/g, "");
  return phrase[Math.abs(weekIndex) % phrase.length] || "N";
}

/**
 * Record opening the app — streaks, holidays, anniversary, veterans, decade, tribute.
 * Call once per session from EasterEggHost.
 */
export function noteAppOpen(opts: {
  playerId: string;
  memberSince?: string | null;
  sportId?: string | null;
  seasonYear?: number | null;
}): EasterEggMoment[] {
  const { playerId, memberSince, sportId, seasonYear } = opts;
  if (!playerId) return [];
  const moments: EasterEggMoment[] = [];
  const now = new Date();
  const today = dayKey(now);
  const state = getEggState(playerId);

  // Open-day streak
  if (state.lastOpenDay !== today) {
    if (state.lastOpenDay) {
      const prev = new Date(state.lastOpenDay + "T12:00:00");
      const diff = Math.round(
        (now.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000)
      );
      state.openStreak = diff === 1 ? state.openStreak + 1 : 1;
    } else {
      state.openStreak = 1;
    }
    state.lastOpenDay = today;
    if (!state.openDays.includes(today)) {
      state.openDays = [...state.openDays.slice(-400), today];
    }
  }

  // Persist open/meta progress BEFORE grants (grants re-read storage)
  saveEggState(playerId, state);

  const tryGrant = (
    id: string,
    moment: EasterEggMoment
  ): void => {
    if (grantDiscovery(playerId, id, { silent: true })) {
      moments.push(moment);
    }
  };

  // Holidays
  if (isLeapDay(now)) {
    tryGrant("egg_leap_day", {
      id: "egg_leap_day",
      title: "Time Traveler",
      body: "February 29. The calendar let you in early.",
      icon: "🌍",
    });
  }
  if (isHalloween(now)) {
    tryGrant("egg_halloween", {
      id: "egg_halloween",
      title: "Boo!",
      body: "Halloween in the War Room. Spooky spreads only.",
      icon: "👻",
      confetti: true,
    });
  }
  if (isChristmas(now)) {
    tryGrant("egg_christmas", {
      id: "egg_christmas",
      title: "Candy Cane Edition",
      body: "Merry confidence. The Gazette got festive borders in spirit.",
      icon: "🎄",
      confetti: true,
    });
  }
  if (isThanksgivingUS(now)) {
    tryGrant("egg_thanksgiving", {
      id: "egg_thanksgiving",
      title: "Gravy Boat",
      body: "Thanks for locking. Pass the shame.",
      icon: "🦃",
    });
  }
  if (isNewYearsDay(now)) {
    tryGrant("egg_newyear", {
      id: "egg_newyear",
      title: "Resolution Already Broken",
      body: "New year. Same card. Welcome back.",
      icon: "✨",
      confetti: true,
    });
  }

  // Birthday
  const bday = state.birthdayMmd;
  if (bday && bday === mmdd(now)) {
    tryGrant("egg_birthday", {
      id: "egg_birthday",
      title: "Local Legend Aged Up",
      body: "BREAKING NEWS: somehow got older. Still in the room.",
      icon: "🎂",
      confetti: true,
      gazetteHeadline: "BREAKING NEWS — Local legend somehow got older",
      gazetteDeck: "Cake optional. Confidence ranking not.",
    });
  }

  // Anniversary (member since calendar day, year+)
  if (memberSince) {
    const joined = new Date(memberSince);
    if (Number.isFinite(joined.getTime())) {
      const yrs = yearsSince(memberSince, now);
      const isAnnivDay =
        joined.getMonth() === now.getMonth() &&
        joined.getDate() === now.getDate() &&
        yrs >= 1;
      if (isAnnivDay && state.anniversaryShownYear !== now.getFullYear()) {
        state.anniversaryShownYear = now.getFullYear();
        saveEggState(playerId, { ...getEggState(playerId), anniversaryShownYear: state.anniversaryShownYear });
        tryGrant("egg_anniversary", {
          id: "egg_anniversary",
          title: "ONE YEAR OF BAD PICKS.",
          body:
            yrs >= 2
              ? `${Math.floor(yrs)} years in the War Room. Confetti. No points. Pure loyalty.`
              : "One year. Confetti. The Gazette already wrote the headline.",
          icon: "🎉",
          confetti: true,
          homeHeadline: "ONE YEAR OF BAD PICKS.",
          gazetteHeadline: "ONE YEAR OF BAD PICKS.",
          gazetteDeck: "Anniversary edition. Dignity not included.",
        });
      }

      const fullYears = Math.floor(yrs);
      if (fullYears > 0 && fullYears % 5 === 0 && fullYears < 10) {
        if (!state.veteransShownYears.includes(fullYears)) {
          const annivThisYear = new Date(
            now.getFullYear(),
            joined.getMonth(),
            joined.getDate()
          );
          const delta = Math.abs(now.getTime() - annivThisYear.getTime());
          if (delta < 8 * 86400000) {
            state.veteransShownYears = [...state.veteransShownYears, fullYears];
            saveEggState(playerId, {
              ...getEggState(playerId),
              veteransShownYears: state.veteransShownYears,
            });
            tryGrant("egg_veterans", {
              id: "egg_veterans",
              title: "The veterans have returned to the War Room.",
              body: `Season ${fullYears + 1} energy. Small. Powerful.`,
              icon: "🫡",
              confetti: true,
              homeHeadline: "The veterans have returned to the War Room.",
            });
          }
        }
      }

      if (fullYears >= 10 && !state.welcomeHomeShown) {
        state.welcomeHomeShown = true;
        saveEggState(playerId, {
          ...getEggState(playerId),
          welcomeHomeShown: true,
        });
        tryGrant("egg_welcome_home", {
          id: "egg_welcome_home",
          title: "WELCOME HOME.",
          body: "You've been part of War Room since the beginning. Thank you for helping build this community.",
          icon: "🏠",
          confetti: true,
          homeHeadline: "WELCOME HOME.",
          gazetteHeadline: "WELCOME HOME.",
          gazetteDeck:
            "You've been part of War Room since the beginning. Thank you for helping build this community.",
        });
      }
    }
  }

  // 365-day streak
  if (state.openStreak >= 365 && !state.obsessionNoted) {
    state.obsessionNoted = true;
    saveEggState(playerId, {
      ...getEggState(playerId),
      obsessionNoted: true,
    });
    tryGrant("egg_obsession", {
      id: "egg_obsession",
      title: "Authorities Concerned About Obsession",
      body: "365 consecutive days. The Gazette printed it. Touch grass optional.",
      icon: "🕵️",
      gazetteHeadline: "Authorities Concerned About Obsession",
      gazetteDeck: "Subject has opened War Room every day for a year.",
    });
  }

  // Developer tribute — one deterministic day/year
  const tributeDay = developerTributeDayOfYear(now.getFullYear());
  if (
    dayOfYear(now) === tributeDay &&
    state.developerThanksYear !== now.getFullYear()
  ) {
    state.developerThanksYear = now.getFullYear();
    saveEggState(playerId, {
      ...getEggState(playerId),
      developerThanksYear: state.developerThanksYear,
    });
    tryGrant("egg_developer_thanks", {
      id: "egg_developer_thanks",
      title: "Thanks for believing in War Room.",
      body: "No explanation. Just the desk saying it once this year.",
      icon: "🛠️",
      gazetteHeadline: "Thanks for believing in War Room.",
      gazetteDeck: "— The desk",
    });
  }

  // Silent sport passport stamps (once per sport per season year)
  const y = seasonYear || now.getFullYear();
  if (sportId === "cfb") {
    const key = `cfb:${y}`;
    if (!state.sportSeasonStamps.includes(key)) {
      state.sportSeasonStamps = [...state.sportSeasonStamps, key];
      saveEggState(playerId, {
        ...getEggState(playerId),
        sportSeasonStamps: state.sportSeasonStamps,
      });
      grantDiscovery(playerId, "stamp_cfb_season", { silent: true });
    }
  } else if (sportId === "nfl") {
    const key = `nfl:${y}`;
    if (!state.sportSeasonStamps.includes(key)) {
      state.sportSeasonStamps = [...state.sportSeasonStamps, key];
      saveEggState(playerId, {
        ...getEggState(playerId),
        sportSeasonStamps: state.sportSeasonStamps,
      });
      grantDiscovery(playerId, "stamp_nfl_season", { silent: true });
    }
  } else if (sportId === "soccer_wwc") {
    const key = `wwc:${y}`;
    if (!state.sportSeasonStamps.includes(key)) {
      state.sportSeasonStamps = [...state.sportSeasonStamps, key];
      saveEggState(playerId, {
        ...getEggState(playerId),
        sportSeasonStamps: state.sportSeasonStamps,
      });
      grantDiscovery(playerId, "stamp_wwc", { silent: true });
    }
  }

  return moments;
}

/**
 * Type 2 — championship trophy multi-tap.
 * Must be 5 *consecutive* taps (within ~1.5s of each other).
 * Pausing resets the streak — not a lifetime “5 clicks ever” log.
 */
const TROPHY_TAP_WINDOW_MS = 1500;

export function recordTrophyTap(playerId: string): EasterEggMoment | null {
  if (!playerId) return null;
  const state = getEggState(playerId);
  const now = Date.now();
  const last = state.lastTrophyTapAt ?? 0;
  if (!last || now - last > TROPHY_TAP_WINDOW_MS) {
    state.trophyTaps = 1;
  } else {
    state.trophyTaps = (state.trophyTaps || 0) + 1;
  }
  state.lastTrophyTapAt = now;
  saveEggState(playerId, state);
  if (state.trophyTaps >= 5 && !hasDiscovery(playerId, "egg_curiosity_trophy")) {
    state.trophyTaps = 0;
    state.lastTrophyTapAt = null;
    saveEggState(playerId, state);
    grantDiscovery(playerId, "egg_curiosity_trophy", { silent: true });
    return {
      id: "egg_curiosity_trophy",
      title: "Curiosity Didn't Kill the Cat",
      body: "Five taps in a row. The trophy spun. You found it.",
      icon: "🏆",
      confetti: true,
    };
  }
  return null;
}

export function getTrophyTapCount(playerId: string): number {
  return getEggState(playerId).trophyTaps || 0;
}

/** Type 7 — lock at 7:07:07 local */
export function checkLuckySevenLock(playerId: string, when = new Date()): EasterEggMoment | null {
  if (!playerId) return null;
  if (
    when.getHours() === 7 &&
    when.getMinutes() === 7 &&
    when.getSeconds() === 7
  ) {
    if (grantDiscovery(playerId, "egg_lucky_seven", { silent: true })) {
      return {
        id: "egg_lucky_seven",
        title: "Lucky Seven",
        body: "7:07:07. Perfect timing. Zero points. Maximum mythology.",
        icon: "7️⃣",
        confetti: true,
      };
    }
  }
  return null;
}

/** Type 14 — mascot sightings */
export function recordMascotFind(
  playerId: string,
  locationId: string
): EasterEggMoment | null {
  if (!playerId || !locationId) return null;
  const state = getEggState(playerId);
  if (state.mascotFinds.includes(locationId)) return null;
  state.mascotFinds = [...state.mascotFinds, locationId];
  saveEggState(playerId, state);

  const moments: EasterEggMoment[] = [];
  if (state.mascotFinds.length === 1) {
    grantDiscovery(playerId, "egg_mascot_scout", { silent: true });
    moments.push({
      id: "egg_mascot_scout",
      title: "Mascot Spotter",
      body: "You found the helmet. It will hide again.",
      icon: "🪖",
    });
  }

  // Impossible: find 5 distinct spots
  if (state.mascotFinds.length >= 5 && !hasDiscovery(playerId, "egg_impossible")) {
    grantDiscovery(playerId, "egg_impossible", { silent: true });
    moments.push({
      id: "egg_impossible",
      title: "???",
      body: "???",
      icon: "❓",
      confetti: true,
    });
  }

  return moments[0] || null;
}

export function getMascotFindCount(playerId: string): number {
  return getEggState(playerId).mascotFinds.length;
}

/** Type 11 — collect weekly secret letters */
export function collectGazetteSecretLetter(
  playerId: string,
  weekIndex: number
): EasterEggMoment | null {
  if (!playerId) return null;
  const letter = gazetteSecretLetterForWeek(weekIndex);
  const state = getEggState(playerId);
  const key = `w${weekIndex}`;
  if (!state.secretLetters[key]) {
    state.secretLetters = { ...state.secretLetters, [key]: letter };
    saveEggState(playerId, state);
  }
  const phrase = GAZETTE_SECRET_PHRASE.replace(/\s/g, "");
  const collected = Object.values(state.secretLetters);
  // Need all unique letters in phrase (with multiplicity roughly by having enough weeks)
  const need = phrase.split("");
  const pool = [...collected];
  let ok = true;
  for (const ch of need) {
    const i = pool.indexOf(ch);
    if (i < 0) {
      ok = false;
      break;
    }
    pool.splice(i, 1);
  }
  // Simpler: 12 distinct week keys collected
  if (
    Object.keys(state.secretLetters).length >= phrase.length &&
    !hasDiscovery(playerId, "egg_never_give_up")
  ) {
    grantDiscovery(playerId, "egg_never_give_up", { silent: true });
    return {
      id: "egg_never_give_up",
      title: "Never Give Up",
      body: "The quiet letters spelled it out. You noticed.",
      icon: "🔤",
      confetti: true,
    };
  }
  void ok;
  return null;
}

/** Type 3 — rare headline seen */
export function noteRareHeadlineSeen(playerId: string): void {
  if (!playerId) return;
  grantDiscovery(playerId, "egg_hidden_headline", { silent: true });
}

/**
 * Type 6 — same last-name rival, 10 seasons finished above them.
 * Call with current league peer list + season year when standings exist.
 *
 * Streaks are keyed by `${leagueId}:${rivalUserId}` so:
 * - Room renames don't matter (league UUID, never name)
 * - Beating a rival in room A doesn't pad room B
 * Rival match uses last name for discovery; identity is user id + room id.
 */
export function noteSiblingStandings(opts: {
  playerId: string;
  playerName: string;
  myPoints: number;
  peers: { id: string; name: string; totalPoints: number }[];
  seasonYear: number;
  weeksPlayed: number;
  /** League UUID — required for stable multi-season room tracking */
  leagueId?: string | null;
}): EasterEggMoment | null {
  const {
    playerId,
    playerName,
    myPoints,
    peers,
    seasonYear,
    weeksPlayed,
    leagueId,
  } = opts;
  if (!playerId || weeksPlayed < 8) return null;
  const myLast = lastName(playerName);
  if (!myLast || myLast.length < 3) return null;
  const state = getEggState(playerId);
  // Per-room season stamp so multi-league players get fair credits
  const room = (leagueId || "").trim() || "unknown";
  const seasonStamp = `${room}:${seasonYear}`;
  if (state.siblingLastSeasonYear === seasonYear && !leagueId) return null;
  // Track last stamped room-year in siblingStreaks meta via a reserved key
  const stampedKey = `__stamp__${seasonStamp}`;
  if (state.siblingStreaks[stampedKey]) return null;

  const rivals = peers.filter(
    (p) => p.id !== playerId && lastName(p.name) === myLast
  );
  if (!rivals.length) return null;

  state.siblingLastSeasonYear = seasonYear;
  state.siblingStreaks[stampedKey] = 1;
  for (const r of rivals) {
    // Room UUID + rival user id — never league display name
    const key = `${room}:${r.id}`;
    if (myPoints > r.totalPoints) {
      state.siblingStreaks[key] = (state.siblingStreaks[key] || 0) + 1;
    } else {
      state.siblingStreaks[key] = 0;
    }
    if (
      (state.siblingStreaks[key] || 0) >= 10 &&
      !hasDiscovery(playerId, "egg_sibling_supremacy")
    ) {
      saveEggState(playerId, state);
      grantDiscovery(playerId, "egg_sibling_supremacy", { silent: true });
      return {
        id: "egg_sibling_supremacy",
        title: "Sibling Supremacy",
        body: "Ten seasons above the same last name. The room never said it out loud.",
        icon: "🩸",
        confetti: true,
      };
    }
  }
  saveEggState(playerId, state);
  return null;
}

function lastName(name: string): string {
  const parts = (name || "").trim().split(/\s+/);
  return (parts[parts.length - 1] || "").toLowerCase().replace(/[^a-z]/g, "");
}

/** Type 10 — three consecutive championship years */
export function noteChampionshipYears(
  playerId: string,
  championshipYears: number[]
): EasterEggMoment | null {
  if (!playerId || !championshipYears?.length) return null;
  const years = [...new Set(championshipYears)].sort((a, b) => b - a);
  let streak = 1;
  for (let i = 0; i < years.length - 1; i++) {
    if (years[i] - years[i + 1] === 1) streak++;
    else break;
  }
  const state = getEggState(playerId);
  if (streak >= 3 && !state.threePeatNoted) {
    state.threePeatNoted = true;
    saveEggState(playerId, state);
    grantDiscovery(playerId, "egg_three_peat", { silent: true });
    return {
      id: "egg_three_peat",
      title: "Dynasty Ink",
      body: "Three straight titles. The ring ceremony remembers.",
      icon: "💍",
      confetti: true,
    };
  }
  return null;
}

export function hasThreePeat(playerId: string): boolean {
  return hasDiscovery(playerId, "egg_three_peat");
}

export function consecutiveChampionshipStreak(years: number[]): number {
  if (!years?.length) return 0;
  const sorted = [...new Set(years)].sort((a, b) => b - a);
  let streak = 1;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i] - sorted[i + 1] === 1) streak++;
    else break;
  }
  return streak;
}

/** Passport / discovery shelf rows */
export function getPassportRows(playerId: string): {
  def: DiscoveryDef;
  earned: boolean;
  earnedAt?: string;
}[] {
  const earned = new Map(
    listEarnedDiscoveries(playerId).map((d) => [d.id, d.earnedAt])
  );
  return DISCOVERY_CATALOG.map((def) => ({
    def,
    earned: earned.has(def.id),
    earnedAt: earned.get(def.id),
  }));
}

/** Personal gazette overlay from today's moments / state */
export function getPersonalGazetteOverlay(playerId: string): {
  headline: string;
  deck: string;
} | null {
  if (!playerId) return null;
  const state = getEggState(playerId);
  const now = new Date();
  if (state.birthdayMmd && state.birthdayMmd === mmdd(now)) {
    return {
      headline: "BREAKING NEWS — Local legend somehow got older",
      deck: "Cake optional. Confidence ranking not.",
    };
  }
  if (state.openStreak >= 365) {
    return {
      headline: "Authorities Concerned About Obsession",
      deck: "Subject has opened War Room every day for a year.",
    };
  }
  if (
    state.developerThanksYear === now.getFullYear() &&
    dayOfYear(now) === developerTributeDayOfYear(now.getFullYear())
  ) {
    return {
      headline: "Thanks for believing in War Room.",
      deck: "— The desk",
    };
  }
  return null;
}
