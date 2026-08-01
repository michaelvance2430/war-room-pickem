/**
 * End-of-season winner announcements — once per player when hardware is engraved.
 * Sarcastic / hilarious copy packs per trophy type + "you won" vs "they won".
 */

import type { LeagueTrophy, TrophyType } from "./trophies";
import { TROPHY_META } from "./trophies";

const SEEN_KEY = "warroom-season-finale-seen-v1";

export type FinaleSlideKind = "intro" | TrophyType | "outro";

export type FinaleSlide = {
  kind: FinaleSlideKind;
  year: number;
  emoji: string;
  kicker: string;
  title: string;
  body: string;
  winnerName?: string;
  winnerUserId?: string | null;
  accent: string;
  border: string;
  /** Self-flex when viewer is the winner */
  isYou?: boolean;
};

function trophyKey(t: LeagueTrophy): string {
  return `${t.seasonYear}:${t.trophyType}`;
}

function storageKey(leagueId: string, playerId: string): string {
  return `${SEEN_KEY}:${leagueId || "default"}:${playerId}`;
}

function readSeen(leagueId: string, playerId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(storageKey(leagueId, playerId));
    if (!raw) return new Set();
    const p = JSON.parse(raw) as string[];
    return new Set(Array.isArray(p) ? p : []);
  } catch {
    return new Set();
  }
}

export function markFinaleSeen(
  leagueId: string,
  playerId: string,
  trophies: LeagueTrophy[]
) {
  if (typeof window === "undefined") return;
  try {
    const seen = readSeen(leagueId, playerId);
    for (const t of trophies) seen.add(trophyKey(t));
    localStorage.setItem(
      storageKey(leagueId, playerId),
      JSON.stringify([...seen])
    );
  } catch {
    /* ignore */
  }
}

/** Prefer newest season year that has engraved hardware. */
export function latestAwardedSeasonYear(trophies: LeagueTrophy[]): number | null {
  if (!trophies.length) return null;
  return Math.max(...trophies.map((t) => t.seasonYear));
}

const ORDER: TrophyType[] = ["championship", "toilet_bowl", "crystal_ball"];

/**
 * Trophies the player has not been announced for yet (latest season first).
 * If any are new for that year, return the full year slate for a proper ceremony
 * (re-announcing already-seen ones in the pack is fine; we only gate on "any new").
 *
 * Note: callers should still gate prior museum years (year < campaign year) —
 * those are Ring Ceremony at Week 0, not a multi-slide season finale.
 */
export function getUnseenFinaleTrophies(
  trophies: LeagueTrophy[],
  leagueId: string,
  playerId: string
): { year: number; items: LeagueTrophy[]; hasNew: boolean } | null {
  const year = latestAwardedSeasonYear(trophies);
  if (year == null) return null;

  const yearItems = trophies
    .filter((t) => t.seasonYear === year)
    .sort((a, b) => ORDER.indexOf(a.trophyType) - ORDER.indexOf(b.trophyType));

  if (!yearItems.length) return null;

  const seen = readSeen(leagueId, playerId);
  const hasNew = yearItems.some((t) => !seen.has(trophyKey(t)));
  if (!hasNew) return null;

  return { year, items: yearItems, hasNew: true };
}

function pick<T>(arr: T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return arr[Math.abs(h) % arr.length];
}

function firstName(name: string) {
  return (name || "Somebody").trim().split(/\s+/)[0] || "Somebody";
}

function isSelf(
  t: LeagueTrophy,
  sessionPlayerId: string | null | undefined,
  sessionName?: string | null
) {
  if (sessionPlayerId && t.winnerUserId && t.winnerUserId === sessionPlayerId) {
    return true;
  }
  if (sessionName && t.winnerName) {
    const a = sessionName.toLowerCase().trim();
    const b = t.winnerName.toLowerCase().trim();
    if (a && b && (a === b || a.includes(b) || b.includes(a))) return true;
  }
  return false;
}

/** Build multi-step ceremony slides with sarcasm dialed to 11. */
export function buildFinaleSlides(opts: {
  year: number;
  items: LeagueTrophy[];
  leagueName: string;
  sessionPlayerId?: string | null;
  sessionName?: string | null;
}): FinaleSlide[] {
  const { year, items, leagueName, sessionPlayerId, sessionName } = opts;
  const league = leagueName || "War Room";
  const slides: FinaleSlide[] = [];

  const intros = [
    {
      title: "THE HARDWARE IS ENGRAVED",
      body: `Somebody finished ${year}. Somebody else finished… less. The plaques are real. Your excuses are not.`,
    },
    {
      title: "SEASON'S OVER. COPE BEGINS.",
      body: `${league} just locked the ${year} trophies. If your name isn't on one, congratulations — you are content.`,
    },
    {
      title: "PLEASE REMAIN SEATED FOR THE AWARDS",
      body: `This will only hurt if you finished mid-pack. Which, statistically, is most of you.`,
    },
    {
      title: "BREAKING: PEOPLE WON THINGS",
      body: `Commish hit engrave. History got written. The group chat will never recover.`,
    },
  ];
  const intro = pick(intros, `${league}-${year}-intro`);

  slides.push({
    kind: "intro",
    year,
    emoji: "📢",
    kicker: `${year} season finale · ${league}`,
    title: intro.title,
    body: intro.body,
    accent: "text-primary",
    border: "border-primary/50",
  });

  for (const t of items) {
    const you = isSelf(t, sessionPlayerId, sessionName);
    const name = t.winnerName || "Unknown legend";
    const first = firstName(name);
    const meta = TROPHY_META[t.trophyType];

    if (t.trophyType === "championship") {
      const bodiesYou = [
        `You won the whole damn thing. ${year}. Share the graphic before the group chat rewrites history.`,
        `That's your name on the hardware. Not "pretty good." Champion. Be loud for a minute — you earned it.`,
        `Season over. You're the one holding the trophy. The rest of the room can start practicing their excuses for next year.`,
      ];
      const bodiesThem = [
        `${name} just took the ${year} title. ${first} finished first. Everyone else finished… not first. That's the whole story.`,
        `Hardware goes to ${name}. If you faded them all year, this is the receipt. If you rode with them, you're allowed one smug text.`,
        `${first} won it. Not a committee vote. Not a vibe check. The board. Take a screenshot, tag them, start the roast cycle.`,
      ];
      slides.push({
        kind: "championship",
        year,
        emoji: meta.emoji,
        kicker: "The big one · championship hardware",
        title: you ? "YOU WON IT ALL" : `${name.toUpperCase()} IS CHAMP`,
        body: you
          ? pick(bodiesYou, `${name}-${year}-c-you`)
          : pick(bodiesThem, `${name}-${year}-c-them`),
        winnerName: name,
        winnerUserId: t.winnerUserId,
        accent: meta.accent,
        border: meta.border,
        isYou: you,
      });
    }

    if (t.trophyType === "toilet_bowl") {
      const bodiesYou = [
        `You won the Toilet Bowl. That's still a tournament. That's still a crown. That's still going on every group-chat anniversary until the heat death of the sun.`,
        `Bottom half. Bracket. Victory. The National champ can keep their dignity — you got a story that prints itself.`,
        `Toilet Bowl champion. Wear it. Frame it. Weaponize it at Thanksgiving. Zero shame. Maximum content.`,
      ];
      const bodiesThem = [
        `${name} just won the ${year} Toilet Bowl. The bottom half had a king. It was ${first}. Your "at least I wasn't last" speech has been cancelled.`,
        `Toilet Bowl hardware for ${name}. Prestigious? Philosophers disagree. Permanent? Absolutely. Hilarious? Oh, buddy.`,
        `${first} conquered the porcelain playoffs. Everyone else in that bracket: thank you for your service (as punchlines).`,
        `Yes, there's a trophy for the toilet. Yes, ${name} has it. No, we will not stop bringing this up in ${year + 1}.`,
      ];
      slides.push({
        kind: "toilet_bowl",
        year,
        emoji: meta.emoji,
        kicker: "Toilet Bowl · bottom half, still a crown",
        title: you ? "YOU FLUSHED THE COMPETITION" : `TOILET BOWL CHAMP: ${name.toUpperCase()}`,
        body: you
          ? pick(bodiesYou, `${name}-${year}-t-you`)
          : pick(bodiesThem, `${name}-${year}-t-them`),
        winnerName: name,
        winnerUserId: t.winnerUserId,
        accent: meta.accent,
        border: meta.border,
        isYou: you,
      });
    }

    if (t.trophyType === "crystal_ball") {
      const bodiesYou = [
        `Village Nerd / Nerd King secured. You called the national champ in the Crystal Ball. Prize money: $0. Smugness: uncapped. Scientists are concerned.`,
        `You were right once and it was the only time that mattered. Nerd hardware is forever. Standings points were never invited.`,
        `Prophecy complete. The rest of the league guessed with their hearts. You guessed with… well, something. It worked.`,
      ];
      const bodiesThem = [
        `${name} is the ${year} Village Nerd (Nerd King energy). Crystal Ball national champ pick. Zero points. Infinite "I told you so."`,
        `While you were sweating spreads, ${first} was out here LARPing as a selection committee — correctly. Nerd plaque inbound.`,
        `Nerd award: ${name}. They get a trophy for being right about one team in January-ish energy. You get free envy. Fair trade.`,
        `${first} saw the future. Or got lucky. Either way, it's engraved, and your hot take is not.`,
      ];
      slides.push({
        kind: "crystal_ball",
        year,
        emoji: meta.emoji,
        kicker: "Village Nerd · Crystal Ball prophet",
        title: you ? "YOU ARE THE NERD KING" : `NERD KING: ${name.toUpperCase()}`,
        body: you
          ? pick(bodiesYou, `${name}-${year}-n-you`)
          : pick(bodiesThem, `${name}-${year}-n-them`),
        winnerName: name,
        winnerUserId: t.winnerUserId,
        accent: meta.accent,
        border: meta.border,
        isYou: you,
      });
    }
  }

  const champ = items.find((i) => i.trophyType === "championship");
  const toilet = items.find((i) => i.trophyType === "toilet_bowl");
  const nerd = items.find((i) => i.trophyType === "crystal_ball");
  const summaryBits = [
    champ ? `🏆 ${champ.winnerName}` : null,
    toilet ? `🚽 ${toilet.winnerName}` : null,
    nerd ? `🔮 ${nerd.winnerName}` : null,
  ].filter(Boolean);

  const outros = [
    {
      title: "HISTORY FILED. CHAT RUINED.",
      body: `That's the ${year} class for ${league}. Screenshot it. Share it. Argue about it until August. Then do it all again like the emotionally healthy people we are not.`,
    },
    {
      title: "SEE YOU IN THE MUSEUM",
      body: `Plaques live in the Trophy Room. Regret lives in your notes app. Next year is a clean slate — until week 3, when it isn't.`,
    },
    {
      title: "AWARDS ADJOURNED",
      body: `If your name is on the list: flex. If it isn't: train. If you're already drafting a "schedule was tough" essay: we believe in you (we don't).`,
    },
  ];
  const outro = pick(outros, `${league}-${year}-outro`);

  slides.push({
    kind: "outro",
    year,
    emoji: "🎬",
    kicker: `${year} final roll call`,
    title: outro.title,
    body:
      (summaryBits.length
        ? `${summaryBits.join("  ·  ")}\n\n`
        : "") + outro.body,
    accent: "text-foreground",
    border: "border-border",
  });

  return slides;
}
