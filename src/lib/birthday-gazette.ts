/**
 * “One Year Older” — monthly birthday Gazette.
 * Day 1 of the month, for any league with locked birthdays that month.
 * Witty, zero points, once per league·month.
 */

/** Ritual name — product stamp for this drop */
export const BIRTHDAY_GAZETTE_RITUAL = "One Year Older";

import { createClient } from "@/lib/supabase/client";
import { getLeague, getSession } from "@/lib/league";
import { loadLeagueRoster } from "@/lib/cloud";


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
  /** Always “One Year Older” */
  ritualName: string;
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
    stamp: "ONE YEAR OLDER",
    headline: (c) =>
      c.plural
        ? `ONE YEAR OLDER: ${c.monthLabel.toUpperCase()} CLAIMS ANOTHER BATCH`
        : `ONE YEAR OLDER: ${c.names.toUpperCase()}`,
    deck: (c) =>
      c.plural
        ? `${c.count} in ${c.leagueName} will be one year older this month. Nobody asked. The paper printed it anyway.`
        : `${c.names} is one year older sometime this month. The cake is a lie. The standings are not.`,
    body: (c) =>
      `Official One Year Older census: ${c.names}. ${c.plural ? "They" : "They"} add a candle, lose a step, and still text “who locked?” at 11:58. The room pretends this matters for four minutes, then goes back to picking dogs.`,
    spankLine: (c) =>
      c.plural
        ? `Traditional One Year Older spanking in the Locker. Form a line. Bring shame.`
        : `Somebody spank ${c.names}. One year older. Not hard — hard enough that next ${c.monthLabel} still stings.`,
    classified: (c) =>
      `ONE YEAR OLDER · WANTED: dignity for ${c.names}. Reward: zero points.`,
    pullQuote: () =>
      `"I'm not one year older. My confidence numbers just got shorter." — Liar`,
    foot: () =>
      `One Year Older · No gifts. No points. Happy (alleged) birthday — Dispatch Network.`,
  },
  {
    id: "obituary",
    stamp: "ONE YEAR OLDER",
    headline: () => `ONE YEAR OLDER · HERE LIES YOUTH`,
    deck: (c) =>
      `${c.monthLabel} takes no prisoners. ${c.names} ${c.plural ? "are" : "is"} one year older on the list.`,
    body: (c) =>
      `Survived by unfinished props, a Best Bet that should’ve stayed home, and a chat that forgets this by Tuesday. ${c.names}: one year older, rest in pace.`,
    spankLine: () =>
      `One Year Older ritual: Locker “hbd” with hostage-note energy. Then spank.`,
    classified: (c) =>
      `LOST: one year of ${c.names}. Spent arguing spreads. Do not return.`,
    pullQuote: () =>
      `"Age is just a number. So is your weekly total. Both tragic."`,
    foot: () =>
      `One Year Older · In lieu of flowers, lock on time.`,
  },
  {
    id: "weather",
    stamp: "ONE YEAR OLDER",
    headline: (c) =>
      `ONE YEAR OLDER FORECAST: FOG, REGRET, CAKE`,
    deck: (c) =>
      `High pressure named ${c.names} over ${c.leagueName}.`,
    body: (c) =>
      `Scattered congrats, isolated eye-rolls, 100% chance of “you don’t look a day over… fine.” ${c.plural ? "These people" : "This person"} will still miss a lock. One year older. Science undefeated.`,
    spankLine: () =>
      `One Year Older weather: public roast required. Cake emoji optional.`,
    classified: (c) =>
      `FREE candles · slightly used · apply to ${c.names} · One Year Older edition`,
    pullQuote: () =>
      `"I asked for no fuss. They printed One Year Older." — Coward`,
    foot: () =>
      `One Year Older · Umbrellas useless. Sarcasm recommended.`,
  },
  {
    id: "crime",
    stamp: "ONE YEAR OLDER",
    headline: () => `ONE YEAR OLDER · TIME THEFT BLOTTER`,
    deck: (c) =>
      `${c.names} ${c.plural ? "have" : "has"} stolen another year. Cops unimpressed.`,
    body: (c) =>
      `Motive: survival. Method: calendar. ${c.leagueName} wants justice: mild public embarrassment. Charge: One Year Older without a permit.`,
    spankLine: () =>
      `Sentence: one digital spank, async, Locker, first person who remembers.`,
    classified: () =>
      `REWARD: roast harder than this paper. No cash. One Year Older only.`,
    pullQuote: () =>
      `"I didn’t choose One Year Older. It chose me. Then left."`,
    foot: () =>
      `One Year Older · Bail set at one perfect week. Good luck.`,
  },
  {
    id: "sports",
    stamp: "ONE YEAR OLDER",
    headline: (c) =>
      c.plural
        ? `ONE YEAR OLDER CLUSTER · INJURY REPORT`
        : `ONE YEAR OLDER: ${c.names.toUpperCase()} · OUT (AGE)`,
    deck: () =>
      `Questionable for youth. Probable for trash talk. Out for cardio.`,
    body: (c) =>
      `Training staff: ${c.names} day-to-day with acute One Year Older. Return: never. Fantasy impact: none — somehow worse.`,
    spankLine: () =>
      `League-mandated postgame spank. Review for excess celebration.`,
    classified: (c) =>
      `TRADE BAIT: ${c.names} · one year older · needs cake · dodges responsibility`,
    pullQuote: () =>
      `"Focusing on the next snap." — Person who just got One Year Older mid-sentence`,
    foot: () =>
      `One Year Older · Box score: years +, points = mid.`,
  },
  {
    id: "society",
    stamp: "ONE YEAR OLDER",
    headline: () => `ONE YEAR OLDER GALA · FORCED CHEER`,
    deck: (c) =>
      `${c.leagueName} society ignores ${c.names}’s age… loudly.`,
    body: (c) =>
      `Dress: Week 1 fits. Gifts: none on purpose. Speeches: “happy birthday, loser.” ${c.plural ? "Honorees" : "Honoree"} screenshot the One Year Older paper while pretending not to care.`,
    spankLine: () =>
      `Etiquette: spank is metaphorical unless Locker votes otherwise.`,
    classified: () =>
      `RSVP no · attendance via push · champagne imaginary · One Year Older`,
    pullQuote: () =>
      `"I asked for nothing. They gave me One Year Older. Perfect."`,
    foot: () =>
      `One Year Older · Society desk out. Late locks resume shortly.`,
  },
  {
    id: "horoscope",
    stamp: "ONE YEAR OLDER",
    headline: (c) =>
      `ONE YEAR OLDER HOROSCOPE: LOWER EXPECTATIONS`,
    deck: (c) =>
      `Mercury free-falling. So is ${c.names}.`,
    body: (c) =>
      `Sign: the Goat (as in get). Lucky move: don’t announce your own birthday. One Year Older did it for you. You’re welcome. Or sorry.`,
    spankLine: () =>
      `Cosmic One Year Older spank. Align with Locker emojis.`,
    classified: () =>
      `PSYCHIC: you will age. You will pick dogs. One Year Older confirms.`,
    pullQuote: () =>
      `"The universe is vast. Your lock window is not."`,
    foot: () =>
      `One Year Older · Not financial advice. Happy orbit.`,
  },
  {
    id: "classified-only",
    stamp: "ONE YEAR OLDER",
    headline: () => `ONE YEAR OLDER · ROOM FOR RENT IN A MIDLIFE`,
    deck: (c) =>
      `${c.monthLabel} · tenants: ${c.names}`,
    body: (c) =>
      `Utilities: Wi‑Fi, insecurity, War Room push. ${c.plural ? "Tenants" : "Tenant"} supply cake and must not finish last three weeks running. Board never forgets. One Year Older lease: auto-renew forever.`,
    spankLine: () =>
      `Deposit: one spank + half-hearted “hbd”.`,
    classified: (c) =>
      `FOR SALE: youth of ${c.names} · high mileage · One Year Older`,
    pullQuote: () =>
      `"Location, location — still last on the Board."`,
    foot: () =>
      `One Year Older Realty · No refunds on birthdays.`,
  },
  {
    id: "editorial",
    stamp: "ONE YEAR OLDER",
    headline: () => `EDITORIAL: ONE YEAR OLDER IS A BAD CHOICE`,
    deck: (c) =>
      `Editors scold ${c.names} this month.`,
    body: (c) =>
      `Aging without commish consent is frowned upon. ${c.names} did it anyway. One Year Older recommends light roasting, heavy denial, zero participation trophies.`,
    spankLine: () =>
      `Board votes 14–0 for ceremonial spanking.`,
    classified: () =>
      `REBUTTAL from birthday people · max 12 words · no “blessed” · One Year Older`,
    pullQuote: () =>
      `"Age is wisdom." — About to lock the worst number`,
    foot: () =>
      `One Year Older · Unsigned. Love, The Dispatch.`,
  },
  {
    id: "police",
    stamp: "ONE YEAR OLDER",
    headline: () => `ONE YEAR OLDER · NO ARRESTS IN AGING INCIDENT`,
    deck: (c) =>
      `${c.names} released on weak ankles.`,
    body: (c) =>
      `Candles lit, alibis mid. ${c.leagueName}: injuries limited to pride. One Year Older investigation renews annually forever.`,
    spankLine: () =>
      `Community service: take Locker spam. Spank encouraged.`,
    classified: () =>
      `TIP LINE: unauthorized aging. We know. Call anyway. One Year Older.`,
    pullQuote: () =>
      `"Framed by the Gregorian calendar." — Every One Year Older`,
    foot: () =>
      `One Year Older · Case open. Cake not evidence.`,
  },
  {
    id: "finance",
    stamp: "ONE YEAR OLDER",
    headline: () => `ONE YEAR OLDER MARKETS: CANDLE FUTURES SPIKE`,
    deck: (c) =>
      `Short youth. Long ${c.names}.`,
    body: (c) =>
      `${c.count} forced smile${c.plural ? "s" : ""}, zero ROI. ${c.leagueName} remains volatile. One Year Older equity diluted by collective indifference — pure free market.`,
    spankLine: () =>
      `Fee: one spank in the Locker before close.`,
    classified: (c) =>
      `IPO: ${c.names} N+1 · overvalued · One Year Older`,
    pullQuote: () =>
      `"Past performance ≠ future locks." — Sarcasm Enforcement Commission`,
    foot: () =>
      `One Year Older · Not investment advice. Lower the bar.`,
  },
  {
    id: "arts",
    stamp: "ONE YEAR OLDER",
    headline: () => `ONE YEAR OLDER · SHOW EXTENDED ANOTHER SEASON`,
    deck: (c) =>
      `Starring ${c.names}. Tragicomedy. Runtime: forever.`,
    body: (c) =>
      `Critics: “committed,” “loud,” “still picking unders.” ${c.monthLabel} plot: cake, denial, late prop. One Year Older revival. Boos welcome.`,
    spankLine: () =>
      `Intermission spank · Phase II · stay seated.`,
    classified: () =>
      `UNDERSTUDY for next One Year Older · accept aging on short notice`,
    pullQuote: () =>
      `"Break a leg. Not mine. One Year Older made me delicate."`,
    foot: () =>
      `One Year Older · Tickets free. Dignity sold out.`,
  },
  {
    id: "tech",
    stamp: "ONE YEAR OLDER",
    headline: () => `ONE YEAR OLDER · HUMAN.VERSION++ SHIPPED`,
    deck: (c) =>
      `Changelog: ${c.names} · older · same bugs · worse docs.`,
    body: (c) =>
      `Patch: less night vision, more salt, deprecated “I’ll lock later.” Known issue: still thinks this is their year. ${c.leagueName} mocks on sight. One Year Older cannot be rolled back.`,
    spankLine: () =>
      `QA: physical spank testing. File in Locker.`,
    classified: () =>
      `DEPRECATED: youth API · migrate to One Year Older`,
    pullQuote: () =>
      `"Not a bug: I’ve been 29 for six One Year Olders."`,
    foot: () =>
      `One Year Older · Shipped with sarcasm. No rollback.`,
  },
  {
    id: "travel",
    stamp: "ONE YEAR OLDER",
    headline: (c) =>
      `ONE YEAR OLDER TRAVEL: DENIAL, CAKE, LOCKER`,
    deck: (c) =>
      `Pack light. ${c.names} brought the baggage.`,
    body: (c) =>
      `Itinerary: denial, shrug, wrong-date “hbd.” No upgrade to first-class youth. One Year Older passport stamp is permanent.`,
    spankLine: () =>
      `Customs: search pride, administer one spank.`,
    classified: () =>
      `TIMESHARE: one week of feeling special · One Year Older · nonrefundable`,
    pullQuote: () =>
      `"I need a vacation from One Year Older." — Will not get one`,
    foot: () =>
      `One Year Older · Bon voyage. Don’t lock late en route.`,
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
    ritualName: BIRTHDAY_GAZETTE_RITUAL,
    stamp: pack.stamp || BIRTHDAY_GAZETTE_RITUAL.toUpperCase(),
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
