/**
 * Host Dashboard view-model helpers (frozen IA).
 * Hero is never a summary — one priority action only.
 */

import type { Game } from "./types";
import type { PickSubmissionStatus } from "./cloud";
import { formatKickoff } from "./dates";
import { weekTitle } from "./dates";

export type ThisWeekStatus = "draft" | "live" | "needs_score" | "scored";

export type HostHeroPriority = 1 | 2 | 3 | 4;

export type HostHeroId =
  | "H_BLOCK_NO_CARD"
  | "H_BLOCK_NEEDS_SCORE"
  | "H_ATTN_HOLDOUTS"
  | "H_ATTN_INVITES"
  | "H_CELEB_ALL_LOCKED"
  | "H_CELEB_SCORED"
  | "H_QUIET_COUNTDOWN"
  | "H_QUIET_HEALTHY";

export type HostHeroAction =
  | "publish_card"
  | "score_week"
  | "nudge_holdouts"
  | "share_invite"
  | "preview_player"
  | "open_standings"
  | "open_gazette"
  | "none";

export type HostHeroState = {
  id: HostHeroId;
  priority: HostHeroPriority;
  /** Tone for chrome */
  tone: "blocked" | "attention" | "celebrate" | "quiet";
  title: string;
  detail?: string;
  action: HostHeroAction;
  actionLabel: string | null;
};

export type ThisWeekViewModel = {
  weekNumber: number;
  weekLabel: string;
  sportId: string;
  status: ThisWeekStatus;
  published: boolean;
  gameCount: number;
  propQuestion: string | null;
  firstKickoffLabel: string | null;
  kickoffCountdown: string | null;
  completeLocks: number;
  expectedLocks: number;
  missingNames: string[];
  allHumansLocked: boolean;
  canEdit: boolean;
  canPreview: boolean;
  canScore: boolean;
};

export type HostDashboardInput = {
  weekNumber: number;
  sportId?: string | null;
  publishedGames: Game[];
  propQuestion?: string | null;
  scoredWeeks: number[];
  pickStatus: PickSubmissionStatus[];
  /** Non-bot roster size if known */
  humanRosterCount?: number | null;
  /** First-time / thin room — invite still critical */
  inviteCritical?: boolean;
};

function earliestKickoff(games: Game[]): string | null {
  let best: number | null = null;
  let iso: string | null = null;
  for (const g of games) {
    const raw = g.commenceTime || g.startTime;
    if (!raw) continue;
    const t = new Date(raw).getTime();
    if (Number.isNaN(t)) continue;
    if (best == null || t < best) {
      best = t;
      iso = g.commenceTime || null;
    }
  }
  return iso;
}

function allKickoffsPast(games: Game[], now = Date.now()): boolean {
  if (!games.length) return false;
  let any = false;
  for (const g of games) {
    const raw = g.commenceTime;
    if (!raw) continue;
    const t = new Date(raw).getTime();
    if (Number.isNaN(t)) continue;
    any = true;
    if (t > now) return false;
  }
  return any;
}

function countdownLabel(iso: string | null, now = Date.now()): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const ms = t - now;
  if (ms <= 0) return "Kickoff has started";
  const h = Math.floor(ms / 3_600_000);
  const d = Math.floor(h / 24);
  if (d >= 2) return `${d} days to first kickoff`;
  if (h >= 24) return `About ${d || 1} day to first kickoff`;
  if (h >= 2) return `${h} hours to first kickoff`;
  const m = Math.max(1, Math.floor(ms / 60_000));
  return `${m} minutes to first kickoff`;
}

export function buildThisWeekViewModel(input: HostDashboardInput): ThisWeekViewModel {
  const published = input.publishedGames.length > 0;
  const scored = input.scoredWeeks.includes(input.weekNumber);
  const finalsReady = published && allKickoffsPast(input.publishedGames);
  let status: ThisWeekStatus = "draft";
  if (scored) status = "scored";
  else if (finalsReady) status = "needs_score";
  else if (published) status = "live";

  const pool = input.pickStatus;
  const complete = pool.filter((r) => r.complete).length;
  const expected =
    pool.length ||
    (input.humanRosterCount != null && input.humanRosterCount > 0
      ? input.humanRosterCount
      : 0);
  const missing = pool
    .filter((r) => !r.complete)
    .map((r) => r.name || "Someone")
    .filter(Boolean);
  const kickIso = earliestKickoff(input.publishedGames);
  const kickFmt = kickIso ? formatKickoff(kickIso).full : null;

  return {
    weekNumber: input.weekNumber,
    weekLabel: weekTitle(input.weekNumber, input.sportId),
    sportId: input.sportId || "cfb",
    status,
    published,
    gameCount: input.publishedGames.length,
    propQuestion: input.propQuestion?.trim() || null,
    firstKickoffLabel: kickFmt,
    kickoffCountdown: countdownLabel(kickIso),
    completeLocks: complete,
    expectedLocks: expected,
    missingNames: missing,
    allHumansLocked: expected > 0 && complete >= expected && missing.length === 0,
    canEdit: !scored,
    canPreview: published,
    canScore: published && !scored,
  };
}

/**
 * Single most important thing right now.
 * Priority: blocked → attention → celebrate → quiet.
 */
export function resolveHostHero(vm: ThisWeekViewModel, opts?: {
  inviteCritical?: boolean;
  humanRosterCount?: number | null;
}): HostHeroState {
  const inviteCritical =
    !!opts?.inviteCritical ||
    (opts?.humanRosterCount != null && opts.humanRosterCount < 3);

  // 1 🚨 Blocked
  if (vm.status === "draft" || !vm.published) {
    return {
      id: "H_BLOCK_NO_CARD",
      priority: 1,
      tone: "blocked",
      title: "Friends can’t pick until there’s a card.",
      detail: `${vm.weekLabel} still needs a published slate.`,
      action: "publish_card",
      actionLabel: "Publish this week’s card →",
    };
  }
  if (vm.status === "needs_score") {
    return {
      id: "H_BLOCK_NEEDS_SCORE",
      priority: 1,
      tone: "blocked",
      title: "Games are final. Time to crown this week’s winner.",
      detail: "Everyone’s waiting to see who won.",
      action: "score_week",
      actionLabel: "Score this week →",
    };
  }

  // 2 ⚠️ Attention
  if (vm.status === "live" && vm.missingNames.length > 0) {
    const one = vm.missingNames.length === 1;
    return {
      id: "H_ATTN_HOLDOUTS",
      priority: 2,
      tone: "attention",
      title: one
        ? `${vm.missingNames[0]} still hasn’t submitted picks.`
        : `${vm.missingNames.length} players still haven’t locked.`,
      detail: vm.firstKickoffLabel
        ? `First kickoff ${vm.firstKickoffLabel}.`
        : undefined,
      action: "nudge_holdouts",
      actionLabel: "Call out the holdouts →",
    };
  }
  if (inviteCritical && (opts?.humanRosterCount ?? 99) < 4) {
    return {
      id: "H_ATTN_INVITES",
      priority: 2,
      tone: "attention",
      title: "The room’s thin — friends still need a way in.",
      detail: "Share the invite. The fun starts when people show up.",
      action: "share_invite",
      actionLabel: "Share invite →",
    };
  }

  // 3 🎉 Celebrate
  if (vm.status === "live" && vm.allHumansLocked && vm.expectedLocks > 0) {
    return {
      id: "H_CELEB_ALL_LOCKED",
      priority: 3,
      tone: "celebrate",
      title: "Everyone is locked.",
      detail: vm.kickoffCountdown || vm.firstKickoffLabel || "The room’s ready.",
      action: "preview_player",
      actionLabel: "Preview as player →",
    };
  }
  if (vm.status === "scored") {
    return {
      id: "H_CELEB_SCORED",
      priority: 3,
      tone: "celebrate",
      title: "This week’s written.",
      detail: "Standings and the paper did their job.",
      action: "open_standings",
      actionLabel: "Open Standings →",
    };
  }

  // 4 ℹ️ Quiet
  if (vm.status === "live" && vm.kickoffCountdown) {
    return {
      id: "H_QUIET_COUNTDOWN",
      priority: 4,
      tone: "quiet",
      title: vm.kickoffCountdown,
      detail: "Nothing’s on fire.",
      action: "none",
      actionLabel: null,
    };
  }

  return {
    id: "H_QUIET_HEALTHY",
    priority: 4,
    tone: "quiet",
    title: "The room’s ready.",
    detail: undefined,
    action: "none",
    actionLabel: null,
  };
}

export function thisWeekStatusLabel(status: ThisWeekStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "live":
      return "Live";
    case "needs_score":
      return "Needs scoring";
    case "scored":
      return "Archive";
    default:
      return status;
  }
}
