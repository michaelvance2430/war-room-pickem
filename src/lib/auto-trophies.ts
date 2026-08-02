/**
 * Auto-engrave ALL season hardware — no manual "fill out" form.
 *
 * - Division / conference titles → after cut-lock week (see division-champions)
 * - Championship · Toilet Bowl → when bracket final has a winner
 * - Village Nerd (Crystal Ball) → when national champ is crowned + correct pickers
 *
 * Safe to call after every score / Trophy Room open / Crystal Ball crown.
 */

import type { Player } from "./types";
import { getLeague, getSession, isOps } from "./league";
import {
  awardTrophy,
  defaultSeasonYear,
  type TrophyType,
} from "./trophies";
import {
  seedChampionship,
  seedToiletBowl,
  buildBracket,
  advanceBracketFromCfpWeeks,
} from "./brackets";
import { engraveDivisionChampions } from "./division-champions";
import { cutLockWeek, seasonMaxWeek } from "./season-calendar";

export type AutoTrophyResult = {
  type: TrophyType | string;
  label: string;
  winnerName?: string;
  ok: boolean;
  skipped?: boolean;
  reason?: string;
};

async function finalWinner(
  players: Player[],
  type: "championship" | "toilet"
): Promise<{ player: Player; reason: string } | null> {
  if (players.length < 2) return null;
  const sportId = getLeague()?.sportId;
  const seeded =
    type === "championship"
      ? seedChampionship(players)
      : seedToiletBowl(players);
  if (seeded.length < 2) return null;

  let scored: number[] = [];
  try {
    const { listScoredWeekNumbers } = await import("./cloud");
    scored = await listScoredWeekNumbers();
  } catch {
    // Fallback: indices present on weeklyPoints
    const set = new Set<number>();
    for (const p of players) {
      const w = p.weeklyPoints || [];
      for (let i = 0; i < w.length; i++) {
        if (typeof w[i] === "number") set.add(i);
      }
    }
    scored = [...set];
  }

  const built = buildBracket(type, seeded);
  const advanced = advanceBracketFromCfpWeeks(built, scored, sportId);
  const lastRound = advanced.rounds[advanced.rounds.length - 1];
  const final = lastRound?.[0];
  if (!final?.winnerId) return null;

  const winner =
    players.find((p) => p.id === final.winnerId) ||
    seeded.find((p) => p.id === final.winnerId);
  if (!winner) return null;

  return {
    player: winner,
    reason:
      type === "championship"
        ? "Championship bracket final"
        : "Toilet Bowl bracket final",
  };
}

async function engraveOne(opts: {
  trophyType: TrophyType;
  winnerName: string;
  winnerUserId?: string | null;
  subtitle?: string | null;
  notes?: string | null;
  label: string;
}): Promise<AutoTrophyResult> {
  const year = defaultSeasonYear();
  const res = await awardTrophy({
    seasonYear: year,
    trophyType: opts.trophyType,
    winnerName: opts.winnerName,
    winnerUserId: opts.winnerUserId || null,
    subtitle: opts.subtitle || null,
    notes: opts.notes || null,
    allowOps: true,
  });
  return {
    type: opts.trophyType,
    label: opts.label,
    winnerName: opts.winnerName,
    ok: res.ok,
    reason: res.error,
  };
}

/**
 * Crystal Ball / Village Nerd: among correct national-champ pickers,
 * engrave one (sole correct, else highest season points).
 */
async function engraveCrystalBallNerd(
  players: Player[]
): Promise<AutoTrophyResult | null> {
  const session = getSession();
  const league = getLeague();
  if (!session?.leagueId) return null;
  if (league?.settings?.crystalBallEnabled === false) {
    return {
      type: "crystal_ball",
      label: "Village Nerd",
      ok: true,
      skipped: true,
      reason: "Crystal Ball off for this league",
    };
  }

  try {
    const { loadCrystalBall } = await import("./crystal-ball");
    const state = await loadCrystalBall();
    const champ = state.champion?.trim();
    if (!champ) {
      return {
        type: "crystal_ball",
        label: "Village Nerd",
        ok: true,
        skipped: true,
        reason: "National champ not crowned yet",
      };
    }

    const correct = state.picks.filter(
      (p) => p.teamName.toLowerCase() === champ.toLowerCase()
    );
    if (!correct.length) {
      return {
        type: "crystal_ball",
        label: "Village Nerd",
        ok: true,
        skipped: true,
        reason: `Nobody picked ${champ}`,
      };
    }

    // Prefer player still in roster; rank by season points
    const byId = new Map(players.map((p) => [p.id, p]));
    const ranked = [...correct].sort((a, b) => {
      const pa = byId.get(a.userId)?.totalPoints || 0;
      const pb = byId.get(b.userId)?.totalPoints || 0;
      if (pb !== pa) return pb - pa;
      return (a.displayName || "").localeCompare(b.displayName || "");
    });
    const top = ranked[0];
    const name =
      byId.get(top.userId)?.name || top.displayName || "Prophet";

    return engraveOne({
      trophyType: "crystal_ball",
      winnerName: name,
      winnerUserId: top.userId,
      subtitle: `Predicted ${champ}`,
      notes:
        correct.length > 1
          ? `Village Nerd · ${correct.length} correct picks; plaque goes to highest season points among prophets.`
          : `Village Nerd · only correct Crystal Ball on ${champ}.`,
      label: "Village Nerd",
    });
  } catch (e) {
    return {
      type: "crystal_ball",
      label: "Village Nerd",
      ok: false,
      reason: e instanceof Error ? e.message : "Crystal Ball load failed",
    };
  }
}

/**
 * Run full auto-engrave pass for the active league.
 */
export async function autoEngraveAllTrophies(opts?: {
  /** Scored week that triggered this (optional) */
  weekNumber?: number;
  players?: Player[];
}): Promise<{
  ok: boolean;
  results: AutoTrophyResult[];
  message: string;
}> {
  const session = getSession();
  if (!session?.leagueId) {
    return { ok: false, results: [], message: "No league" };
  }
  if (!session.isCommissioner && !isOps()) {
    return {
      ok: false,
      results: [],
      message: "Commish or ops only can sync trophies",
    };
  }

  const results: AutoTrophyResult[] = [];
  let players = opts?.players;
  if (!players) {
    const { loadLeaguePlayers } = await import("./cloud");
    players = await loadLeaguePlayers();
  }
  const humans = players.filter((p) => !p.isMock);
  const sportId = getLeague()?.sportId || "cfb";
  const cut = cutLockWeek(sportId);
  const maxW = seasonMaxWeek(sportId);
  const week = opts?.weekNumber;

  // 1) Division / conference titles (after cut)
  if (week == null || week >= cut) {
    const div = await engraveDivisionChampions(players, {
      weekNumber: week ?? cut,
      force: week == null,
    });
    if (div.champs.length) {
      for (const c of div.champs) {
        results.push({
          type: c.trophyType,
          label: `${c.conferenceLabel} Champions`,
          winnerName: c.winner.name,
          ok: true,
        });
      }
    } else if (week != null && week >= cut) {
      results.push({
        type: "division",
        label: "Conference / division titles",
        ok: true,
        skipped: true,
        reason: "No division leaders yet",
      });
    }
  }

  // 2) Championship bracket final
  try {
    const champ = await finalWinner(humans, "championship");
    if (champ) {
      results.push(
        await engraveOne({
          trophyType: "championship",
          winnerName: champ.player.name,
          winnerUserId: champ.player.id,
          subtitle: "War Room Champion",
          notes: `Auto-engraved · ${champ.reason}`,
          label: "Championship",
        })
      );
    } else {
      results.push({
        type: "championship",
        label: "Championship",
        ok: true,
        skipped: true,
        reason: "Bracket final not decided yet",
      });
    }
  } catch (e) {
    results.push({
      type: "championship",
      label: "Championship",
      ok: false,
      reason: e instanceof Error ? e.message : "Bracket failed",
    });
  }

  // 3) Toilet Bowl final
  try {
    const toilet = await finalWinner(humans, "toilet");
    if (toilet) {
      results.push(
        await engraveOne({
          trophyType: "toilet_bowl",
          winnerName: toilet.player.name,
          winnerUserId: toilet.player.id,
          subtitle: "Toilet Bowl Champion",
          notes: `Auto-engraved · ${toilet.reason}`,
          label: "Toilet Bowl",
        })
      );
    } else {
      results.push({
        type: "toilet_bowl",
        label: "Toilet Bowl",
        ok: true,
        skipped: true,
        reason: "Toilet final not decided yet",
      });
    }
  } catch (e) {
    results.push({
      type: "toilet_bowl",
      label: "Toilet Bowl",
      ok: false,
      reason: e instanceof Error ? e.message : "Toilet bracket failed",
    });
  }

  // 4) Village Nerd / Crystal Ball
  const nerd = await engraveCrystalBallNerd(humans);
  if (nerd) results.push(nerd);

  const awarded = results.filter((r) => r.ok && !r.skipped && r.winnerName);
  const message =
    awarded.length > 0
      ? `Auto-engraved ${awarded.length}: ${awarded
          .map((a) => `${a.label} → ${a.winnerName}`)
          .join(" · ")}`
      : `Nothing new to engrave yet (cut week ${cut}, finals through week ${maxW}, or crown Crystal Ball).`;

  return { ok: true, results, message };
}
