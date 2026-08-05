/**
 * Home League Hub — sequential first-action resolver + scan personality.
 *
 * Sequential means: the first incomplete task in workflow order wins.
 * Never invent urgency. If state cannot be determined reliably → ENTER.
 *
 * ENTER is not the default reward-for-loading. ENTER means caught up
 * (or waiting with nothing actionable). The colored signal is the
 * signature scan layer; the button still says the verb.
 */

import { createClient } from "@/lib/supabase/client";
import type { LeagueMembership } from "@/lib/session-restore";
import { normalizeSportId } from "@/lib/sports/registry";
import type { SportId } from "@/lib/sports/types";
import { weekTitle, seasonMaxWeek } from "@/lib/season-calendar";
import {
  membershipIsOps,
  resolveHostOpsMission,
  type HostOpsMission,
} from "@/lib/host-ops-mission";

export type LeagueHubActionCode =
  | "MAKE_PICKS"
  | "FINISH_CARD"
  | "LOCK_CRYSTAL_BALL"
  | "LOCK_PICKS"
  | "CHOOSE_TEAM"
  | "SET_WEEK"
  | "PUBLISH_WEEK"
  | "SCORE_WEEK"
  | "BUILD_CARD"
  | "TROPHY_CEREMONY"
  | "ENTER";

/**
 * Signature UX signal — color + short phrase for at-a-glance scan.
 * Button still carries the verb (Make Picks, Set Week, …).
 */
export type LeagueHubTone =
  | "ready"
  | "waiting"
  | "commissioner"
  | "prediction"
  | "publish"
  | "soon";

export type LeagueHubSignal = {
  tone: LeagueHubTone;
  /** e.g. "Waiting — Make Picks" */
  label: string;
  /** emoji disc for scan */
  emoji: string;
};

export type LeagueHubAction = {
  code: LeagueHubActionCode;
  /** Button label — title case action */
  label: string;
  /** Path after league is active (switch first if needed) */
  href: string;
};

export type LeagueHubPulse = {
  leagueId: string;
  sportId: SportId;
  liveWeek: number | null;
  /** Short week/status under league name, e.g. "Week 1" */
  weekLine: string;
  action: LeagueHubAction;
  signal: LeagueHubSignal;
  isHost: boolean;
};

const ACTION_META: Record<
  LeagueHubActionCode,
  { label: string; href: string }
> = {
  MAKE_PICKS: { label: "Make Picks", href: "/picks" },
  FINISH_CARD: { label: "Finish Card", href: "/picks" },
  LOCK_CRYSTAL_BALL: { label: "Lock Crystal Ball", href: "/crystal-ball" },
  LOCK_PICKS: { label: "Lock Picks", href: "/picks" },
  CHOOSE_TEAM: {
    label: "Choose Team",
    // Overridden with ?sport= when resolved for a known league sport
    href: "/declare-allegiance",
  },
  SET_WEEK: { label: "Set Week", href: "/week-ops" },
  PUBLISH_WEEK: { label: "Publish Week", href: "/week-ops" },
  SCORE_WEEK: { label: "Score Week", href: "/week-ops?step=score" },
  BUILD_CARD: { label: "Build Card", href: "/week-ops" },
  TROPHY_CEREMONY: { label: "Trophy Ceremony", href: "/trophy-ceremony" },
  ENTER: { label: "Enter", href: "/" },
};

const SIGNALS: Record<
  LeagueHubTone,
  { emoji: string; phrase: (detail: string) => string }
> = {
  ready: { emoji: "🟢", phrase: (d) => (d ? `Ready — ${d}` : "Ready — Enter") },
  waiting: {
    emoji: "🟡",
    phrase: (d) => (d ? `Waiting — ${d}` : "Waiting"),
  },
  commissioner: {
    emoji: "🔵",
    phrase: (d) => (d ? `Commissioner — ${d}` : "Commissioner"),
  },
  prediction: {
    emoji: "🟣",
    phrase: (d) =>
      d ? `Prediction Needed — ${d}` : "Prediction Needed — Crystal Ball",
  },
  publish: {
    emoji: "🟠",
    phrase: (d) => (d ? d : "Ready to Publish"),
  },
  soon: {
    emoji: "⚪",
    phrase: (d) => (d ? d : "Coming Soon"),
  },
};

function signalOf(tone: LeagueHubTone, detail = ""): LeagueHubSignal {
  const s = SIGNALS[tone];
  return { tone, emoji: s.emoji, label: s.phrase(detail) };
}

/** Commish FINISH CARD routes to build, player FINISH CARD to picks. */
function actionOf(
  code: LeagueHubActionCode,
  opts?: { isHostCard?: boolean; label?: string; href?: string }
): LeagueHubAction {
  const meta = ACTION_META[code];
  if (opts?.label || opts?.href) {
    return {
      code,
      label: opts.label || meta.label,
      href: opts.href || meta.href,
    };
  }
  if (code === "FINISH_CARD" && opts?.isHostCard) {
    return {
      code,
      label: meta.label,
      href: "/week-ops",
    };
  }
  return { code, label: meta.label, href: meta.href };
}

/** Map shared host mission → hub action + signal (semantic codes, not display parse). */
function hubActionFromHostMission(m: HostOpsMission): {
  action: LeagueHubAction;
  signal: LeagueHubSignal;
} {
  switch (m.kind) {
    case "score":
      return {
        action: actionOf("SCORE_WEEK", {
          label: "Score Week",
          href: m.href,
        }),
        signal: signalOf("commissioner", "Score Week"),
      };
    case "build":
    case "next_week":
      return {
        action: actionOf("BUILD_CARD", {
          label: m.kind === "next_week" ? m.label : "Build Card",
          href: m.href,
        }),
        signal: signalOf(
          "commissioner",
          m.kind === "next_week" ? "Build Next Card" : "Build Card"
        ),
      };
    case "finish":
      return {
        action: actionOf("FINISH_CARD", {
          isHostCard: true,
          label: "Finish Card",
          href: m.href,
        }),
        signal: signalOf("commissioner", "Finish Card"),
      };
    case "trophy_ceremony":
      return {
        action: actionOf("TROPHY_CEREMONY", {
          label: "Trophy Ceremony",
          href: m.href,
        }),
        signal: signalOf("commissioner", "Trophy Ceremony"),
      };
    default:
      return {
        action: actionOf("ENTER"),
        signal: signalOf("ready", "Enter"),
      };
  }
}

/**
 * Crystal Ball is only a required hub task for opening week:
 * CFB Week 0 · NFL Week 1
 */
export function isCrystalBallOpeningWeek(
  sportId: string | null | undefined,
  week: number | null | undefined
): boolean {
  if (week == null || Number.isNaN(week)) return false;
  const sid = normalizeSportId(sportId || "cfb");
  if (sid === "cfb") return week === 0;
  if (sid === "nfl") return week === 1;
  return false;
}

function fallbackPulse(
  leagueId: string,
  sportId: SportId,
  isOps: boolean
): LeagueHubPulse {
  return {
    leagueId,
    sportId,
    liveWeek: null,
    weekLine: "—",
    action: actionOf("ENTER"),
    signal: signalOf("ready", "Enter"),
    isHost: isOps,
  };
}

/**
 * Pure fact bundle for hub / mission resolution (no I/O).
 * Exported for independent CFB/NFL verification without Supabase.
 */
export type HubFactBundle = {
  sportId: SportId;
  liveWeek: number | null;
  /**
   * Commissioner or deputy for this membership (host ops).
   * Not owner-only — matches isOps() production model.
   */
  isOps: boolean;
  expectedGames: number;
  cardId: string | null;
  publishedAt: string | null;
  gameCount: number;
  hasProp: boolean;
  /** Kickoff times for Score Week readiness (shared host resolver). */
  gamesForLock: { commenceTime?: string; startTime?: string }[];
  /** Trusted scored mark for live week (week_results + game_results). */
  weekScored: boolean;
  nextWeek: number | null;
  nextWeekHasGames: boolean;
  pickId: string | null;
  pickGameCount: number;
  pickHasProp: boolean;
  pickHasBestBet: boolean;
  lockedAt: string | null;
  /** crystal_ball_picks row exists (authoritative seal) */
  crystalBallSealed: boolean | null;
  crystalBallEnabled: boolean;
  /** Profile/sport NFL allegiance missing (does not affect CFB). */
  needsNflTeam: boolean;
};

/** @deprecated use HubFactBundle — kept as internal alias */
type FactBundle = HubFactBundle;

/** True when card is formally published (not draft games alone). */
export function isFormallyPublishedHubCard(f: {
  cardId: string | null;
  publishedAt: string | null;
}): boolean {
  return !!(f.cardId && f.publishedAt);
}

async function loadFacts(
  m: LeagueMembership,
  uid: string,
  opts?: { needsNflTeam?: boolean }
): Promise<FactBundle | null> {
  const supabase = createClient();
  // Stage 4: deputies are ops for week-ops / score (same as isOps())
  const isOps = membershipIsOps(m, uid);
  const needsNflTeam = !!opts?.needsNflTeam;

  try {
    const { data: leagueRow, error: leagueErr } = await supabase
      .from("leagues")
      .select("current_week, sport_id, games_per_week, crystal_ball_enabled")
      .eq("id", m.leagueId)
      .maybeSingle();

    if (leagueErr) return null;

    const sportId = normalizeSportId(
      (leagueRow as { sport_id?: string } | null)?.sport_id ||
        m.sportId ||
        "cfb"
    );
    let live =
      (leagueRow as { current_week?: number } | null)?.current_week != null
        ? Number((leagueRow as { current_week?: number }).current_week)
        : null;
    if (live != null && Number.isNaN(live)) live = null;
    if (live != null && sportId === "nfl" && live <= 0) live = 1;

    const expectedGames =
      Number(
        (leagueRow as { games_per_week?: number } | null)?.games_per_week
      ) ||
      m.gamesPerWeek ||
      5;

    const crystalBallEnabled =
      typeof (leagueRow as { crystal_ball_enabled?: boolean } | null)
        ?.crystal_ball_enabled === "boolean"
        ? !!(leagueRow as { crystal_ball_enabled?: boolean })
            .crystal_ball_enabled
        : typeof m.crystalBallEnabled === "boolean"
          ? !!m.crystalBallEnabled
          : sportId === "cfb" || sportId === "nfl";

    if (live == null) {
      return {
        sportId,
        liveWeek: null,
        isOps,
        expectedGames,
        cardId: null,
        publishedAt: null,
        gameCount: 0,
        hasProp: false,
        gamesForLock: [],
        weekScored: false,
        nextWeek: null,
        nextWeekHasGames: false,
        pickId: null,
        pickGameCount: 0,
        pickHasProp: false,
        pickHasBestBet: false,
        lockedAt: null,
        crystalBallSealed: null,
        crystalBallEnabled,
        needsNflTeam: sportId === "nfl" && needsNflTeam,
      };
    }

    const { data: card } = await supabase
      .from("week_cards")
      .select("id, published_at, prop_question")
      .eq("league_id", m.leagueId)
      .eq("week_number", live)
      .maybeSingle();

    const cardId = (card as { id?: string } | null)?.id || null;
    const publishedAt =
      (card as { published_at?: string | null } | null)?.published_at || null;
    const propQ = (
      (card as { prop_question?: string } | null)?.prop_question || ""
    ).trim();
    const hasProp = propQ.length > 0 && propQ !== "Prop";

    let gameCount = 0;
    let gamesForLock: { commenceTime?: string; startTime?: string }[] = [];
    if (cardId) {
      // One query: count + kickoff times for Score Week readiness (no N+1)
      // Production card_games uses start_time (ISO / text kickoff).
      const { data: gameRows } = await supabase
        .from("card_games")
        .select("id, start_time")
        .eq("week_card_id", cardId);
      const rows =
        (gameRows as { id: string; start_time?: string | null }[] | null) ||
        [];
      gameCount = rows.length;
      gamesForLock = rows.map((g) => ({
        commenceTime: g.start_time || undefined,
        startTime: g.start_time || undefined,
      }));
    }

    // Scored? week_results shell with at least one game_results line (trust)
    let weekScored = false;
    {
      const { data: wr } = await supabase
        .from("week_results")
        .select("id")
        .eq("league_id", m.leagueId)
        .eq("week_number", live)
        .maybeSingle();
      const wrId = (wr as { id?: string } | null)?.id;
      if (wrId) {
        const { count } = await supabase
          .from("game_results")
          .select("id", { count: "exact", head: true })
          .eq("week_result_id", wrId);
        weekScored = (count ?? 0) > 0;
      }
    }

    let nextWeek: number | null = null;
    let nextWeekHasGames = false;
    if (weekScored && isOps) {
      const max = seasonMaxWeek(sportId);
      const next = live + 1;
      if (next <= max) {
        nextWeek = next;
        const { data: nextCard } = await supabase
          .from("week_cards")
          .select("id")
          .eq("league_id", m.leagueId)
          .eq("week_number", next)
          .maybeSingle();
        const nextId = (nextCard as { id?: string } | null)?.id;
        if (nextId) {
          const { count } = await supabase
            .from("card_games")
            .select("id", { count: "exact", head: true })
            .eq("week_card_id", nextId);
          nextWeekHasGames = (count ?? 0) > 0;
        }
      }
    }

    let pickId: string | null = null;
    let pickGameCount = 0;
    let pickHasProp = false;
    let pickHasBestBet = false;
    let lockedAt: string | null = null;

    if (cardId && publishedAt) {
      const { data: pick } = await supabase
        .from("picks")
        .select("id, prop_choice, best_bet_game_id, locked_at")
        .eq("league_id", m.leagueId)
        .eq("user_id", uid)
        .eq("week_number", live)
        .maybeSingle();

      if (pick) {
        pickId = (pick as { id: string }).id;
        pickHasProp = !!(pick as { prop_choice?: string }).prop_choice;
        pickHasBestBet = !!(pick as { best_bet_game_id?: string })
          .best_bet_game_id;
        lockedAt =
          ((pick as { locked_at?: string | null }).locked_at as string) ||
          null;

        const { count: pgCount } = await supabase
          .from("pick_games")
          .select("id", { count: "exact", head: true })
          .eq("pick_id", pickId);
        pickGameCount = pgCount ?? 0;
      }
    }

    let crystalBallSealed: boolean | null = null;
    if (crystalBallEnabled && isCrystalBallOpeningWeek(sportId, live)) {
      try {
        const { data: cb, error: cbErr } = await supabase
          .from("crystal_ball_picks")
          .select("user_id")
          .eq("league_id", m.leagueId)
          .eq("user_id", uid)
          .maybeSingle();
        if (cbErr) {
          crystalBallSealed = null;
        } else {
          crystalBallSealed = !!cb;
        }
      } catch {
        crystalBallSealed = null;
      }
    }

    return {
      sportId,
      liveWeek: live,
      isOps,
      expectedGames,
      cardId,
      publishedAt,
      gameCount,
      hasProp,
      gamesForLock,
      weekScored,
      nextWeek,
      nextWeekHasGames,
      pickId,
      pickGameCount,
      pickHasProp,
      pickHasBestBet,
      lockedAt,
      crystalBallSealed,
      crystalBallEnabled,
      needsNflTeam: sportId === "nfl" && needsNflTeam,
    };
  } catch {
    return null;
  }
}

function pickIsComplete(f: FactBundle): boolean {
  return (
    !!f.pickId &&
    f.pickGameCount >= f.expectedGames &&
    f.pickHasProp &&
    f.pickHasBestBet
  );
}

/**
 * Resolve sequential first action + scan signal for one membership.
 *
 * Host ops (commissioner + deputy): shared resolveHostOpsMission (Home parity).
 * Then player sequence when no host mission.
 */
export function resolveLeagueHubAction(f: FactBundle): {
  action: LeagueHubAction;
  weekLine: string;
  signal: LeagueHubSignal;
} {
  const weekLine =
    f.liveWeek != null ? weekTitle(f.liveWeek, f.sportId) : "Not set";

  // ── NFL team allegiance (profile/sport) before weekly work ──
  if (f.sportId === "nfl" && f.needsNflTeam) {
    return {
      action: actionOf("CHOOSE_TEAM", {
        label: "Choose Team",
        href: "/declare-allegiance?sport=nfl&next=/",
      }),
      weekLine,
      signal: signalOf("waiting", "Choose NFL Team"),
    };
  }

  // ── Host ops sequence (shared with Home) ──
  if (f.isOps) {
    if (f.liveWeek == null) {
      return {
        action: actionOf("SET_WEEK"),
        weekLine: "Commissioner",
        signal: signalOf("commissioner", "Set Week"),
      };
    }

    const host = resolveHostOpsMission({
      sportId: f.sportId,
      week: f.liveWeek,
      weekScored: f.weekScored,
      gameCount: f.gameCount,
      hasProp: f.hasProp,
      gamesForLock: f.gamesForLock,
      nextWeek: f.nextWeek,
      nextWeekHasGames: f.nextWeekHasGames,
      trophyReady: false, // hub does not fan-out season closeout (Home only)
    });

    if (host) {
      const mapped = hubActionFromHostMission(host);
      return {
        action: mapped.action,
        weekLine:
          host.kind === "next_week"
            ? host.weekLabel
            : weekLine,
        signal: mapped.signal,
      };
    }
    // No host mission → player sequence (same as Home silent mission button)
  }

  // ── Super Bowl / Crystal Ball before weekly picks when open ──
  if (
    f.crystalBallEnabled &&
    isCrystalBallOpeningWeek(f.sportId, f.liveWeek) &&
    f.crystalBallSealed === false
  ) {
    const nfl = f.sportId === "nfl";
    return {
      action: actionOf("LOCK_CRYSTAL_BALL", {
        label: nfl ? "Make Super Bowl Pick" : "Lock Crystal Ball",
        href: "/crystal-ball",
      }),
      weekLine,
      signal: signalOf(
        "prediction",
        nfl ? "Super Bowl Pick" : "Crystal Ball"
      ),
    };
  }

  // ── Player sequence (only when card is formally published) ──
  // Draft games without published_at never unlock Make/Finish/Lock Picks.
  // CFB and NFL share this rule; NFL still requires allegiance + Super Bowl first (above).
  const formallyPublished = isFormallyPublishedHubCard(f);
  if (formallyPublished) {
    if (!f.pickId || f.pickGameCount === 0) {
      return {
        action: actionOf("MAKE_PICKS"),
        weekLine,
        signal: signalOf("waiting", "Make Picks"),
      };
    }
    if (!pickIsComplete(f)) {
      return {
        action: actionOf("FINISH_CARD"),
        weekLine,
        signal: signalOf("waiting", "Finish Card"),
      };
    }
    if (pickIsComplete(f) && !f.lockedAt) {
      return {
        action: actionOf("LOCK_PICKS"),
        weekLine,
        signal: signalOf("waiting", "Lock Picks"),
      };
    }

    // Caught up — ENTER is the reward
    return {
      action: actionOf("ENTER"),
      weekLine,
      signal: signalOf("ready", "Enter"),
    };
  }

  // No published card — player wait (not actionable; no badge).
  // Host path already returned BUILD/FINISH when ops has work.
  return {
    action: actionOf("ENTER", {
      label: "Waiting on commissioner",
      href: "/",
    }),
    weekLine,
    signal: signalOf("soon", "Waiting on commissioner"),
  };
}

/**
 * Stage 2–4 attention — action codes that are a real weekly hub task.
 * ENTER is never actionable (covers Ready / Coming Soon / fail-closed).
 * SCORE_WEEK / BUILD_CARD / TROPHY_CEREMONY added Stage 4 (shared host path).
 */
export const ACTIONABLE_HUB_TASK_CODES: ReadonlySet<LeagueHubActionCode> =
  new Set([
    "MAKE_PICKS",
    "FINISH_CARD",
    "LOCK_CRYSTAL_BALL",
    "LOCK_PICKS",
    "CHOOSE_TEAM",
    "SET_WEEK",
    "PUBLISH_WEEK",
    "SCORE_WEEK",
    "BUILD_CARD",
    "TROPHY_CEREMONY",
  ]);

/** True when the hub's sequential first action requires user work. */
export function isActionableHubTask(
  action: LeagueHubAction | null | undefined
): boolean {
  if (!action?.code) return false;
  return ACTIONABLE_HUB_TASK_CODES.has(action.code);
}

/**
 * Stage 2 per-league count: 0 or 1 from pulse only.
 * Missing / unknown pulse → 0 (fail closed, no invented urgency).
 */
export function weeklyHubTaskAttention(
  pulse: LeagueHubPulse | null | undefined
): 0 | 1 {
  return isActionableHubTask(pulse?.action) ? 1 : 0;
}

/**
 * Collapsed control total: sum of Stage 2 task bits for OTHER leagues
 * (all sports). Active/current league excluded.
 */
export function otherLeaguesHubTaskTotal(
  pulses: Record<string, LeagueHubPulse>,
  memberships: { leagueId: string }[],
  activeLeagueId: string
): number {
  let n = 0;
  for (const m of memberships) {
    if (!m.leagueId || m.leagueId === activeLeagueId) continue;
    n += weeklyHubTaskAttention(pulses[m.leagueId]);
  }
  return n;
}

/**
 * Stage 3 combined attention for one league:
 *   (weekly hub task ? 1 : 0) + unread commissioner announcements
 * Announcement count must come from durable announcement_reads (not locker).
 */
export function combinedLeagueAttention(
  pulse: LeagueHubPulse | null | undefined,
  unreadAnnouncements: number | null | undefined
): number {
  const task = weeklyHubTaskAttention(pulse);
  const ann =
    typeof unreadAnnouncements === "number" &&
    Number.isFinite(unreadAnnouncements) &&
    unreadAnnouncements > 0
      ? Math.floor(unreadAnnouncements)
      : 0;
  return task + ann;
}

/**
 * Collapsed control: sum of combined attention for OTHER leagues (all sports).
 */
export function otherLeaguesCombinedAttentionTotal(
  pulses: Record<string, LeagueHubPulse>,
  memberships: { leagueId: string }[],
  activeLeagueId: string,
  unreadByLeague: Record<string, number>
): number {
  let n = 0;
  for (const m of memberships) {
    if (!m.leagueId || m.leagueId === activeLeagueId) continue;
    n += combinedLeagueAttention(pulses[m.leagueId], unreadByLeague[m.leagueId]);
  }
  return n;
}

/** Accessible wording for combined attention (tasks + notices). */
export function attentionAriaLabel(
  count: number,
  opts: { leagueName?: string; otherLeagues?: boolean }
): string {
  if (count <= 0) return "";
  const n = count > 99 ? count : count; // exact in aria even when UI shows 99+
  const unit =
    n === 1
      ? "action or notice requiring attention"
      : "actions or notices requiring attention";
  if (opts.otherLeagues) {
    return `${n} ${unit} in other leagues`;
  }
  const name = (opts.leagueName || "this league").trim() || "this league";
  return `${n} ${unit} in ${name}`;
}

/** Load pulse for every membership (parallel, truth-only). */
export async function loadLeagueHubPulses(
  memberships: LeagueMembership[],
  uid: string
): Promise<Record<string, LeagueHubPulse>> {
  const next: Record<string, LeagueHubPulse> = {};
  // One allegiance check for all NFL rooms (profile/sport — not per league)
  let needsNflTeam = false;
  if (memberships.some((m) => normalizeSportId(m.sportId || "cfb") === "nfl")) {
    try {
      const { needsNflAllegiance } = await import("@/lib/favorite-teams");
      needsNflTeam = await needsNflAllegiance();
    } catch {
      needsNflTeam = false;
    }
  }

  await Promise.all(
    memberships.map(async (m) => {
      const isOps = membershipIsOps(m, uid);
      const sportId = normalizeSportId(m.sportId || "cfb");
      try {
        const facts = await loadFacts(m, uid, { needsNflTeam });
        if (!facts) {
          next[m.leagueId] = fallbackPulse(m.leagueId, sportId, isOps);
          return;
        }
        const { action, weekLine, signal } = resolveLeagueHubAction(facts);
        next[m.leagueId] = {
          leagueId: m.leagueId,
          sportId: facts.sportId,
          liveWeek: facts.liveWeek,
          weekLine,
          action,
          signal,
          isHost: facts.isOps,
        };
      } catch {
        next[m.leagueId] = fallbackPulse(m.leagueId, sportId, isOps);
      }
    })
  );
  return next;
}

/** Tailwind classes for tone dots / text accents */
export function leagueHubToneClasses(tone: LeagueHubTone): {
  text: string;
  button: string;
} {
  switch (tone) {
    case "ready":
      return {
        text: "text-emerald-300/90",
        button:
          "border border-emerald-500/40 text-emerald-100 hover:bg-emerald-500/10",
      };
    case "waiting":
      return {
        text: "text-amber-200/95",
        button: "bg-primary text-black hover:opacity-90",
      };
    case "commissioner":
      return {
        text: "text-sky-300/95",
        button:
          "border border-sky-400/50 text-sky-100 bg-sky-500/10 hover:bg-sky-500/15",
      };
    case "prediction":
      return {
        text: "text-violet-300/95",
        button:
          "border border-violet-400/50 text-violet-100 bg-violet-500/15 hover:bg-violet-500/20",
      };
    case "publish":
      return {
        text: "text-orange-300/95",
        button:
          "border border-orange-400/50 text-orange-100 bg-orange-500/10 hover:bg-orange-500/15",
      };
    case "soon":
    default:
      return {
        text: "text-muted",
        button: "border border-border text-muted hover:text-foreground",
      };
  }
}
