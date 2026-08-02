/**
 * Monthly birthday Gazette — day 1 of the month, for any league with
 * locked birthdays that month. Witty, zero points, once per league·month.
 */

import { createClient } from "@/lib/supabase/client";
import { getLeague, getSession } from "@/lib/league";
import { loadLeagueRoster } from "@/lib/cloud";
import { isGuestMode } from "@/lib/guest-mode";

const SEEN_PREFIX = "warroom-bday-gazette-seen-v1";
const ET = "America/New_York";

export type BirthdayHonoree = {
  userId: string;
  name: string;
  /** MM-DD */
  mmdd: string;
  day: number;
};

export type BirthdayGazetteEdition = {
  year: number;
  month: number; // 1-12
  monthLabel: string;
  leagueId: string;
  leagueName: string;
  honorees: BirthdayHonoree[];
  packId: string;
  stamp: string;
  headline: string;
  deck: string;
  body: string;
  spankLine: string;
  classified: string;
  pullQuote: string;
  foot: string;
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** 14 papers — pick by league + year + month so the room shares one edition. */
type PaperPack = {
  id: string;
  stamp: string;
  headline: (ctx: PackCtx) => string;
  deck: (ctx: PackCtx) => string;
  body: (ctx: PackCtx) => string;
  spankLine: (ctx: PackCtx) => string;
  classified: (ctx: PackCtx) => string;
  pullQuote: (ctx: PackCtx) => string;
  foot: (ctx: PackCtx) => string;
};

type PackCtx = {
  monthLabel: string;
  names: string;
  count: number;
  leagueName: string;
  plural: boolean;
};

const PACKS: PaperPack[] = [
  {
    id: "candles",
    stamp: "EXTRA · OLDER",
    headline: (c) =>
      c.plural
        ? `${c.monthLabel.toUpperCase()} CLAIMS ANOTHER BATCH OF VICTIMS`
        : `${c.names.toUpperCase()} TURNS ONE YEAR MORE UNHIRABLE`,
    deck: (c) =>
      c.plural
        ? `${c.count} members of ${c.leagueName} will get older this month whether they like it or not.`
        : `The paper noticed. The cake is a lie. The standings are not.`,
    body: (c) =>
      `Official census: ${c.names}. ${c.plural ? "They" : "They"} will add a candle, lose a step, and still text “who locked?” at 11:58. The room is required to pretend this matters for approximately four minutes.`,
    spankLine: (c) =>
      c.plural
        ? `Traditional spanking will be administered in the Locker. Form a line. Bring your own shame.`
        : `Somebody spank ${c.names}. Not hard. Hard enough that next year’s paper still hurts.`,
    classified: (c) =>
      `WANTED: dignity for ${c.names}. Last seen near a birthday candle. Reward: zero points.`,
    pullQuote: () =>
      `"I'm not getting older. My confidence numbers just got shorter." — Anonymous, definitely lying`,
    foot: () =>
      `No gifts. No points. No excuses. Happy (alleged) birthday from the Gazette Network.`,
  },
  {
    id: "obituary",
    stamp: "OBITUARY DESK",
    headline: () => `HERE LIES YOUTH — DIED OF EXPOSURE TO PICK’EM`,
    deck: (c) =>
      `${c.monthLabel} takes no prisoners. ${c.names} ${c.plural ? "are" : "is"} on the list.`,
    body: (c) =>
      `Survived by unfinished props, a Best Bet that should’ve stayed home, and a group chat that will forget this paper by Tuesday. ${c.names}: rest in pace (you’re slower now).`,
    spankLine: (c) =>
      `Ritual complete only after the Locker posts “happy bday” with the energy of a hostage note.`,
    classified: (c) =>
      `LOST: one year of ${c.names}’s life. If found, do not return. It was spent arguing spreads.`,
    pullQuote: () =>
      `"Age is just a number. So is your weekly point total. Both are tragic."`,
    foot: () =>
      `In lieu of flowers, lock your card on time. The Gazette sends thoughts and low-effort prayers.`,
  },
  {
    id: "weather",
    stamp: "WEATHER DESK",
    headline: (c) =>
      `FORECAST: ${c.monthLabel.toUpperCase()} BRINGS FOG, REGRET, AND CAKE`,
    deck: (c) =>
      `High pressure system named ${c.names} moving through ${c.leagueName}.`,
    body: (c) =>
      `Expect scattered congratulations, isolated eye-rolls, and a 100% chance someone says “you don’t look a day over… fine.” ${c.plural ? "These people" : "This person"} will still miss a kickoff lock. Science is undefeated.`,
    spankLine: () =>
      `Meteorology confirms: birthday weather requires one public roast and optional cake emoji spam.`,
    classified: (c) =>
      `FREE: leftover candles from last year. Slightly used. Apply to ${c.names}.`,
    pullQuote: () =>
      `"I asked for no fuss. The Gazette printed a fuss." — Local coward`,
    foot: () =>
      `Umbrellas useless. Sarcasm recommended. Points unchanged.`,
  },
  {
    id: "crime",
    stamp: "CRIME BLOTTER",
    headline: () => `TIME THEFT REPORTED — SUSPECTS NAMED BELOW`,
    deck: (c) =>
      `${c.names} ${c.plural ? "have" : "has"} stolen another year. Authorities are not impressed.`,
    body: (c) =>
      `Motive: survival. Method: calendar. Accomplices: every bad pick since last ${c.monthLabel}. ${c.leagueName} demands justice in the form of mild public embarrassment.`,
    spankLine: (c) =>
      `Sentence: one (1) digital spanking, delivered asynchronously in the Locker by whoever remembers first.`,
    classified: () =>
      `REWARD: bragging rights if you roast them harder than this paper. No cash. No dignity either.`,
    pullQuote: () =>
      `"I didn’t choose the year. The year chose me. Then it left."`,
    foot: () =>
      `Bail is set at one perfect week. Good luck with that.`,
  },
  {
    id: "sports",
    stamp: "SPORTS EXTRA",
    headline: (c) =>
      c.plural
        ? `BIRTHDAY CLUSTER FORCES LEAGUE INTO INJURY REPORT`
        : `${c.names.toUpperCase()} ADDED TO THE INJURY REPORT: AGE`,
    deck: () =>
      `Questionable for youth. Probable for trash talk. Out for cardio.`,
    body: (c) =>
      `The training staff lists ${c.names} as day-to-day with acute birthday. Expected return: never. Fantasy implications: none, which is somehow worse.`,
    spankLine: () =>
      `Postgame spanking is league-mandated. Replay officials will review for excess celebration.`,
    classified: (c) =>
      `TRADE BAIT: one slightly used competitor (${c.names}). Needs cake. Avoids responsibility.`,
    pullQuote: () =>
      `"We’re focusing on the next snap." — Person who just became older mid-sentence`,
    foot: () =>
      `Box score of life: years +, points = still mid. Happy birthday, athlete.`,
  },
  {
    id: "society",
    stamp: "SOCIETY PAGE",
    headline: () => `GALA SEASON OPENS WITH FORCED CHEER AND FAKE SURPRISE`,
    deck: (c) =>
      `${c.leagueName} high society gathers to ignore ${c.names}’s age… loudly.`,
    body: (c) =>
      `Dress code: whatever you wore for Week 1. Gift table: empty on purpose. Speeches: three words max (“happy birthday, loser”). ${c.plural ? "Honorees" : "Honoree"} will pretend not to care while screenshotting this paper.`,
    spankLine: () =>
      `Etiquette tip: the spank is metaphorical unless the Locker decides otherwise.`,
    classified: () =>
      `RSVP: no. Attendance: mandatory via notification. Champagne: imaginary.`,
    pullQuote: () =>
      `"I asked for nothing. They gave me a newspaper. Perfect."`,
    foot: () =>
      `Society desk out. Real drama resumes when someone locks late.`,
  },
  {
    id: "horoscope",
    stamp: "HOROSCOPE DESK",
    headline: (c) =>
      `STARS SAY ${c.monthLabel.toUpperCase()} BIRTHDAYS SHOULD LOWER EXPECTATIONS`,
    deck: (c) =>
      `Mercury is in free-fall. So is ${c.names}.`,
    body: (c) =>
      `Your sign this month: the Goat (as in get). Lucky number: whatever confidence you still have left. Lucky move: not texting the room about your birthday first. The Gazette did it for you. You’re welcome. Or sorry.`,
    spankLine: (c) =>
      `Cosmic spanking inbound. Align your chakras with the Locker reaction emojis.`,
    classified: () =>
      `PSYCHIC READING: you will age. You will pick dogs. You will deny both.`,
    pullQuote: () =>
      `"The universe is vast. Your window to lock is not."`,
    foot: () =>
      `Horoscopes not financial advice. Or emotional support. Happy orbit day.`,
  },
  {
    id: "classified-only",
    stamp: "CLASSIFIEDS",
    headline: () => `ROOM FOR RENT: INSIDE SOMEBODY’S MIDLIFE`,
    deck: (c) =>
      `Available ${c.monthLabel}. Current tenants: ${c.names}.`,
    body: (c) =>
      `Utilities included: Wi‑Fi, insecurity, and a push notification from War Room. ${c.plural ? "Tenants" : "Tenant"} responsible for own cake and for not finishing last three weeks in a row. References: the Board, which never forgets.`,
    spankLine: () =>
      `Security deposit: one public spank and a half-hearted “hbd”.`,
    classified: (c) =>
      `FOR SALE: youth of ${c.names}. Buyer beware — high mileage, low ATS.`,
    pullQuote: () =>
      `"Location, location, location — I’m still in last."`,
    foot: () =>
      `All sales final. No refunds on birthdays. Gazette Network Realty.`,
  },
  {
    id: "editorial",
    stamp: "EDITORIAL",
    headline: () => `IN OUR OPINION: GETTING OLDER IS A CHOICE (A BAD ONE)`,
    deck: (c) =>
      `The board of editors names ${c.names} in this month’s scolding.`,
    body: (c) =>
      `We do not condone aging without written consent from the commissioner. Nevertheless, ${c.names} proceeded. The Gazette recommends light roasting, heavy denial, and zero participation trophies — those are for the Toilet Bowl.`,
    spankLine: () =>
      `Editorial board votes 12–0 in favor of ceremonial spanking.`,
    classified: () =>
      `OP-ED REBUTTAL wanted from birthday people. Max 12 words. No “blessed.”`,
    pullQuote: () =>
      `"Age is wisdom." — Person about to lock the favorite at the worst number`,
    foot: () =>
      `Unsigned because cowards. Love, the Gazette.`,
  },
  {
    id: "police",
    stamp: "POLICE BEAT",
    headline: () => `NO ARRESTS IN ANNUAL “GETTING OLDER” INCIDENT`,
    deck: (c) =>
      `Suspects ${c.names} released on their own recognizance (and weak ankles).`,
    body: (c) =>
      `Officers arrived to find candles already lit and alibis already mid. ${c.leagueName} reports no injuries except pride. The investigation continues every year forever.`,
    spankLine: (c) =>
      `Community service: accept Locker spam without arguing. Spanking optional but encouraged.`,
    classified: () =>
      `TIP LINE: report unauthorized aging. We already know. Call anyway.`,
    pullQuote: () =>
      `"I was framed by the Gregorian calendar." — Every birthday, ever`,
    foot: () =>
      `Case file remains open. Cake is not evidence. Happy (probationary) birthday.`,
  },
  {
    id: "finance",
    stamp: "MARKETS",
    headline: () => `CANDLE FUTURES SPIKE AS LOCALS AGE ON SCHEDULE`,
    deck: (c) =>
      `Investors short youth. Long ${c.names}.`,
    body: (c) =>
      `Analysts project ${c.count} forced smile${c.plural ? "s" : ""} and zero ROI. ${c.leagueName} remains a volatile market for feelings. Birthday equity diluted by everyone else’s indifference — the purest free market.`,
    spankLine: () =>
      `Transaction fee: one spank, payable in the Locker before close of business.`,
    classified: (c) =>
      `IPO: ${c.names} Year N+1. Overvalued. Still trading.`,
    pullQuote: () =>
      `"Past performance does not guarantee future locks." — SEC (Sarcasm Enforcement Commission)`,
    foot: () =>
      `Not investment advice. Definitely birthday advice: lower the bar.`,
  },
  {
    id: "arts",
    stamp: "ARTS & LEISURE",
    headline: () => `LOCAL ONE-PERSON SHOW EXTENDED FOR ANOTHER YEAR`,
    deck: (c) =>
      `Starring ${c.names}. Genre: tragicomedy. Runtime: forever.`,
    body: (c) =>
      `Critics call the performance “committed,” “loud,” and “still picking unders.” ${c.monthLabel}’s revival features the same plot: cake, denial, a late prop. Standing ovation optional. Boos welcome.`,
    spankLine: () =>
      `Intermission spanking in Act II. Do not leave your seats.`,
    classified: () =>
      `UNDERSTUDY needed for next year. Must accept aging on short notice.`,
    pullQuote: () =>
      `"Break a leg. Preferably not mine. I’m delicate now."`,
    foot: () =>
      `Tickets free. Dignity sold out. Happy birthday from the culture desk.`,
  },
  {
    id: "tech",
    stamp: "TECH DESK",
    headline: () => `UPDATE AVAILABLE: HUMAN.VERSION++ // BREAKING CHANGES`,
    deck: (c) =>
      `Changelog for ${c.names}: older, same bugs, worse documentation.`,
    body: (c) =>
      `Patch notes: decreased night vision, increased salt, deprecated “I’ll lock later.” Known issues: still thinks this year is their year. ${c.leagueName} servers will mock on sight.`,
    spankLine: () =>
      `QA requires physical spank testing. File tickets in the Locker.`,
    classified: () =>
      `DEPRECATED: youth API. Migration guide: accept it.`,
    pullQuote: () =>
      `"It’s not a bug, it’s a feature: I’ve been 29 for six years."`,
    foot: () =>
      `Shipped with love and sarcasm. Rollback not supported.`,
  },
  {
    id: "travel",
    stamp: "TRAVEL",
    headline: (c) =>
      `${c.monthLabel.toUpperCase()} DESTINATIONS: DENIAL, CAKE, AND THE LOCKER`,
    deck: (c) =>
      `Pack light. ${c.names} already brought the baggage.`,
    body: (c) =>
      `Itinerary: morning denial, afternoon group-chat shrug, evening “happy birthday” from someone who Googled the date wrong. ${c.plural ? "Travelers" : "Traveler"} warned: no upgrades to first class youth.`,
    spankLine: () =>
      `Customs will search for contraband pride and administer one spank.`,
    classified: () =>
      `TIMESHARE: one week of feeling special. Deposit nonrefundable.`,
    pullQuote: () =>
      `"I need a vacation from this birthday." — Person who will not get one`,
    foot: () =>
      `Bon voyage to another lap around the sun. Try not to lock late en route.`,
  },
];

function etParts(now = new Date()): {
  year: number;
  month: number;
  day: number;
} {
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

function seenKey(leagueId: string, year: number, month: number) {
  return `${SEEN_PREFIX}:${leagueId}:${year}-${String(month).padStart(2, "0")}`;
}

export function hasSeenBirthdayGazette(
  leagueId: string,
  year: number,
  month: number
): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(seenKey(leagueId, year, month)) === "1";
  } catch {
    return true;
  }
}

export function markBirthdayGazetteSeen(
  leagueId: string,
  year: number,
  month: number
) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(seenKey(leagueId, year, month), "1");
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

function formatNameList(names: string[]): string {
  if (!names.length) return "Nobody";
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function buildEdition(
  honorees: BirthdayHonoree[],
  leagueId: string,
  leagueName: string,
  year: number,
  month: number
): BirthdayGazetteEdition {
  const names = formatNameList(honorees.map((h) => h.name));
  const plural = honorees.length > 1;
  const monthLabel = MONTH_NAMES[month - 1] || "This month";
  const ctx: PackCtx = {
    monthLabel,
    names,
    count: honorees.length,
    leagueName,
    plural,
  };
  const pack =
    PACKS[
      hashPick(`${leagueId}:${year}:${month}`, PACKS.length)
    ] || PACKS[0]!;

  return {
    year,
    month,
    monthLabel,
    leagueId,
    leagueName,
    honorees,
    packId: pack.id,
    stamp: pack.stamp,
    headline: pack.headline(ctx),
    deck: pack.deck(ctx),
    body: pack.body(ctx),
    spankLine: pack.spankLine(ctx),
    classified: pack.classified(ctx),
    pullQuote: pack.pullQuote(ctx),
    foot: pack.foot(ctx),
  };
}

/**
 * Load locked birthdays for humans in this league (cloud MM-DD).
 */
export async function loadLeagueBirthdaysForMonth(
  month: number
): Promise<BirthdayHonoree[]> {
  const mm = String(month).padStart(2, "0");
  let roster: { userId: string; name: string; isBot?: boolean }[] = [];
  try {
    roster = await loadLeagueRoster();
  } catch {
    return [];
  }
  const humans = roster.filter((r) => !r.isBot && r.userId);
  if (!humans.length) return [];

  const byId = new Map(humans.map((h) => [h.userId, h.name]));
  const ids = [...byId.keys()];

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, birthday_mmdd")
      .in("id", ids);
    if (error || !data) return [];

    const out: BirthdayHonoree[] = [];
    for (const row of data as {
      id: string;
      display_name?: string;
      birthday_mmdd?: string | null;
    }[]) {
      const b = (row.birthday_mmdd || "").trim();
      if (!/^\d{2}-\d{2}$/.test(b)) continue;
      if (!b.startsWith(`${mm}-`)) continue;
      const day = Number(b.slice(3, 5));
      if (!Number.isFinite(day) || day < 1 || day > 31) continue;
      out.push({
        userId: row.id,
        name: byId.get(row.id) || row.display_name || "Player",
        mmdd: b,
        day,
      });
    }
    out.sort((a, b) => a.day - b.day || a.name.localeCompare(b.name));
    return out;
  } catch {
    return [];
  }
}

/**
 * Offer monthly birthday paper: 1st of month (ET), league with ≥1 locked bday
 * that month, once per viewer·league·month. Works in live or sandbox rooms.
 */
export async function shouldOfferBirthdayGazette(opts?: {
  force?: boolean;
  /** Test override — pretend this ET day */
  now?: Date;
}): Promise<
  | { show: true; edition: BirthdayGazetteEdition }
  | { show: false; reason?: string }
> {
  if (isGuestMode()) return { show: false, reason: "guest" };
  const session = getSession();
  const league = getLeague();
  if (!session?.playerId || !league?.id) {
    return { show: false, reason: "no league" };
  }

  const { year, month, day } = etParts(opts?.now ?? new Date());
  if (!opts?.force && day !== 1) {
    return { show: false, reason: "not day 1" };
  }

  if (
    !opts?.force &&
    hasSeenBirthdayGazette(league.id, year, month)
  ) {
    return { show: false, reason: "already seen" };
  }

  const honorees = await loadLeagueBirthdaysForMonth(month);
  if (!honorees.length) {
    return { show: false, reason: "no birthdays this month" };
  }

  const edition = buildEdition(
    honorees,
    league.id,
    league.name || "War Room",
    year,
    month
  );
  return { show: true, edition };
}

export const EVENT_FORCE_BIRTHDAY_GAZETTE = "warroom-force-birthday-gazette";

export function requestBirthdayGazettePreview() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(EVENT_FORCE_BIRTHDAY_GAZETTE));
  } catch {
    /* ignore */
  }
}

/** Pack count for tests / Foundry */
export function birthdayGazettePackCount(): number {
  return PACKS.length;
}
