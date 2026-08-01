/**
 * Creator “everyone’s eyes” — full playable preview of a given week.
 * Founder only. Local to this browser.
 *
 * - Picks use a local demo card for that week (does NOT pollute the real league)
 * - Progressive chrome matches that week (nav, Gazette shelf, simple host, etc.)
 * - You can lock picks, open Locker, Board, etc. like a real user
 *
 * - new_player: player chrome (no Run the Room)
 * - new_commissioner: simple host mode
 */

import { isAppCreator } from "@/lib/creator";
import { getSession, getLeague } from "@/lib/league";
import { setViewAsPlayer } from "@/lib/view-as-player";
import {
  clearCreatorSandbox,
  loadCreatorSandbox,
  saveCreatorSandbox,
  type SandboxPhase,
} from "@/lib/creator-sandbox";
import type { Game, Prop } from "@/lib/types";

const KEY = "warroom-creator-eyes-v1";
export const EVENT_CREATOR_EYES = "warroom-creator-eyes";

export type CreatorEyesMode = "off" | "new_player" | "new_commissioner";

function canUse() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function notify(mode: CreatorEyesMode) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent(EVENT_CREATOR_EYES, { detail: mode })
    );
    window.dispatchEvent(new CustomEvent("warroom-progressive-disclosure"));
    window.dispatchEvent(new CustomEvent("warroom-first-week-progress"));
    window.dispatchEvent(new CustomEvent("warroom-view-as-player"));
    window.dispatchEvent(new CustomEvent("warroom-creator-sandbox"));
  } catch {
    /* ignore */
  }
}

export function isCreatorEyesSession(): boolean {
  return isAppCreator(getSession()?.playerId);
}

export function getCreatorEyesMode(): CreatorEyesMode {
  if (!canUse() || !isCreatorEyesSession()) return "off";
  try {
    const v = localStorage.getItem(KEY);
    if (v === "new_player" || v === "new_commissioner") return v;
  } catch {
    /* ignore */
  }
  return "off";
}

export function isCreatorEyesActive(): boolean {
  return getCreatorEyesMode() !== "off";
}

/**
 * True when load/save week card & picks should use local eyes storage.
 *
 * PRODUCT RULE: While eyes are on, the real league is read-only for destructive
 * writes (picks, cards, scores, locker posts, current_week). You can browse any
 * page; preview data lives on this device only.
 */
export function isEyesLocalPlayActive(): boolean {
  return isCreatorEyesSession() && isCreatorEyesActive();
}

export function eyesCardStorageKey(week: number): string {
  return `warroom-eyes-card-w${week}`;
}

export function eyesPicksStorageKey(week: number): string {
  return `warroom-eyes-picks-w${week}`;
}

/** Progressive phase from week number (what a player would have unlocked). */
export function phaseForWeek(weekNumber: number): SandboxPhase {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { packProgressiveConfig } = require("./pack-progressive") as typeof import("./pack-progressive");
    const c = packProgressiveConfig(getLeague()?.sportId);
    if (weekNumber < c.gazetteMinWeek && weekNumber <= 1) return "onboarding";
    if (weekNumber < c.gazetteMinWeek) return "core";
    return "deepening";
  } catch {
    if (weekNumber <= 1) return "onboarding";
    if (weekNumber === 2) return "core";
    return "deepening";
  }
}

function scoredCountForWeek(weekNumber: number): number {
  // Pretend prior weeks already scored so shelf unlocks on pack cadence
  return Math.max(0, weekNumber - 1);
}

/**
 * Point the app at this week for eyes/sandbox play.
 * Sets progressive chrome + local active week (does not write league.current_week).
 */
export function applyEyesWeek(weekNumber: number, sportId?: "cfb" | "nfl"): void {
  const w = Math.max(0, Math.min(22, Math.floor(weekNumber)));
  const sport =
    sportId ||
    (getLeague()?.sportId === "nfl" ? "nfl" : "cfb");
  saveCreatorSandbox({
    enabled: true,
    weekNumber: w,
    scoredCount: scoredCountForWeek(w),
    phase: phaseForWeek(w),
    sportId: sport,
  });
  try {
    localStorage.setItem("warroom-active-week", String(w));
  } catch {
    /* ignore */
  }
  void ensureEyesWeekCard(w, sport);
  notify(getCreatorEyesMode());
}

/**
 * Ensure a playable 5-game card exists locally for this week (demo slate).
 * Safe for creator eyes — never writes Supabase week_cards.
 */
export async function ensureEyesWeekCard(
  weekNumber: number,
  sportId?: "cfb" | "nfl"
): Promise<void> {
  if (!canUse()) return;
  const key = eyesCardStorageKey(weekNumber);
  try {
    const existing = localStorage.getItem(key);
    if (existing) {
      const p = JSON.parse(existing) as { games?: Game[] };
      if (p.games?.length === 5) return;
    }
  } catch {
    /* rebuild */
  }

  const sport =
    sportId ||
    (getLeague()?.sportId === "nfl" ? "nfl" : "cfb");
  const { generateDemoSlate } = await import("./demo-slate");
  const { propFromPreset, rotatingPropPreset } = await import("./prop-presets");
  const games = generateDemoSlate(weekNumber, 5, sport);
  // Kickoffs ~3 days out so card is still open for locking
  const base = Date.now() + 3 * 24 * 3600 * 1000;
  const stamped = games.map((g, i) => {
    const t = new Date(base + i * 3600 * 1000);
    return {
      ...g,
      commenceTime: t.toISOString(),
      startTime: t.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
        timeZone: "America/New_York",
      }),
    };
  });
  const prop: Prop = propFromPreset(
    rotatingPropPreset(weekNumber, sport),
    weekNumber
  );
  const payload = {
    games: stamped,
    prop,
    weekNumber,
    eyes: true,
  };
  try {
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function loadEyesLocalCard(weekNumber: number): {
  games: Game[];
  prop: Prop;
  weekNumber: number;
} | null {
  if (!canUse()) return null;
  try {
    const raw = localStorage.getItem(eyesCardStorageKey(weekNumber));
    if (!raw) return null;
    const data = JSON.parse(raw) as {
      games?: Game[];
      prop?: Prop;
      weekNumber?: number;
    };
    if (!data.games?.length) return null;
    return {
      games: data.games,
      prop: data.prop || {
        id: `prop-w${weekNumber}`,
        question: "Bonus pick",
        options: ["Yes", "No"],
        points: 3,
      },
      weekNumber: data.weekNumber ?? weekNumber,
    };
  } catch {
    return null;
  }
}

/**
 * Enter / exit eyes mode.
 * @param weekNumber — which season week to live as (default 1)
 */
export function setCreatorEyesMode(
  mode: CreatorEyesMode,
  opts?: { weekNumber?: number; sportId?: "cfb" | "nfl" }
): void {
  if (!canUse()) return;
  if (!isCreatorEyesSession() && mode !== "off") return;

  try {
    if (mode === "off") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, mode);
  } catch {
    /* ignore */
  }

  const week = opts?.weekNumber ?? 1;

  if (mode === "new_player") {
    applyEyesWeek(week, opts?.sportId);
    setViewAsPlayer(true);
  } else if (mode === "new_commissioner") {
    applyEyesWeek(week, opts?.sportId);
    setViewAsPlayer(false);
  } else {
    clearCreatorSandbox();
    setViewAsPlayer(false);
  }

  notify(mode);
}

export function creatorEyesLabel(mode: CreatorEyesMode = getCreatorEyesMode()): string {
  switch (mode) {
    case "new_player":
      return "NEW PLAYER EYES";
    case "new_commissioner":
      return "NEW COMMISSIONER EYES";
    default:
      return "";
  }
}

export function creatorEyesBlurb(mode: CreatorEyesMode): string {
  const w = loadCreatorSandbox().weekNumber;
  switch (mode) {
    case "new_player":
      return `Playing as a new player on week ${w} · local demo card · lock picks for real UX`;
    case "new_commissioner":
      return `Hosting as a new commissioner on week ${w} · simple Run the Room`;
    default:
      return "Normal creator view";
  }
}

/**
 * First-hour sim: wipe local eyes picks, start week 0, onboarding chrome.
 * "What does a brand-new player actually see?"
 */
export function startFirstHourAsNewPlayer(opts?: {
  sportId?: "cfb" | "nfl";
}): void {
  if (!canUse() || !isCreatorEyesSession()) return;
  try {
    // Clear prior eyes slips so the card feels new
    for (let w = 0; w <= 22; w++) {
      localStorage.removeItem(eyesPicksStorageKey(w));
      localStorage.removeItem(eyesCardStorageKey(w));
    }
  } catch {
    /* ignore */
  }
  setCreatorEyesMode("new_player", {
    weekNumber: 0,
    sportId: opts?.sportId,
  });
  try {
    // Force progressive onboarding chrome for this session
    localStorage.setItem("warroom-show-full-room-v1", "{}");
  } catch {
    /* ignore */
  }
}

/**
 * First-hour host sim: simple Run the Room, week 0, no deep tools.
 */
export function startFirstHourAsNewCommissioner(opts?: {
  sportId?: "cfb" | "nfl";
}): void {
  if (!canUse() || !isCreatorEyesSession()) return;
  try {
    for (let w = 0; w <= 22; w++) {
      localStorage.removeItem(eyesPicksStorageKey(w));
      localStorage.removeItem(eyesCardStorageKey(w));
    }
  } catch {
    /* ignore */
  }
  setCreatorEyesMode("new_commissioner", {
    weekNumber: 0,
    sportId: opts?.sportId,
  });
  try {
    localStorage.setItem("warroom-show-full-room-v1", "{}");
  } catch {
    /* ignore */
  }
}
