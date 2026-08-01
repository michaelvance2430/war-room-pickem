/**
 * One fake practice week before Week 0 kickoff.
 * Re-do as many times as you want. Dies when opening week starts.
 */

import { getLeague, getSession, isOps } from "@/lib/league";
import { hasOpeningWeekStarted } from "@/lib/ring-ceremony";
import { firstSeasonWeek } from "@/lib/season-calendar";
import { isPreseasonCommishToolsAllowed, isSandboxMode } from "@/lib/season-mode";

const ACTIVE_KEY = "warroom-bored-practice-active-v1";
const PENDING_DONE_KEY = "warroom-bored-practice-pending-done-v1";
export const EVENT_BORED_PRACTICE_DONE = "warroom-bored-practice-done";

export type BoredPracticeState = {
  leagueId: string;
  weekNumber: number;
  /** Bump on each re-run so we don't show stale done modals */
  runId: number;
  startedAt: string;
};

function canUse() {
  return typeof window !== "undefined";
}

function readActive(): BoredPracticeState | null {
  if (!canUse()) return null;
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BoredPracticeState;
  } catch {
    return null;
  }
}

function writeActive(s: BoredPracticeState | null) {
  if (!canUse()) return;
  try {
    if (!s) localStorage.removeItem(ACTIVE_KEY);
    else localStorage.setItem(ACTIVE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** Practice button / mode only before opening week kickoff. */
export function isBoredPracticeWindowOpen(sportId?: string | null): boolean {
  const sid = sportId ?? getLeague()?.sportId;
  if (hasOpeningWeekStarted(sid)) return false;
  // Prefer preseason sandbox, but allow anytime before Week 0 calendar
  return true;
}

export function getBoredPracticeState(): BoredPracticeState | null {
  const s = readActive();
  if (!s) return null;
  const lid = getLeague()?.id;
  if (lid && s.leagueId !== lid) return null;
  if (!isBoredPracticeWindowOpen()) {
    writeActive(null);
    return null;
  }
  return s;
}

export function isBoredPracticeActive(): boolean {
  return !!getBoredPracticeState();
}

export function markBoredPracticeStarted(weekNumber: number): BoredPracticeState {
  const leagueId = getLeague()?.id || "local";
  const prev = readActive();
  const next: BoredPracticeState = {
    leagueId,
    weekNumber,
    runId: (prev?.runId || 0) + 1,
    startedAt: new Date().toISOString(),
  };
  writeActive(next);
  try {
    sessionStorage.removeItem(PENDING_DONE_KEY);
  } catch {
    /* ok */
  }
  return next;
}

/** True when anyone in the league may auto-score this practice week. */
export function isBoredPracticeScoringAllowed(): boolean {
  if (!isBoredPracticeActive()) return false;
  if (!isBoredPracticeWindowOpen()) return false;
  if (!getSession()?.leagueId) return false;
  // Preseason dry-run tools OR calendar still before Week 0
  return isSandboxMode() || isPreseasonCommishToolsAllowed() || isOps();
}

export function queueBoredPracticeDoneModal(runId?: number) {
  if (!canUse()) return;
  const active = getBoredPracticeState();
  try {
    sessionStorage.setItem(
      PENDING_DONE_KEY,
      JSON.stringify({
        at: Date.now(),
        runId: runId ?? active?.runId ?? 0,
        weekNumber: active?.weekNumber ?? firstSeasonWeek(getLeague()?.sportId),
      })
    );
    window.dispatchEvent(new CustomEvent(EVENT_BORED_PRACTICE_DONE));
  } catch {
    /* ignore */
  }
}

export function takeBoredPracticeDoneModal(): {
  weekNumber: number;
  runId: number;
} | null {
  if (!canUse()) return null;
  try {
    const raw = sessionStorage.getItem(PENDING_DONE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_DONE_KEY);
    const p = JSON.parse(raw) as {
      weekNumber?: number;
      runId?: number;
      at?: number;
    };
    if (p.at && Date.now() - p.at > 30 * 60_000) return null;
    return {
      weekNumber: p.weekNumber ?? firstSeasonWeek(getLeague()?.sportId),
      runId: p.runId ?? 0,
    };
  } catch {
    return null;
  }
}

export function peekBoredPracticeDoneModal(): boolean {
  if (!canUse()) return false;
  try {
    return !!sessionStorage.getItem(PENDING_DONE_KEY);
  } catch {
    return false;
  }
}
