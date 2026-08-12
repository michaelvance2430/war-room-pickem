/**
 * War Room Pick’Em platform anniversary — July 25 (founding day).
 * First commit: 2026-07-25. Room-wide Gazette-style drop once per
 * viewer · league · calendar year. Witty, zero points.
 */

import { getLeague, getSession } from "@/lib/league";


/** Git day one — first commit “War Room Pick Em” */
export const WAR_ROOM_FOUNDED_ISO = "2026-07-25";
export const WAR_ROOM_FOUNDED_LABEL = "July 25, 2026";
export const PLATFORM_ANNIV_RITUAL = "War Room Anniversary";

/**
 * ROADMAP — Anniversary participation reward (not shipped yet)
 * ---------------------------------------------------------
 * Intent: anyone who plays during the anniversary window (July 25 ET,
 * possibly ± a few days) earns a room-wide / account-wide flex —
 * badge, border, title, or hardware stamp — for showing up on founding day.
 *
 * Design when we build it:
 *  - Opt-in by activity (lock a card, open the app in a league, score, etc.)
 *  - Every participant, not pay-to-win
 *  - Distinct from the annual paper (this file) and from personal join eggs
 *  - Career-safe (survives season reset / sandbox wipe rules as appropriate)
 *
 * Hook later from: isPlatformAnniversaryDay / participation mark on lock.
 */
export const ANNIVERSARY_PLAY_REWARD_PLANNED = true as const;

const SEEN_PREFIX = "warroom-platform-anniv-seen-v1";
const ET = "America/New_York";

export type PlatformAnniversaryEdition = {
  year: number;
  /** Full years since founding (1 = first anniversary, 2027) */
  yearsAlive: number;
  leagueId: string;
  leagueName: string;
  foundedLabel: string;
  packId: string;
  ritualName: string;
  stamp: string;
  headline: string;
  deck: string;
  body: string;
  classified: string;
  pullQuote: string;
  foot: string;
  toastLine: string;
};

type PackCtx = {
  yearsAlive: number;
  yearWord: string;
  leagueName: string;
  foundedLabel: string;
  calendarYear: number;
};

type PaperPack = {
  id: string;
  stamp: string;
  headline: (c: PackCtx) => string;
  deck: (c: PackCtx) => string;
  body: (c: PackCtx) => string;
  classified: (c: PackCtx) => string;
  pullQuote: (c: PackCtx) => string;
  foot: (c: PackCtx) => string;
  toastLine: (c: PackCtx) => string;
};

const PACKS: PaperPack[] = [
  {
    id: "founding",
    stamp: "ANNIVERSARY EXTRA",
    headline: (c) =>
      c.yearsAlive === 1
        ? `WAR ROOM PICK’EM TURNS ONE — BAD PICKS STILL FREE`
        : `WAR ROOM PICK’EM TURNS ${c.yearsAlive} — STILL NOT A REAL JOB`,
    deck: (c) =>
      `Founded ${c.foundedLabel}. ${c.leagueName} is still arguing about spreads. Progress.`,
    body: (c) =>
      `${c.yearWord} ago somebody thought “what if our group chat had standings?” Today the paper is obligated to notice. No parade. No points. Just ${c.yearsAlive} lap${c.yearsAlive === 1 ? "" : "s"} around the sun of terrible Best Bets.`,
    classified: () =>
      `WANTED: original commit message energy. Last seen July 25, 2026. Reward: nostalgia only.`,
    pullQuote: () =>
      `"I built this so we could lose together with better UI." — Local architect`,
    foot: () =>
      `War Room Anniversary · Zero gifts. Zero dignity. Same room energy forever.`,
    toastLine: (c) =>
      c.yearsAlive === 1
        ? "One year of War Room. Confetti optional. Salt mandatory."
        : `${c.yearsAlive} years of War Room. Still locking late.`,
  },
  {
    id: "obituary",
    stamp: "ANNIVERSARY OBIT",
    headline: () => `HERE LIES PRODUCTIVITY — DIED BUILDING A PICK’EM APP`,
    deck: (c) =>
      `${c.yearWord} later, the corpse still ships features. ${c.leagueName} applauds incorrectly.`,
    body: (c) =>
      `Survived by unfinished props, trial bots, and a Dispatch with trust issues. Cause of death: “one more polish pass.” War Room Pick’Em refuses to stay buried. Happy ${c.yearsAlive}${ordinal(c.yearsAlive)} to the machine.`,
    classified: () =>
      `IN MEMORIAM: free evenings, 2026–present. Donations accepted in locked cards.`,
    pullQuote: () =>
      `"It’s not an addiction. It’s a multi-sport expansion roadmap."`,
    foot: () =>
      `Anniversary desk · Flowers not accepted. Late locks are.`,
    toastLine: (c) =>
      `${c.yearsAlive} years dead inside. App still very alive.`,
  },
  {
    id: "sports",
    stamp: "ANNIVERSARY SPORTS",
    headline: (c) =>
      `BOX SCORE: WAR ROOM ${c.yearsAlive}, RESPONSIBLE ADULTING 0`,
    deck: () =>
      `Final: Bad Takes 47, Sleep Schedule 3. Overtime forever.`,
    body: (c) =>
      `Since ${c.foundedLabel}, this league and every other one has simulated a full emotional season every week. Trophy cases got heavier. Excuses got thinner. ${c.leagueName}: still undefeated at caring too much.`,
    classified: () =>
      `TRADE BAIT: one founding vision. High mileage. Needs cake on July 25.`,
    pullQuote: () =>
      `"We’re focusing on next season." — Said every anniversary since launch`,
    foot: () =>
      `War Room Anniversary · MVP: the people who still show up.`,
    toastLine: (c) =>
      `${c.yearsAlive}-year streak of caring about fake standings.`,
  },
  {
    id: "markets",
    stamp: "ANNIVERSARY MARKETS",
    headline: () => `SALT FUTURES HIT ALL-TIME HIGH ON FOUNDING DAY`,
    deck: (c) =>
      `Investors long drama. Short free time. ${c.leagueName} is a microcap of feelings.`,
    body: (c) =>
      `${c.yearWord} of compounding interest in trash talk. Dividend: One Year Older papers, ring ceremonies, and hardware that outlives your confidence ranking. IPO was July 25, 2026. Still not profitable. Still trading.`,
    classified: () =>
      `IPO ROADSHOW: War Room Pick’Em. Valuation: pure chaos. Buy the rumor, sell the prop.`,
    pullQuote: () =>
      `"Past performance does not guarantee future locks." — Every anniversary pitch deck`,
    foot: () =>
      `Not financial advice. Definitely friendship advice: keep the room open.`,
    toastLine: (c) =>
      `${c.yearsAlive} years of emotional market volatility.`,
  },
  {
    id: "tech",
    stamp: "ANNIVERSARY TECH",
    headline: () => `CHANGELOG: APP.VERSION++ // STILL SHIPPING SARCASM`,
    deck: (c) =>
      `Breaking changes since ${c.foundedLabel}: everything. Rollback: impossible.`,
    body: (c) =>
      `Patch notes for year ${c.yearsAlive}: multi-sport, multi-league trophies, birthday papers, fewer fake Commish buttons, same core bug — you still open it on purpose. Thanks for the QA, ${c.leagueName}.`,
    classified: () =>
      `DEPRECATED: “we’ll only use this for one season.” Migration: lie harder.`,
    pullQuote: () =>
      `"It’s not tech debt. It’s lore." — Engineering, probably`,
    foot: (c) =>
      `Shipped ${c.foundedLabel}–present. Happy uptime.`,
    toastLine: (c) =>
      `v${c.yearsAlive}.0 — salt remains a dependency.`,
  },
  {
    id: "editorial",
    stamp: "ANNIVERSARY OP-ED",
    headline: () => `IN OUR OPINION: THIS SHOULD NOT HAVE WORKED`,
    deck: (c) =>
      `And yet ${c.yearsAlive} year${c.yearsAlive === 1 ? "" : "s"} later, here we are.`,
    body: (c) =>
      `A group-chat pick’em with hardware, The Dispatch, and career flex is objectively unhinged. ${c.leagueName} proves unhinged scales. On this day we celebrate the refusal to touch grass.`,
    classified: () =>
      `LETTERS: “Please add more sports.” We know. We’re already too far in.`,
    pullQuote: () =>
      `"It’s just a website." — Person who has a trophy case`,
    foot: () =>
      `Unsigned. Happy anniversary. Lock something.`,
    toastLine: (c) =>
      `${c.yearsAlive} years of “this should not have worked.”`,
  },
  {
    id: "society",
    stamp: "ANNIVERSARY SOCIETY",
    headline: () => `FOUNDING GALA: NO DRESS CODE, MAXIMUM JUDGMENT`,
    deck: (c) =>
      `${c.leagueName} toasts a product that remembers every lock.`,
    body: (c) =>
      `Champagne is imaginary. Hardware is not. Since ${c.foundedLabel}, the room has collected crowns, toilets, nerds, and alibis. Anniversary protocol: one sincere thank-you, fourteen sarcastic ones.`,
    classified: () =>
      `RSVP: already in the app. Gift table: empty. Vibes: legacy.`,
    pullQuote: () =>
      `"I only came for the paper." — Everyone, every year`,
    foot: () =>
      `Society desk · Happy founding day. Shoes optional.`,
    toastLine: (c) =>
      `${c.yearsAlive} years of judgment with better fonts.`,
  },
  {
    id: "crime",
    stamp: "ANNIVERSARY BLOTTER",
    headline: () => `TIME THEFT AT SCALE — APP STILL AT LARGE`,
    deck: (c) =>
      `${c.yearsAlive} year${c.yearsAlive === 1 ? "" : "s"} of stolen evenings. No leads. Many suspects.`,
    body: (c) =>
      `Suspects include “one more feature,” “quick score check,” and “I’m just looking at the Board.” Founded ${c.foundedLabel}. Still at large in ${c.leagueName} and every other room.`,
    classified: () =>
      `TIP LINE: report unauthorized fun. We will not stop it.`,
    pullQuote: () =>
      `"I can quit anytime." — Member since week one`,
    foot: () =>
      `Case remains open. Happy anniversary, accessories after the fact.`,
    toastLine: (c) =>
      `${c.yearsAlive} years of time theft. Still no plea deal.`,
  },
  {
    id: "weather",
    stamp: "ANNIVERSARY WEATHER",
    headline: () => `FORECAST: HIGH DRAMA, LOW SLEEP, SCATTERED HARDWARE`,
    deck: (c) =>
      `Climate of ${c.leagueName} unchanged since launch: salty with a chance of Dispatch.`,
    body: (c) =>
      `${c.yearWord} of atmospheric pressure every Sunday night. Ring ceremonies, cold opens, One Year Older papers — the full storm system. Anniversary weather: 100% chance of reminiscing about a bug that was “definitely fixed.”`,
    classified: () =>
      `UMBRELLAS useless against push notifications.`,
    pullQuote: () =>
      `"We needed the rain." — Person who locked in the rain`,
    foot: () =>
      `War Room Anniversary · Pack a jacket. Pack a take.`,
    toastLine: (c) =>
      `${c.yearsAlive}-year climate: always playoff weather.`,
  },
  {
    id: "arts",
    stamp: "ANNIVERSARY ARTS",
    headline: () => `EPIC EXTENDED: THE WAR ROOM CINEMATIC UNIVERSE`,
    deck: (c) =>
      `Runtime: ${c.yearsAlive} year${c.yearsAlive === 1 ? "" : "s"}. Genre: sports tragedy with jokes.`,
    body: (c) =>
      `Sequel hooks include multi-league trophies, Foundry lab toys, and Maria’s gold form. Critics call it “too long” and “I can’t stop watching.” Premiered ${c.foundedLabel}. Still no credits sequence — you never leave.`,
    classified: () =>
      `UNDERSTUDY for next season: anyone with a phone and poor judgment.`,
    pullQuote: () =>
      `"Break a leg. Preferably the favorite’s."`,
    foot: () =>
      `Arts desk · Standing O for the room. Happy anniversary.`,
    toastLine: (c) =>
      `${c.yearsAlive} seasons of the same beautiful mess.`,
  },
  {
    id: "travel",
    stamp: "ANNIVERSARY TRAVEL",
    headline: () => `DESTINATION: ANOTHER LAP AROUND THE BAD-PICK SUN`,
    deck: (c) =>
      `Passport stamp: ${c.foundedLabel}. Visas: unlimited heartbreak.`,
    body: (c) =>
      `Itinerary since launch: Week 0 nerves, midseason spiral, finale hardware, offseason lying about “next year.” ${c.leagueName} remains a top destination for competitive friendship. Pack light. Bring salt.`,
    classified: () =>
      `TIMESHARE: one week of caring. Auto-renews every kickoff.`,
    pullQuote: () =>
      `"Are we there yet?" — No. It’s July 25 again.`,
    foot: (c) =>
      `Bon voyage into year ${c.yearsAlive + 1}. Don’t lock late at the airport.`,
    toastLine: (c) =>
      `${c.yearsAlive} years on the road. Still lost. Still fun.`,
  },
  {
    id: "horoscope",
    stamp: "ANNIVERSARY STARS",
    headline: () => `STARS SAY: YOU WILL OPEN THE APP AGAIN`,
    deck: (c) =>
      `Lucky number: ${c.yearsAlive}. Lucky move: not deleting the account.`,
    body: (c) =>
      `On this day the cosmos reminds ${c.leagueName} that loyalty looks like another season of feelings. Founded ${c.foundedLabel}. Prophecy: more sports, same friends, louder Dispatch.`,
    classified: () =>
      `PSYCHIC: you will age. The app will ship. Both will mock you.`,
    pullQuote: () =>
      `"Mercury is in free-fall. So is my Best Bet."`,
    foot: () =>
      `Horoscope desk · Happy War Room Anniversary. Touch grass optionally.`,
    toastLine: (c) =>
      `Stars align for year ${c.yearsAlive + 1}. Standings may not.`,
  },
  {
    id: "police",
    stamp: "ANNIVERSARY BEAT",
    headline: () => `NO ARRESTS IN MULTI-YEAR FUN INCIDENT`,
    deck: (c) =>
      `Suspects released. App still operating without a license for this much joy.`,
    body: (c) =>
      `Officers found confetti, plaques, and a commit history dating to ${c.foundedLabel}. ${c.yearsAlive} year${c.yearsAlive === 1 ? "" : "s"} of continuous operation. Fine waived if you lock on time once this season.`,
    classified: () =>
      `TIP LINE: report unauthorized fun. We will celebrate it.`,
    pullQuote: () =>
      `"I can explain the hours." — Cannot explain the hours`,
    foot: () =>
      `Beat closed for cake. Happy anniversary, co-conspirators.`,
    toastLine: (c) =>
      `${c.yearsAlive} years without a conviction. Still guilty.`,
  },
  {
    id: "classifieds",
    stamp: "ANNIVERSARY CLASSIFIEDS",
    headline: () => `FOR SALE: ONE FOUNDING MYTH · SLIGHTLY USED`,
    deck: (c) =>
      `Includes bugs, lore, and ${c.yearsAlive} year${c.yearsAlive === 1 ? "" : "s"} of receipts.`,
    body: (c) =>
      `Buyer receives: Museum plaques, cold opens, ring walks, One Year Older papers, and a Commish path that finally isn’t full of fake buttons. Seller: July 25, 2026. Condition: legendary. ${c.leagueName} already bought in.`,
    classified: () =>
      `HELP WANTED: people who still care. Apply by locking this week.`,
    pullQuote: () =>
      `"As-is. No warranty on your picks."`,
    foot: () =>
      `All sales final. Happy War Room Anniversary.`,
    toastLine: (c) =>
      `${c.yearsAlive} years in. Still not for sale. Still yours.`,
  },
];

function ordinal(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}

function yearWord(n: number): string {
  if (n === 1) return "One year";
  if (n === 2) return "Two years";
  if (n === 3) return "Three years";
  return `${n} years`;
}

function etParts(now = new Date()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ET,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const num = (t: string) =>
    Number(parts.find((p) => p.type === t)?.value || 0);
  return { year: num("year"), month: num("month"), day: num("day") };
}

/** Full years completed since founding as of this calendar year on July 25. */
export function platformYearsAlive(calendarYear: number): number {
  const founded = 2026;
  return Math.max(0, calendarYear - founded);
}

export function isPlatformAnniversaryDay(now = new Date()): boolean {
  const { month, day } = etParts(now);
  return month === 7 && day === 25;
}

function seenKey(leagueId: string, calendarYear: number) {
  return `${SEEN_PREFIX}:${leagueId}:${calendarYear}`;
}

export function hasSeenPlatformAnniversary(
  leagueId: string,
  calendarYear: number
): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(seenKey(leagueId, calendarYear)) === "1";
  } catch {
    return true;
  }
}

export function markPlatformAnniversarySeen(
  leagueId: string,
  calendarYear: number
) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(seenKey(leagueId, calendarYear), "1");
  } catch {
    /* ignore */
  }
}

function hashPick(seed: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return mod > 0 ? h % mod : 0;
}

function buildEdition(
  leagueId: string,
  leagueName: string,
  calendarYear: number,
  yearsAlive: number
): PlatformAnniversaryEdition {
  const ctx: PackCtx = {
    yearsAlive,
    yearWord: yearWord(yearsAlive),
    leagueName,
    foundedLabel: WAR_ROOM_FOUNDED_LABEL,
    calendarYear,
  };
  const pack =
    PACKS[hashPick(`${leagueId}:${calendarYear}`, PACKS.length)] || PACKS[0]!;

  return {
    year: calendarYear,
    yearsAlive,
    leagueId,
    leagueName,
    foundedLabel: WAR_ROOM_FOUNDED_LABEL,
    packId: pack.id,
    ritualName: PLATFORM_ANNIV_RITUAL,
    stamp: pack.stamp,
    headline: pack.headline(ctx),
    deck: pack.deck(ctx),
    body: pack.body(ctx),
    classified: pack.classified(ctx),
    pullQuote: pack.pullQuote(ctx),
    foot: pack.foot(ctx),
    toastLine: pack.toastLine(ctx),
  };
}

/**
 * Offer platform anniversary paper: July 25 ET, year ≥ 1 since founding,
 * once per viewer·league·calendar year.
 */
export async function shouldOfferPlatformAnniversary(opts?: {
  force?: boolean;
  now?: Date;
}): Promise<
  | { show: true; edition: PlatformAnniversaryEdition }
  | { show: false; reason?: string }
> {

  const session = getSession();
  const league = getLeague();
  if (!session?.playerId || !league?.id) {
    return { show: false, reason: "no league" };
  }

  const now = opts?.now ?? new Date();
  const { year } = etParts(now);
  if (!opts?.force && !isPlatformAnniversaryDay(now)) {
    return { show: false, reason: "not July 25" };
  }

  const yearsAlive = platformYearsAlive(year);
  // First full anniversary is 2027 (1 year). Force can preview year 1+ copy.
  const effectiveYears = opts?.force
    ? Math.max(1, yearsAlive || 1)
    : yearsAlive;
  if (!opts?.force && yearsAlive < 1) {
    return { show: false, reason: "before first anniversary" };
  }

  if (
    !opts?.force &&
    hasSeenPlatformAnniversary(league.id, year)
  ) {
    return { show: false, reason: "already seen" };
  }

  return {
    show: true,
    edition: buildEdition(
      league.id,
      league.name || "War Room",
      year,
      effectiveYears
    ),
  };
}

export const EVENT_FORCE_PLATFORM_ANNIVERSARY =
  "warroom-force-platform-anniversary";

export function requestPlatformAnniversaryPreview() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent(EVENT_FORCE_PLATFORM_ANNIVERSARY)
    );
  } catch {
    /* ignore */
  }
}

export function platformAnniversaryPackCount(): number {
  return PACKS.length;
}
