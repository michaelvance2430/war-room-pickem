/**
 * Home League Hub — sequential first-action resolver.
 *
 * Sequential means: the first incomplete task in workflow order wins.
 * Never invent urgency. If state cannot be determined reliably → ENTER.
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
  | "VIEW_RESULTS"
  | "READ_GAZETTE"
  | "SET_WEEK"
  | "PUBLISH_WEEK"
  | "REVIEW_RESULTS"
  | "ENTER";

export type LeagueHubAction = {
  code: LeagueHubActionCode;
  label: string;
  /** Path after league is active (switch first if needed) */
  href: string;
};

export type LeagueHubPulse = {
  leagueId: string;
  sportId: SportId;
  liveWeek: number | null;
  /** Status line under league name */
  statusLine: string;
  action: LeagueHubAction;
  isHost: boolean;
};

const ACTION_META: Record<
  LeagueHubActionCode,
  { label: string; href: string }
> = {
  MAKE_PICKS: { label: "MAKE PICKS", href: "/picks" },
  FINISH_CARD: { label: "FINISH CARD", href: "/picks" },
  LOCK_CRYSTAL_BALL: { label: "LOCK CRYSTAL BALL", href: "/crystal-ball" },
  LOCK_PICKS: { label: "LOCK PICKS", href: "/picks" },
  VIEW_RESULTS: { label: "VIEW RESULTS", href: "/board" },
  READ_GAZETTE: { label: "READ GAZETTE", href: "/gazette" },
  SET_WEEK: { label: "SET WEEK", href: "/commissioner?tab=card" },
  PUBLISH_WEEK: { label: "PUBLISH WEEK", href: "/commissioner?tab=card" },
  REVIEW_RESULTS: {
    label: "REVIEW RESULTS",
    href: "/commissioner?tab=results",
  },
  ENTER: { label: "ENTER", href: "/" },
};

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
      href: "/commissioner?tab=card",
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

function enterPulse(
  leagueId: string,
  sportId: SportId,
  liveWeek: number | null,
  isHost: boolean,
  statusLine: string
): LeagueHubPulse {
  return {
    leagueId,
    sportId,
    liveWeek,
    statusLine,
    action: actionOf("ENTER"),
    isHost,
  };
}

type FactBundle = {
  sportId: SportId;
  liveWeek: number | null;
  isHost: boolean;
  expectedGames: number;
  /** week_cards row for live week */
  cardId: string | null;
  publishedAt: string | null;
  gameCount: number;
  hasProp: boolean;
  /** player pick row */
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
    // NFL has no week 0
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
        ? !!(leagueRow as { crystal_ball_enabled?: boolean }).crystal_ball_enabled
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

    // Crystal Ball: only query cloud for opening week when enabled
    let crystalBallSealed: boolean | null = null;
    if (
      crystalBallEnabled &&
      isCrystalBallOpeningWeek(sportId, live)
    ) {
      try {
        const { data: cb, error: cbErr } = await supabase
          .from("crystal_ball_picks")
          .select("user_id")
          .eq("league_id", m.leagueId)
          .eq("user_id", uid)
          .maybeSingle();
        if (cbErr) {
          // Table missing / RLS — do not invent a CB requirement
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
 * Resolve sequential first action for one membership.
 * If facts fail to load → ENTER (no fake urgency).
 */
export function resolveLeagueHubAction(f: FactBundle): {
  action: LeagueHubAction;
  statusLine: string;
} {
  const weekLabel =
    f.liveWeek != null ? weekTitle(f.liveWeek, f.sportId) : null;

  // ── Commissioner sequence (earliest blocking task) ──
  if (f.isHost) {
    // 1. Current week not configured
    if (f.liveWeek == null) {
      return {
        action: actionOf("SET_WEEK"),
        statusLine: "Commissioner setup incomplete",
      };
    }
    // No card at all for live week
    if (!f.cardId) {
      return {
        action: actionOf("SET_WEEK"),
        statusLine: `${weekLabel} · Commissioner setup incomplete`,
      };
    }
    // 2. Card started but incomplete
    if (!cardIsComplete(f)) {
      return {
        action: actionOf("FINISH_CARD", { isHostCard: true }),
        statusLine: `${weekLabel} · Card incomplete`,
      };
    }
    // 3. Card complete but unpublished
    if (!f.publishedAt) {
      return {
        action: actionOf("PUBLISH_WEEK"),
        statusLine: `${weekLabel} · Ready to publish`,
      };
    }
    // 4. Results require commissioner action (only when we know scored=false)
    // We cannot reliably know "games finished but unscored" without kickoff times.
    // Skip inventing REVIEW RESULTS unless week_scored is false AND picks are locked
    // for the room — too fuzzy; fall through to player sequence.
  }

  // ── Player sequence (also host after commish path is clear) ──
  if (f.cardId && f.publishedAt) {
    // 1. Weekly card not started
    if (!f.pickId || f.pickGameCount === 0) {
      return {
        action: actionOf("MAKE_PICKS"),
        statusLine: weekLabel
          ? `${weekLabel} · Picks missing`
          : "Picks missing",
      };
    }
    // 2. Weekly card started but incomplete
    if (!pickIsComplete(f)) {
      return {
        action: actionOf("FINISH_CARD"),
        statusLine: weekLabel
          ? `${weekLabel} · Card incomplete`
          : "Card incomplete",
      };
    }
    // 3. Opening-week Crystal Ball (authoritative cloud seal only)
    if (
      f.crystalBallEnabled &&
      isCrystalBallOpeningWeek(f.sportId, f.liveWeek) &&
      f.crystalBallSealed === false
    ) {
      return {
        action: actionOf("LOCK_CRYSTAL_BALL"),
        statusLine: weekLabel
          ? `${weekLabel} · Crystal Ball needed`
          : "Crystal Ball needed",
      };
    }
    // 4. Picks submitted but not locked (separate lock step)
    if (pickIsComplete(f) && !f.lockedAt) {
      return {
        action: actionOf("LOCK_PICKS"),
        statusLine: weekLabel
          ? `${weekLabel} · Lock required`
          : "Lock required",
      };
    }
    // 5–6 VIEW RESULTS / READ GAZETTE — only when unread is authoritative.
    // Skip: per-league gazette unread is session-scoped and localStorage;
    // do not invent urgency across rooms.
  }

  // Host with published card, player work done
  if (f.isHost && f.cardId && f.publishedAt && pickIsComplete(f) && f.lockedAt) {
    return {
      action: actionOf("ENTER"),
      statusLine: weekLabel
        ? `${weekLabel} · Picks complete`
        : "Picks complete",
    };
  }

  if (f.lockedAt || pickIsComplete(f)) {
    return {
      action: actionOf("ENTER"),
      statusLine: weekLabel
        ? `${weekLabel} · Picks complete`
        : "Picks complete",
    };
  }

  // Published card missing → player waits (not MAKE PICKS)
  if (f.isHost) {
    // should have been caught above
  } else if (!f.cardId || !f.publishedAt) {
    return {
      action: actionOf("ENTER"),
      statusLine: weekLabel
        ? `${weekLabel} · Waiting on card`
        : "Waiting on card",
    };
  }

  return {
    action: actionOf("ENTER"),
    statusLine: weekLabel || "Enter league",
  };
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
          next[m.leagueId] = enterPulse(
            m.leagueId,
            sportId,
            null,
            isHost,
            "Enter league"
          );
          return;
        }
        const { action, statusLine } = resolveLeagueHubAction(facts);
        next[m.leagueId] = {
          leagueId: m.leagueId,
          sportId: facts.sportId,
          liveWeek: facts.liveWeek,
          statusLine,
          action,
          isHost: facts.isHost,
        };
      } catch {
        next[m.leagueId] = enterPulse(
          m.leagueId,
          sportId,
          null,
          isHost,
          "Enter league"
        );
      }
    })
  );
  return next;
}
