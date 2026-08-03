/**
 * Foundry testing — when you’re in the lab, ceremonies must actually fire.
 * First-hour “eyes” sims stay quiet on purpose; Foundry sticky + post/score does not.
 */

import { isAppCreator } from "@/lib/creator";
import { getSession } from "@/lib/league";

export const EVENT_FORCE_GAZETTE_PAPER = "warroom-force-gazette-paper";
export const EVENT_FORCE_BADGE_CHECK = "warroom-force-badge-check";

const FOUNDRY_STICKY = "warroom-foundry-session-v1";

export function isFoundrySessionSticky(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(FOUNDRY_STICKY) === "1";
  } catch {
    return false;
  }
}

/**
 * Demo slate / randomize & score / auto-score — creator backstage only.
 * Regular hosts: Pull Odds → publish → Sync scores. Never lab / hop / shop UI.
 *
 * Constitution: customers should never know Foundry exists.
 * Only the app creator may see these tools (even when sticky/eyes are on).
 */
export function showCommishLabTools(): boolean {
  if (typeof window === "undefined") return false;
  const uid = getSession()?.playerId;
  // Hard gate: UUID creator only — no sticky/eyes bypass for non-creators
  return isAppCreator(uid);
}

/** True only for the app creator — customer product never treats this as on. */
export function isFoundryBackstageUser(
  userId?: string | null
): boolean {
  if (typeof window === "undefined") return false;
  return isAppCreator(userId ?? getSession()?.playerId);
}

/**
 * Allow Gazette / cheevo / ceremony popups while testing Foundry.
 * Quiet first-hour eyes (new player / new host) stay calm.
 */
export function allowFoundryCeremonies(): boolean {
  if (typeof window === "undefined") return false;
  const uid = getSession()?.playerId;
  if (!isAppCreator(uid)) return false;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const eyes = require("./creator-eyes") as typeof import("./creator-eyes");
    if (eyes.isCreatorEyesActive()) return false;
  } catch {
    /* ok */
  }

  // Foundry sticky only — Creator Test Mode / sandbox knobs retired
  return isFoundrySessionSticky();
}

/**
 * After Foundry post/score — open the real drama path so you can see
 * Gazette + cheevos like a live room (not stuck in pre-lock calm).
 */
export async function prepareFoundryDramaAfterScore(
  weekNumber: number
): Promise<{ ok: boolean; message: string }> {
  const session = getSession();
  if (!session?.playerId || !session.leagueId) {
    return { ok: false, message: "No session" };
  }
  if (!isAppCreator(session.playerId)) {
    return { ok: false, message: "Creator only" };
  }

  try {
    // Sticky Foundry session (← Foundry bar)
    try {
      localStorage.setItem(FOUNDRY_STICKY, "1");
      window.dispatchEvent(new CustomEvent("warroom-foundry-session"));
    } catch {
      /* ok */
    }

    // Exit quiet first-hour gates
    const fw = await import("./first-week");
    fw.markHasLockedPicksOnce(session.playerId);
    fw.markSeasonComeAlive(session.playerId);

    const rules = await import("./rules");
    rules.markRulesSeen();

    // Clear “already read” so paper can pop again for this week
    try {
      const { clearGazetteSeenForWeek } = await import("./gazette");
      clearGazetteSeenForWeek(session.leagueId, weekNumber);
    } catch {
      /* ok */
    }

    // Build + archive paper so offer has something to show
    try {
      const { loadLeaguePlayers } = await import("./cloud");
      const {
        buildGazetteEdition,
        archiveGazetteEdition,
      } = await import("./gazette");
      const players = await loadLeaguePlayers();
      const edition = await buildGazetteEdition(players);
      if (edition) {
        await archiveGazetteEdition(edition);
      }
    } catch {
      /* paper may still build client-side from weekly points */
    }

    // Real progressive signals only — no Creator Test Mode knobs
    try {
      const pd = await import("./progressive-disclosure");
      if (weekNumber >= 3) {
        pd.markGazetteShelfRevealSeen(session.playerId);
      }
      pd.invalidateProgressiveSnapshot();
    } catch {
      /* ok */
    }

    window.dispatchEvent(new CustomEvent("warroom-progressive-disclosure"));
    window.dispatchEvent(new CustomEvent("warroom-first-week-progress"));
    window.dispatchEvent(new CustomEvent(EVENT_FORCE_GAZETTE_PAPER));
    window.dispatchEvent(new CustomEvent(EVENT_FORCE_BADGE_CHECK));

    return {
      ok: true,
      message: "Drama unlocked — Gazette + cheevos can fire",
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Foundry drama prep failed",
    };
  }
}

/** Force-show paper / cheevos from Foundry “Flash a moment” buttons. */
export async function forceFoundryGazetteAndCheevos(): Promise<void> {
  const session = getSession();
  if (!session?.playerId) return;
  let week = 1;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const eyes = require("./creator-eyes") as typeof import("./creator-eyes");
    if (eyes.isEyesLocalPlayActive()) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const sb = require("./creator-sandbox") as typeof import("./creator-sandbox");
      week = sb.loadCreatorSandbox().weekNumber || 1;
    } else {
      const raw = localStorage.getItem("warroom-active-week");
      const n = raw != null ? parseInt(raw, 10) : 1;
      if (!Number.isNaN(n)) week = n;
    }
  } catch {
    week = 1;
  }
  await prepareFoundryDramaAfterScore(week);
}
