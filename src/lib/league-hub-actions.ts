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
import { weekTitle } from "@/lib/season-calendar";

export type LeagueHubActionCode =
  | "MAKE_PICKS"
  | "FINISH_CARD"
  | "LOCK_CRYSTAL_BALL"
  | "LOCK_PICKS"
  | "SET_WEEK"
  | "PUBLISH_WEEK"
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
  SET_WEEK: { label: "Set Week", href: "/week-ops" },
  PUBLISH_WEEK: { label: "Publish Week", href: "/week-ops" },
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
  opts?: { isHostCard?: boolean }
): LeagueHubAction {
  const meta = ACTION_META[code];
  if (code === "FINISH_CARD" && opts?.isHostCard) {
    return {
      code,
      label: meta.label,
      href: "/week-ops",
    };
  }
  return { code, label: meta.label, href: meta.href };
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
  isHost: boolean
): LeagueHubPulse {
  return {
    leagueId,
    sportId,
    liveWeek: null,
    weekLine: "—",
    action: actionOf("ENTER"),
    signal: signalOf("ready", "Enter"),
    isHost,
  };
}

type FactBundle = {
  sportId: SportId;
  liveWeek: number | null;
  isHost: boolean;
  expectedGames: number;
  cardId: string | null;
  publishedAt: string | null;
  gameCount: number;
  hasProp: boolean;
  pickId: string | null;
  pickGameCount: number;
  pickHasProp: boolean;
  pickHasBestBet: boolean;
  lockedAt: string | null;
  /** crystal_ball_picks row exists (authoritative seal) */
  crystalBallSealed: boolean | null;
  crystalBallEnabled: boolean;
};

async function loadFacts(
  m: LeagueMembership,
  uid: string
): Promise<FactBundle | null> {
  const supabase = createClient();
  const isHost =
    m.role === "commissioner" || m.commissionerId === uid;

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
          : sportId === "cfb";

    if (live == null) {
      return {
        sportId,
        liveWeek: null,
        isHost,
        expectedGames,
        cardId: null,
        publishedAt: null,
        gameCount: 0,
        hasProp: false,
        pickId: null,
        pickGameCount: 0,
        pickHasProp: false,
        pickHasBestBet: false,
        lockedAt: null,
        crystalBallSealed: null,
        crystalBallEnabled,
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
    if (cardId) {
      const { count } = await supabase
        .from("card_games")
        .select("id", { count: "exact", head: true })
        .eq("week_card_id", cardId);
      gameCount = count ?? 0;
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
      isHost,
      expectedGames,
      cardId,
      publishedAt,
      gameCount,
      hasProp,
      pickId,
      pickGameCount,
      pickHasProp,
      pickHasBestBet,
      lockedAt,
      crystalBallSealed,
      crystalBallEnabled,
    };
  } catch {
    return null;
  }
}

function cardIsComplete(f: FactBundle): boolean {
  return f.gameCount >= f.expectedGames && f.hasProp;
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
 */
export function resolveLeagueHubAction(f: FactBundle): {
  action: LeagueHubAction;
  weekLine: string;
  signal: LeagueHubSignal;
} {
  const weekLine =
    f.liveWeek != null ? weekTitle(f.liveWeek, f.sportId) : "Not set";

  // ── Commissioner sequence (earliest blocking task) ──
  if (f.isHost) {
    if (f.liveWeek == null || !f.cardId) {
      return {
        action: actionOf("SET_WEEK"),
        weekLine: f.liveWeek == null ? "Commissioner" : weekLine,
        signal: signalOf("commissioner", "Set Week"),
      };
    }
    if (!cardIsComplete(f)) {
      return {
        action: actionOf("FINISH_CARD", { isHostCard: true }),
        weekLine,
        signal: signalOf("commissioner", "Finish Card"),
      };
    }
    if (!f.publishedAt) {
      return {
        action: actionOf("PUBLISH_WEEK"),
        weekLine,
        signal: signalOf("publish", "Ready to Publish"),
      };
    }
    // Commish path clear → player sequence
  }

  // ── Player sequence ──
  if (f.cardId && f.publishedAt) {
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
    if (
      f.crystalBallEnabled &&
      isCrystalBallOpeningWeek(f.sportId, f.liveWeek) &&
      f.crystalBallSealed === false
    ) {
      return {
        action: actionOf("LOCK_CRYSTAL_BALL"),
        weekLine,
        signal: signalOf("prediction", "Crystal Ball"),
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

  // Player: no published card yet — nothing to do
  if (!f.isHost) {
    return {
      action: actionOf("ENTER"),
      weekLine,
      signal: signalOf("soon", "Coming Soon"),
    };
  }

  // Host fallthrough (shouldn't hit if sequence complete)
  return {
    action: actionOf("ENTER"),
    weekLine,
    signal: signalOf("ready", "Enter"),
  };
}

/**
 * Stage 2 attention — action codes that are a real weekly hub task.
 * ENTER is never actionable (covers Ready / Coming Soon / fail-closed).
 * Score Week is not a hub code yet (Stage 4). Do not invent codes here.
 */
export const ACTIONABLE_HUB_TASK_CODES: ReadonlySet<LeagueHubActionCode> =
  new Set([
    "MAKE_PICKS",
    "FINISH_CARD",
    "LOCK_CRYSTAL_BALL",
    "LOCK_PICKS",
    "SET_WEEK",
    "PUBLISH_WEEK",
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

/** Load pulse for every membership (parallel, truth-only). */
export async function loadLeagueHubPulses(
  memberships: LeagueMembership[],
  uid: string
): Promise<Record<string, LeagueHubPulse>> {
  const next: Record<string, LeagueHubPulse> = {};
  await Promise.all(
    memberships.map(async (m) => {
      const isHost =
        m.role === "commissioner" || m.commissionerId === uid;
      const sportId = normalizeSportId(m.sportId || "cfb");
      try {
        const facts = await loadFacts(m, uid);
        if (!facts) {
          next[m.leagueId] = fallbackPulse(m.leagueId, sportId, isHost);
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
          isHost: facts.isHost,
        };
      } catch {
        next[m.leagueId] = fallbackPulse(m.leagueId, sportId, isHost);
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
