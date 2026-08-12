/**
 * Pre-season demo: trial bots drop shit-talk in Locker Room
 * so badges / unseen counts / the board feel alive.
 * Not real season history — smoke the system.
 */

import { createClient } from "@/lib/supabase/client";
import { getSession, getLeague } from "@/lib/league";
import { loadLeagueRoster } from "@/lib/cloud";
import { isPreseasonCommishToolsAllowed } from "@/lib/season-mode";

type PostSpec = {
  user_id: string;
  body: string;
  /** Stagger for a live board (older → newer unread feel) */
  minutes_ago: number;
};

function mulberry(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Campus Saturday energy */
const CFB_LINES: ((week: number, label: string) => string)[] = [
  (w, L) => `Week ${w} card is up. If you ghost ${L} I'm putting you on the milk carton.`,
  (w) => `Hot take: someone in this room is 0-for-Week-${w} and still talking. Respect.`,
  () => `Lock before kickoff or the student section will remember.`,
  (w) => `Best Bet season is a personality. Week ${w} will expose you.`,
  () => `Who faded the dog that "spoke to them"? Raise your hand. Don't.`,
  (w) => `The Dispatch is loading. Week ${w} crown is about to get loud.`,
  () => `Toilet Bowl scouting report: accepting applications all season.`,
  () => `Confidence 5 on a 3-score dog is campus chaos not a plan 💀`,
  (w) => `If you didn't lock Week ${w} yet… what are we even doing here.`,
  () => `Portal energy in the standings. Somebody transfer to relevance.`,
  () => `I didn't come here to mid. I came here to roast.`,
  (w) => `Week ${w} prop is free money or free shame. No in-between.`,
  () => `Ranked or not your zero still counts 🤡`,
  () => `Group chat is already lying about their card. Locker doesn't lie.`,
  () => `Saturday starts when the card locks. Not when you "meant to."`,
];

/** Primetime Sunday energy */
const NFL_LINES: ((week: number, label: string) => string)[] = [
  (w, L) => `Week ${w} is live. Late window doesn't care about your ${L} excuses.`,
  (w) => `Film don't lie. Week ${w} cards will.`,
  () => `Lock before kickoff or you're just spectating yourself for free.`,
  (w) => `Best Bet is double-or-nothing with witnesses. Week ${w} receipts coming.`,
  () => `Any given Sunday is not a strategy. It's a cope.`,
  (w) => `Primetime desk is open. Week ${w} crown wants a name.`,
  () => `Three-and-out energy already circulating. Don't be the package.`,
  () => `Red zone dignity: optional. Locking: not optional.`,
  (w) => `If your Week ${w} card needs a challenge flag, you're cooked.`,
  () => `Toilet Bowl still matters. Mid-pack is just longer suffering.`,
  () => `Scripted the board in my head. Reality has other plans 🔥`,
  (w) => `Week ${w} prop merchants stand up. Fraud watch is live.`,
  () => `TNF scars last. MNF scars get screenshots.`,
  () => `I fade chalk for sport. Sometimes sport fades me back.`,
  () => `Sunday Scaries? That's just this room after scoring.`,
];

function bankForSport(sportId?: string | null) {
  return sportId === "nfl" ? NFL_LINES : CFB_LINES;
}

/**
 * Build staggered posts from bot roster + week flavor.
 */
export function buildBotLockerPosts(opts: {
  botUserIds: string[];
  weekNumber: number;
  weekLabel?: string;
  sportId?: string | null;
  /** How many posts (default 6–10) */
  count?: number;
}): PostSpec[] {
  const bots = opts.botUserIds.filter(Boolean);
  if (!bots.length) return [];

  const week = Math.max(0, Math.floor(opts.weekNumber));
  const label = opts.weekLabel || `Week ${week}`;
  const bank = bankForSport(opts.sportId);
  const want = Math.min(
    opts.count ?? 8,
    Math.max(4, Math.min(12, bots.length * 2))
  );

  const rand = mulberry(1009 + week * 7919 + bots.length * 13);
  const usedLine = new Set<number>();
  const posts: PostSpec[] = [];

  for (let i = 0; i < want; i++) {
    let li = Math.floor(rand() * bank.length);
    let guard = 0;
    while (usedLine.has(li) && guard++ < 40) {
      li = Math.floor(rand() * bank.length);
    }
    usedLine.add(li);
    const body = bank[li](week, label).slice(0, 280);
    const bot = bots[Math.floor(rand() * bots.length)];
    // Stagger: oldest ~3h ago → newest ~2 min ago (unread badge fuel)
    const minutes_ago = Math.max(2, Math.round(180 - (i * 180) / Math.max(1, want - 1) + rand() * 12));
    posts.push({ user_id: bot, body, minutes_ago });
  }

  // Newest last in insert order isn't required; minutes_ago handles sort
  return posts;
}

export async function seedBotLockerTalk(opts?: {
  weekNumber?: number;
  weekLabel?: string;
  sportId?: string | null;
  count?: number;
  /** Skip preseason gate (internal) */
  force?: boolean;
}): Promise<{
  ok: boolean;
  inserted?: number;
  skipped?: number;
  error?: string;
}> {
  const session = getSession();
  if (!session?.leagueId || !session.isCommissioner) {
    return { ok: false, error: "Commissioner only" };
  }

  if (!opts?.force) {
    try {
      if (!isPreseasonCommishToolsAllowed()) {
        return {
          ok: false,
          error:
            "Bot locker talk is a pre-season demo tool (same gate as trial bots).",
        };
      }
    } catch {
      /* allow */
    }
  }

  const roster = await loadLeagueRoster();
  const bots = roster.filter((m) => m.isBot).map((m) => m.userId);
  if (!bots.length) {
    return {
      ok: false,
      error: "No trial bots in the league yet. Pad with bots first.",
    };
  }

  const sportId =
    opts?.sportId ?? getLeague()?.sportId ?? "cfb";
  const weekNumber =
    opts?.weekNumber ??
    (() => {
      try {
        const raw = localStorage.getItem("warroom-active-week");
        return raw != null ? parseInt(raw, 10) || 1 : 1;
      } catch {
        return 1;
      }
    })();

  const posts = buildBotLockerPosts({
    botUserIds: bots,
    weekNumber,
    weekLabel: opts?.weekLabel,
    sportId,
    count: opts?.count,
  });

  if (!posts.length) {
    return { ok: false, error: "Nothing to post" };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("seed_bot_locker_talk", {
    p_league_id: session.leagueId,
    p_posts: posts,
  });

  if (error) {
    const msg = error.message || "RPC failed";
    if (/does not exist|schema cache|seed_bot_locker/i.test(msg)) {
      return {
        ok: false,
        error:
          "Run supabase/bot-locker-sim.sql in Supabase SQL Editor once (bot locker seed).",
      };
    }
    return { ok: false, error: msg };
  }

  const row = (data || {}) as {
    ok?: boolean;
    inserted?: number;
    skipped?: number;
    error?: string;
  };
  if (row.ok === false) {
    return { ok: false, error: row.error || "seed_bot_locker_talk failed" };
  }

  return {
    ok: true,
    inserted: row.inserted ?? posts.length,
    skipped: row.skipped ?? 0,
  };
}
