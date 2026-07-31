/**
 * First-time commissioner guidance — setup spine until first week is scored.
 */

const KEY = "warroom-commish-setup-v1";

export type CommishSetupFlags = {
  hostScreenSeen?: boolean;
  inviteCopied?: boolean;
  firstCardPublished?: boolean;
  practiceWeekDone?: boolean;
  graduated?: boolean;
};

type Store = Record<string, CommishSetupFlags>;

function canUse() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readAll(): Store {
  if (!canUse()) return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as Store;
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

function writeAll(s: Store) {
  if (!canUse()) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function getCommishSetup(leagueId: string): CommishSetupFlags {
  if (!leagueId) return {};
  return readAll()[leagueId] || {};
}

export function patchCommishSetup(
  leagueId: string,
  patch: Partial<CommishSetupFlags>
) {
  if (!leagueId) return;
  const all = readAll();
  all[leagueId] = { ...(all[leagueId] || {}), ...patch };
  writeAll(all);
}

export function markHostScreenSeen(leagueId: string) {
  patchCommishSetup(leagueId, { hostScreenSeen: true });
}

export function markInviteCopied(leagueId: string) {
  patchCommishSetup(leagueId, { inviteCopied: true });
}

export function markFirstCardPublished(leagueId: string) {
  patchCommishSetup(leagueId, { firstCardPublished: true });
}

export function markPracticeWeekDone(leagueId: string) {
  patchCommishSetup(leagueId, { practiceWeekDone: true });
}

export function markCommishGraduated(leagueId: string) {
  patchCommishSetup(leagueId, { graduated: true });
}

/**
 * First-time mode until they've scored a real week (or we mark graduated).
 * scoredWeeks from cloud wins over local flags.
 */
export function isFirstTimeCommish(opts: {
  leagueId: string;
  scoredWeekCount: number;
}): boolean {
  if (!opts.leagueId) return false;
  if (opts.scoredWeekCount > 0) {
    markCommishGraduated(opts.leagueId);
    return false;
  }
  const f = getCommishSetup(opts.leagueId);
  if (f.graduated) return false;
  return true;
}

/** Deep link that lands friends on join with code pre-filled. */
export function buildInviteJoinUrl(opts: {
  code: string;
  appUrl?: string;
}): string {
  const code = (opts.code || "").trim().toUpperCase();
  const base =
    opts.appUrl ||
    (typeof window !== "undefined" ? window.location.origin : "");
  if (!base || !code) return code ? `/join?code=${encodeURIComponent(code)}` : "";
  return `${base.replace(/\/$/, "")}/join?code=${encodeURIComponent(code)}`;
}

/**
 * SMS / chat paste — link first so one tap opens the app with the code.
 */
export function buildInviteShareText(opts: {
  leagueName: string;
  code: string;
  appUrl?: string;
}): string {
  const code = (opts.code || "").trim().toUpperCase();
  const joinUrl = buildInviteJoinUrl({ code, appUrl: opts.appUrl });
  return [
    `You're in the War Room: ${opts.leagueName}`,
    "",
    joinUrl
      ? `Join here (code already filled in):\n${joinUrl}`
      : `Join code: ${code}`,
    code ? `Code if you need it: ${code}` : null,
    "",
    "Create an account if you don't have one, then lock picks before first kickoff.",
    "Don't ghost Saturday.",
  ]
    .filter(Boolean)
    .join("\n");
}

const PENDING_CODE_KEY = "warroom-pending-join-code";

/** Persist code across login → join (deep link). */
export function stashPendingJoinCode(code: string) {
  if (typeof window === "undefined") return;
  const c = (code || "").trim().toUpperCase();
  if (!c) return;
  try {
    sessionStorage.setItem(PENDING_CODE_KEY, c);
  } catch {
    /* ignore */
  }
}

export function takePendingJoinCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const c = sessionStorage.getItem(PENDING_CODE_KEY);
    if (c) sessionStorage.removeItem(PENDING_CODE_KEY);
    return c ? c.toUpperCase() : null;
  } catch {
    return null;
  }
}

export function peekPendingJoinCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(PENDING_CODE_KEY)?.toUpperCase() || null;
  } catch {
    return null;
  }
}

/**
 * One-tap invite: native share sheet when available, else copy.
 * Returns what happened for UI toast.
 */
export async function shareLeagueInvite(opts: {
  leagueName: string;
  code: string;
  appUrl?: string;
}): Promise<"shared" | "copied" | "failed"> {
  const text = buildInviteShareText(opts);
  const url = buildInviteJoinUrl(opts);
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({
        title: `War Room: ${opts.leagueName}`,
        text,
        url: url || undefined,
      });
      return "shared";
    }
  } catch (e: unknown) {
    // User cancelled share — not a hard fail
    if (e instanceof Error && /Abort|cancel/i.test(e.message)) {
      return "failed";
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
