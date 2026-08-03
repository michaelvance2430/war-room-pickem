/**
 * Persistent coaching flags — per user × league × key.
 * Local-first (same pattern as progressive / first-week). Uniqueness is logical.
 */

import { getSession, getLeague } from "@/lib/league";
import type { CoachKey } from "./keys";

const STORAGE_KEY = "warroom-coaching-flags-v1";
export const EVENT_COACHING = "warroom-coaching";

export type CoachRecord = {
  shown_at?: string | null;
  dismissed_at?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
};

/** userId → scopeId ("_account" | leagueId) → coachKey → record */
type Store = Record<string, Record<string, Record<string, CoachRecord>>>;

function canUse() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readStore(): Store {
  if (!canUse()) return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as Store;
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

function writeStore(s: Store) {
  if (!canUse()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent(EVENT_COACHING));
  } catch {
    /* ignore */
  }
}

export function accountScopeId(): string {
  return "_account";
}

export function resolveUserId(userId?: string | null): string | null {
  if (userId) return userId;
  return getSession()?.playerId || null;
}

export function resolveLeagueScope(leagueId?: string | null): string | null {
  if (leagueId) return leagueId;
  return getLeague()?.id || getSession()?.leagueId || null;
}

export function getCoachRecord(
  key: CoachKey,
  opts?: { userId?: string | null; leagueId?: string | null; accountWide?: boolean }
): CoachRecord | null {
  const uid = resolveUserId(opts?.userId);
  if (!uid) return null;
  const scope = opts?.accountWide
    ? accountScopeId()
    : resolveLeagueScope(opts?.leagueId);
  if (!scope) return null;
  return readStore()[uid]?.[scope]?.[key] || null;
}

function patchRecord(
  key: CoachKey,
  patch: Partial<CoachRecord>,
  opts?: { userId?: string | null; leagueId?: string | null; accountWide?: boolean }
): CoachRecord | null {
  const uid = resolveUserId(opts?.userId);
  if (!uid || !canUse()) return null;
  const scope = opts?.accountWide
    ? accountScopeId()
    : resolveLeagueScope(opts?.leagueId);
  if (!scope) return null;
  const store = readStore();
  if (!store[uid]) store[uid] = {};
  if (!store[uid][scope]) store[uid][scope] = {};
  const prev = store[uid][scope][key] || {};
  const next: CoachRecord = {
    ...prev,
    ...patch,
    created_at: prev.created_at || new Date().toISOString(),
  };
  store[uid][scope][key] = next;
  writeStore(store);
  return next;
}

/** Still eligible to offer (not completed, not dismissed). */
export function isCoachOpen(
  key: CoachKey,
  opts?: { userId?: string | null; leagueId?: string | null; accountWide?: boolean }
): boolean {
  const r = getCoachRecord(key, opts);
  if (!r) return true;
  if (r.completed_at) return false;
  if (r.dismissed_at) return false;
  return true;
}

export function markCoachShown(
  key: CoachKey,
  opts?: { userId?: string | null; leagueId?: string | null }
): void {
  const r = getCoachRecord(key, opts);
  if (r?.shown_at) return;
  patchRecord(key, { shown_at: new Date().toISOString() }, opts);
}

/** User closed it — do not nag again (launch rule: permanent dismiss). */
export function markCoachDismissed(
  key: CoachKey,
  opts?: { userId?: string | null; leagueId?: string | null }
): void {
  patchRecord(key, { dismissed_at: new Date().toISOString() }, opts);
}

/** Real task succeeded — never set from display alone. */
export function markCoachCompleted(
  key: CoachKey,
  opts?: { userId?: string | null; leagueId?: string | null }
): void {
  const r = getCoachRecord(key, opts);
  if (r?.completed_at) return;
  patchRecord(key, { completed_at: new Date().toISOString() }, opts);
}

/** Admin / Foundry: clear one key for this league (or account). */
export function resetCoachKey(
  key: CoachKey,
  opts?: { userId?: string | null; leagueId?: string | null; accountWide?: boolean }
): void {
  const uid = resolveUserId(opts?.userId);
  if (!uid || !canUse()) return;
  const scope = opts?.accountWide
    ? accountScopeId()
    : resolveLeagueScope(opts?.leagueId);
  if (!scope) return;
  const store = readStore();
  if (store[uid]?.[scope]?.[key]) {
    delete store[uid][scope][key];
    writeStore(store);
  }
}

/** Admin: wipe all league-scoped coaching for current user + league. */
export function resetAllCoachingForLeague(
  opts?: { userId?: string | null; leagueId?: string | null }
): void {
  const uid = resolveUserId(opts?.userId);
  const leagueId = resolveLeagueScope(opts?.leagueId);
  if (!uid || !leagueId || !canUse()) return;
  const store = readStore();
  if (store[uid]?.[leagueId]) {
    delete store[uid][leagueId];
    writeStore(store);
  }
}

export function resetCommissionerCoaching(opts?: {
  userId?: string | null;
  leagueId?: string | null;
}): void {
  const keys: CoachKey[] = [
    "coach_commissioner_build_first_card",
    "coach_commissioner_publish_first_card",
    "coach_commissioner_invite_members",
  ];
  for (const key of keys) resetCoachKey(key, opts);
}

export function resetPlayerCoaching(opts?: {
  userId?: string | null;
  leagueId?: string | null;
}): void {
  const keys: CoachKey[] = [
    "coach_player_make_first_picks",
    "coach_player_submit_first_picks",
    "coach_player_view_first_results",
  ];
  for (const key of keys) resetCoachKey(key, opts);
}
