/**
 * Standings hero pulse — evolves with the league life cycle.
 *
 * Same page. Different heartbeat.
 *   preseason  → is the room alive?
 *   regular    → who's winning / hot / locked?
 *   offseason  → legacy + next season
 *
 * Never invent competitive achievement. Cards use real roster, scores, hardware.
 */

import type { Player } from "./types";
import { weekCrownAndShame } from "./fun-board";
import { formatLeaguePulse } from "./last-seen";
import { MAX_LEAGUE_PLAYERS } from "./league-limits";
import { seasonMaxWeek } from "./season-calendar";
import { getSeasonOpenAtMs, getSeasonOpenLabel } from "./season-countdown";

export type StandingsPulsePhase = "preseason" | "regular" | "offseason";

export type StandingsPulseCard = {
  key: string;
  label: string;
  /** Primary display (name, number, countdown) */
  value: string;
  /** Secondary line under value */
  sub?: string;
  /** Tailwind text class for value */
  valueClass?: string;
  /** Optional profile id for name values */
  playerId?: string | null;
};

export function resolveStandingsPulsePhase(opts: {
  seasonHasOfficialScore: boolean;
  latestScoredWeek: number | null;
  sportId?: string | null;
}): StandingsPulsePhase {
  if (!opts.seasonHasOfficialScore) return "preseason";
  const max = seasonMaxWeek(opts.sportId);
  if (
    opts.latestScoredWeek != null &&
    Number.isFinite(opts.latestScoredWeek) &&
    opts.latestScoredWeek >= max
  ) {
    return "offseason";
  }
  return "regular";
}

export function standingsPulsePhaseCopy(phase: StandingsPulsePhase): {
  headline: string;
  subline: string;
} {
  switch (phase) {
    case "preseason":
      return {
        headline: "League pulse — who’s in the room.",
        subline:
          "Competition lights up after the first scored week. Right now the board is the heartbeat of the room.",
      };
    case "regular":
      return {
        headline: "Competition pulse — who’s winning and who’s locked.",
        subline:
          "Crown, streaks, and check-ins for this moment in the season. Full ranks live in the table below.",
      };
    case "offseason":
      return {
        headline: "Legacy pulse — the season is over. The league remains.",
        subline:
          "Champions, the room that stuck around, and the wait until we do it again.",
      };
  }
}

function activeTodayCount(players: Player[], nowMs = Date.now()): number {
  let n = 0;
  for (const p of players) {
    if (p.isMock) continue;
    if (!p.lastSeenAt) continue;
    const t = new Date(p.lastSeenAt).getTime();
    if (!Number.isNaN(t) && nowMs - t < 24 * 60 * 60 * 1000) n += 1;
  }
  return n;
}

function onlineNowCount(players: Player[], nowMs = Date.now()): number {
  let n = 0;
  for (const p of players) {
    if (p.isMock) continue;
    if (formatLeaguePulse(p.lastSeenAt, nowMs).online) n += 1;
  }
  return n;
}

function hottestStreak(players: Player[]): {
  player: Player;
  streak: number;
} | null {
  let best: { player: Player; streak: number } | null = null;
  for (const p of players) {
    if (p.isMock) continue;
    const s = p.currentStreak || 0;
    if (s <= 0) continue;
    if (!best || s > best.streak) best = { player: p, streak: s };
  }
  return best;
}

function formatCountdown(toMs: number, nowMs = Date.now()): string {
  const ms = Math.max(0, toMs - nowMs);
  const day = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (day >= 2) return `${day}d`;
  const hr = Math.floor(ms / (60 * 60 * 1000));
  if (hr >= 1) return `${hr}h`;
  const min = Math.floor(ms / (60 * 1000));
  return `${Math.max(1, min)}m`;
}

/**
 * Next season open: if current campaign open is still in the future, use it.
 * Otherwise advance ~1 year from last open for offseason wait.
 */
export function nextSeasonOpenMs(
  sportId?: string | null,
  nowMs = Date.now()
): number {
  const open = getSeasonOpenAtMs(sportId);
  if (nowMs < open) return open;
  // Rough next cycle — same calendar day next year (UTC open stamp + 365d)
  return open + 365 * 24 * 60 * 60 * 1000;
}

export type BuildStandingsPulseCardsInput = {
  phase: StandingsPulsePhase;
  players: Player[];
  sportId?: string | null;
  /** Locked picks / expected humans for live week (optional) */
  picksLocked?: { locked: number; expected: number } | null;
  /** Defending champ from trophy hardware */
  defendingChamp?: { name: string; userId?: string | null } | null;
  /** Distinct seasons with hardware / history */
  seasonsPlayed?: number | null;
  nowMs?: number;
};

export function buildStandingsPulseCards(
  input: BuildStandingsPulseCardsInput
): StandingsPulseCard[] {
  const now = input.nowMs ?? Date.now();
  const players = input.players || [];
  const humans = players.filter((p) => !p.isMock);
  const roster = humans.length ? humans : players;

  if (input.phase === "preseason") {
    return [
      {
        key: "joined",
        label: "Joined",
        value: String(players.length),
        sub: `/ ${MAX_LEAGUE_PLAYERS}`,
      },
      {
        key: "online",
        label: "Online now",
        value: String(onlineNowCount(roster, now)),
        valueClass: "text-emerald-400",
      },
      {
        key: "active",
        label: "Active today",
        value: String(activeTodayCount(roster, now)),
      },
      {
        key: "seats",
        label: "Seats left",
        value: String(Math.max(0, MAX_LEAGUE_PLAYERS - players.length)),
      },
    ];
  }

  if (input.phase === "regular") {
    const crown = weekCrownAndShame(players);
    const hot = hottestStreak(players);
    const picks = input.picksLocked;
    const leader = [...players]
      .filter((p) => !p.isMock)
      .sort((a, b) => b.totalPoints - a.totalPoints || a.name.localeCompare(b.name))[0];

    const crownCard: StandingsPulseCard = crown
      ? {
          key: "crown",
          label: "Crown holder",
          value: crown.crown.player.name,
          sub: `${crown.crown.pts} pts · latest week`,
          valueClass: "text-amber-300 text-base leading-tight",
          playerId: crown.crown.player.id,
        }
      : leader
        ? {
            key: "crown",
            label: "Leader",
            value: leader.name,
            sub: `${leader.totalPoints} pts`,
            valueClass: "text-amber-300 text-base leading-tight",
            playerId: leader.id,
          }
        : {
            key: "crown",
            label: "Crown holder",
            value: "—",
            sub: "After next score",
          };

    const streakCard: StandingsPulseCard = hot
      ? {
          key: "streak",
          label: "Hottest streak",
          value: `W${hot.streak}`,
          sub: hot.player.name,
          valueClass: "text-primary",
          playerId: hot.player.id,
        }
      : {
          key: "streak",
          label: "Hottest streak",
          value: "—",
          sub: "Nobody on a heater",
        };

    const picksCard: StandingsPulseCard =
      picks && picks.expected > 0
        ? {
            key: "picks",
            label: "Picks locked",
            value: `${picks.locked}`,
            sub: `/ ${picks.expected}`,
            valueClass:
              picks.locked >= picks.expected
                ? "text-primary"
                : "text-foreground",
          }
        : {
            key: "picks",
            label: "Picks locked",
            value: "—",
            sub: "When the card is live",
          };

    return [
      crownCard,
      streakCard,
      {
        key: "active",
        label: "Active today",
        value: String(activeTodayCount(roster, now)),
      },
      picksCard,
    ];
  }

  // ── Offseason / legacy ──
  const champ = input.defendingChamp;
  const seasons =
    input.seasonsPlayed != null && input.seasonsPlayed > 0
      ? input.seasonsPlayed
      : 1;
  const nextOpen = nextSeasonOpenMs(input.sportId, now);
  const openLabel = getSeasonOpenLabel(input.sportId);

  return [
    {
      key: "returning",
      label: "In the room",
      value: String(humans.length || players.length),
      sub: "still seated",
    },
    {
      key: "champ",
      label: "Defending champ",
      value: champ?.name || "—",
      sub: champ ? "Hardware on the shelf" : "No ring engraved yet",
      valueClass: champ
        ? "text-amber-300 text-base leading-tight"
        : "text-muted",
      playerId: champ?.userId ?? null,
    },
    {
      key: "seasons",
      label: "Seasons played",
      value: String(seasons),
      sub: seasons === 1 ? "first chapter" : "chapters",
    },
    {
      key: "next",
      label: "Next season",
      value: formatCountdown(nextOpen, now),
      sub: openLabel.includes("·")
        ? openLabel.split("·")[0]?.trim() || "Doors reopen"
        : "Doors reopen",
      valueClass: "text-sky-300",
    },
  ];
}
