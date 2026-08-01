/**
 * Mid/late season story doors — one calm unlock at a time (like Gazette shelf).
 * No new permanent nav spam: one popup → one link.
 *
 * 1) Cut line approaching → The Board
 * 2) After cut → Trophy Room / brackets path
 */

import { getSession, getLeague } from "@/lib/league";
import { isCoreLoopUnlocked } from "@/lib/first-week";
import { cutLockWeek } from "@/lib/season-calendar";

const KEY_CUT = "warroom-story-door-cut-v1";
const KEY_TROPHY = "warroom-story-door-trophy-v1";
export const EVENT_STORY_DOORS = "warroom-story-doors";
export const EVENT_FORCE_CUT_DOOR = "warroom-force-cut-door";
export const EVENT_FORCE_TROPHY_DOOR = "warroom-force-trophy-door";

export type StoryDoorKind = "cut" | "trophy";

function canUse() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readMap(key: string): Record<string, boolean> {
  if (!canUse()) return {};
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const p = JSON.parse(raw) as Record<string, boolean>;
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

function writeMap(key: string, map: Record<string, boolean>) {
  if (!canUse()) return;
  try {
    localStorage.setItem(key, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function pid(playerId?: string | null): string | null {
  if (playerId) return playerId;
  return getSession()?.playerId || null;
}

function notify() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(EVENT_STORY_DOORS));
    window.dispatchEvent(new CustomEvent("warroom-progressive-disclosure"));
  } catch {
    /* ignore */
  }
}

export function leagueCutWeek(): number {
  return cutLockWeek(getLeague()?.sportId);
}

export function hasSeenStoryDoor(
  kind: StoryDoorKind,
  playerId?: string | null
): boolean {
  const id = pid(playerId);
  if (!id) return false;
  const key = kind === "cut" ? KEY_CUT : KEY_TROPHY;
  return !!readMap(key)[id];
}

export function markStoryDoorSeen(
  kind: StoryDoorKind,
  playerId?: string | null
): void {
  const id = pid(playerId);
  if (!id || !canUse()) return;
  const key = kind === "cut" ? KEY_CUT : KEY_TROPHY;
  const map = readMap(key);
  if (map[id]) return;
  map[id] = true;
  writeMap(key, map);
  notify();
}

/**
 * Cut line is "approaching": pack lead weeks before cut lock.
 * Short event packs use a shorter lead (pack-progressive).
 */
export function isCutLineApproaching(opts: {
  activeWeek: number;
  scoredCount: number;
  sportId?: string | null;
}): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { isCutApproachingForPack } = require("./pack-progressive") as typeof import("./pack-progressive");
    return isCutApproachingForPack(opts);
  } catch {
    const cut = cutLockWeek(opts.sportId ?? getLeague()?.sportId);
    return (
      opts.activeWeek >= cut - 2 || opts.scoredCount >= Math.max(0, cut - 2)
    );
  }
}

/** Cut has locked / playoff story is live. */
export function isPastCut(opts: {
  activeWeek: number;
  scoredCount: number;
  sportId?: string | null;
}): boolean {
  const cut = cutLockWeek(opts.sportId ?? getLeague()?.sportId);
  return opts.scoredCount >= cut || opts.activeWeek > cut;
}

export function shouldOfferCutDoor(opts: {
  activeWeek: number;
  scoredCount: number;
  playerId?: string | null;
  sportId?: string | null;
}): boolean {
  if (!isCoreLoopUnlocked(opts.playerId)) return false;
  if (hasSeenStoryDoor("cut", opts.playerId)) return false;
  // Don't show cut door after trophy era already started if they never saw cut — still show cut first
  if (!isCutLineApproaching(opts)) return false;
  return true;
}

export function shouldOfferTrophyDoor(opts: {
  activeWeek: number;
  scoredCount: number;
  playerId?: string | null;
  sportId?: string | null;
}): boolean {
  if (!isCoreLoopUnlocked(opts.playerId)) return false;
  if (hasSeenStoryDoor("trophy", opts.playerId)) return false;
  if (!isPastCut(opts)) return false;
  return true;
}

/**
 * At most one door at a time. Trophy waits if cut hasn't been seen yet
 * and cut is still the current story (approaching but not past).
 */
export function resolveStoryDoorOffer(opts: {
  activeWeek: number;
  scoredCount: number;
  playerId?: string | null;
  sportId?: string | null;
}): StoryDoorKind | null {
  // Prefer cut first if both could apply (e.g. jumped late)
  if (shouldOfferCutDoor(opts) && !isPastCut(opts)) {
    return "cut";
  }
  if (shouldOfferCutDoor(opts) && !hasSeenStoryDoor("cut", opts.playerId)) {
    // Late joiner past cut: still show cut once, then trophy next session
    if (!isPastCut(opts)) return "cut";
  }
  if (
    shouldOfferCutDoor(opts) &&
    isPastCut(opts) &&
    !hasSeenStoryDoor("cut", opts.playerId)
  ) {
    return "cut";
  }
  if (shouldOfferTrophyDoor(opts)) return "trophy";
  if (shouldOfferCutDoor(opts)) return "cut";
  return null;
}

export type StoryDoorCopy = {
  kind: StoryDoorKind;
  eyebrow: string;
  title: string;
  body: string[];
  ctaLabel: string;
  ctaHref: string;
  secondaryLabel: string;
};

export function storyDoorCopy(kind: StoryDoorKind): StoryDoorCopy {
  const cut = leagueCutWeek();
  if (kind === "cut") {
    return {
      kind: "cut",
      eyebrow: "Season story · unlocked",
      title: "The cut line is coming",
      body: [
        `After Week ${cut} is scored, the field splits: top half chase the Championship, bottom half still play for the Toilet Bowl.`,
        "The Board is where that race lives. Standings aren't just bragging rights anymore.",
      ],
      ctaLabel: "Open The Board →",
      ctaHref: "/board",
      secondaryLabel: "Got it",
    };
  }
  return {
    kind: "trophy",
    eyebrow: "Season story · unlocked",
    title: "Hardware and brackets are live",
    body: [
      "Cut is done (or the postseason is rolling). Championship and Toilet paths matter now.",
      "Trophy Room is where season hardware lives year after year. Brackets keep the story moving.",
    ],
    ctaLabel: "Open Trophy Room →",
    ctaHref: "/trophy-room",
    secondaryLabel: "Got it",
  };
}

export async function loadStoryDoorOffer(): Promise<StoryDoorKind | null> {
  try {
    const { loadLeagueActiveWeek, listScoredWeekNumbers } = await import(
      "./cloud"
    );
    const { syncFirstWeekFromCloud } = await import("./first-week");
    const id = pid();
    await syncFirstWeekFromCloud(id);
    const activeWeek = await loadLeagueActiveWeek();
    const scoredCount = (await listScoredWeekNumbers()).length;
    // Creator sandbox week override
    try {
      const { sandboxProgressiveOverrides } = await import(
        "./creator-sandbox"
      );
      const sb = sandboxProgressiveOverrides();
      if (sb) {
        return resolveStoryDoorOffer({
          activeWeek: sb.activeWeek,
          scoredCount: sb.scoredCount,
          playerId: id,
        });
      }
    } catch {
      /* ignore */
    }
    return resolveStoryDoorOffer({
      activeWeek,
      scoredCount,
      playerId: id,
    });
  } catch {
    return null;
  }
}

/** Founder one-tap force */
export function forceStoryDoor(kind: StoryDoorKind): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(
      kind === "cut" ? EVENT_FORCE_CUT_DOOR : EVENT_FORCE_TROPHY_DOOR
    )
  );
}
