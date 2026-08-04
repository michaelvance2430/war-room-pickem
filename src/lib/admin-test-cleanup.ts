/**
 * Admin-only cleanup for development / test contamination.
 *
 * NOT a commissioner product feature. Creator (app builder) only.
 * Production leagues with real friends stay non-deletable via normal paths;
 * this tool exists so Foundry residue can be scrubbed without inventing
 * a dangerous "Delete League" button for hosts.
 */

import { createClient } from "@/lib/supabase/client";
import { isAppCreator } from "@/lib/creator";
import { getSession } from "@/lib/league";
import { wipeLeagueTrophiesForSandbox } from "@/lib/trophies";
import {
  clearLeagueEarnedLedger,
  listLeagueEarnedBadges,
} from "@/lib/league-earned-ledger";
import {
  revokePermanentBadgeId,
  getPermanentBadgeIds,
} from "@/lib/permanent-badges";
import { unbankCareerBadgeId } from "@/lib/career-cheevo";
import { getBadgeDef } from "@/lib/badges";
import { clearSandboxBadgeEarnMeta, clearBadgeEarnMetaForIds } from "@/lib/badge-earn-meta";
import { fetchMyMemberships } from "@/lib/session-restore";

export type AdminLeagueCleanupRow = {
  leagueId: string;
  name: string;
  code: string;
  sportId: string;
  isCommissioner: boolean;
  trophyCount: number;
  crystalBallTrophies: number;
  otherHumans: number;
  sampleTrophies: { type: string; winner: string; year: number }[];
};

export type AdminScrubReport = {
  ok: boolean;
  error?: string;
  leagueId: string;
  trophiesDeleted: number;
  badgesRevoked: number;
  careerUnbanked: number;
  membersScrubbed: number;
  leagueDeleted: boolean;
  notes: string[];
};

function requireCreator(): { ok: true; userId: string } | { ok: false; error: string } {
  const session = getSession();
  const uid = session?.playerId;
  if (!uid || !isAppCreator(uid)) {
    return {
      ok: false,
      error: "Admin cleanup is creator-only (Foundry).",
    };
  }
  return { ok: true, userId: uid };
}

/**
 * List leagues you can see + trophy contamination signals.
 */
export async function listAdminCleanupLeagues(): Promise<{
  ok: boolean;
  error?: string;
  leagues: AdminLeagueCleanupRow[];
}> {
  const auth = requireCreator();
  if (!auth.ok) return { ok: false, error: auth.error, leagues: [] };

  const memberships = await fetchMyMemberships();
  const supabase = createClient();
  const out: AdminLeagueCleanupRow[] = [];

  for (const m of memberships) {
    const leagueId = m.leagueId;
    let trophyCount = 0;
    let crystalBallTrophies = 0;
    const sampleTrophies: AdminLeagueCleanupRow["sampleTrophies"] = [];
    let otherHumans = 0;

    try {
      const { data: trophies } = await supabase
        .from("league_trophies")
        .select("trophy_type, winner_name, season_year, winner_user_id")
        .eq("league_id", leagueId);
      const rows = trophies || [];
      trophyCount = rows.length;
      for (const t of rows) {
        if (t.trophy_type === "crystal_ball") crystalBallTrophies += 1;
        if (sampleTrophies.length < 6) {
          sampleTrophies.push({
            type: String(t.trophy_type || ""),
            winner: String(t.winner_name || ""),
            year: Number(t.season_year) || 0,
          });
        }
      }
    } catch {
      /* table may be missing */
    }

    try {
      const { data: mems } = await supabase
        .from("memberships")
        .select("user_id, is_bot")
        .eq("league_id", leagueId);
      otherHumans = (mems || []).filter(
        (r) => !r.is_bot && r.user_id !== auth.userId
      ).length;
    } catch {
      /* ignore */
    }

    out.push({
      leagueId,
      name: m.leagueName || "War Room",
      code: m.code || "",
      sportId: m.sportId || "cfb",
      isCommissioner:
        m.role === "commissioner" || m.commissionerId === auth.userId,
      trophyCount,
      crystalBallTrophies,
      otherHumans,
      sampleTrophies,
    });
  }

  // Sort: most trophy contamination first, then crystal ball
  out.sort(
    (a, b) =>
      b.crystalBallTrophies - a.crystalBallTrophies ||
      b.trophyCount - a.trophyCount ||
      a.name.localeCompare(b.name)
  );

  return { ok: true, leagues: out };
}

/**
 * Strip permanent badges / career bank entries that were ledger-tied to this league.
 * Always revokes Village Nerd stack (national_nightmare) when crystal_ball trophy existed.
 */
function scrubLocalCareerForPlayer(
  playerId: string,
  leagueId: string,
  forceBadgeIds: string[]
): { revoked: number; unbanked: number } {
  let revoked = 0;
  let unbanked = 0;
  const fromLedger = listLeagueEarnedBadges(playerId, leagueId);
  const candidates = new Set([...fromLedger, ...forceBadgeIds]);

  for (const badgeId of candidates) {
    if (!badgeId) continue;
    // Do not strip pure creator identity
    if (badgeId === "the_commissioner") continue;

    const hadPerm = getPermanentBadgeIds(playerId).includes(badgeId);
    if (hadPerm && revokePermanentBadgeId(playerId, badgeId)) {
      revoked += 1;
    }
    const pts = getBadgeDef(badgeId)?.points ?? 0;
    try {
      unbankCareerBadgeId(playerId, badgeId, pts);
      unbanked += 1;
    } catch {
      /* ignore */
    }
  }

  clearLeagueEarnedLedger(playerId, leagueId);
  try {
    clearBadgeEarnMetaForIds(playerId, [...candidates]);
  } catch {
    /* ignore */
  }
  try {
    clearSandboxBadgeEarnMeta(playerId);
  } catch {
    /* ignore */
  }

  return { revoked, unbanked };
}

/**
 * Admin: scrub all career/hardware residue for a league, then optionally delete it.
 * Creator only. Prefer scrub without delete for production rooms you want to keep empty of sim hardware.
 */
export async function adminScrubLeagueCareer(opts: {
  leagueId: string;
  /** After scrub, hard-delete the league row (test rooms only recommended) */
  deleteLeagueAfter?: boolean;
}): Promise<AdminScrubReport> {
  const auth = requireCreator();
  const base: AdminScrubReport = {
    ok: false,
    leagueId: opts.leagueId,
    trophiesDeleted: 0,
    badgesRevoked: 0,
    careerUnbanked: 0,
    membersScrubbed: 0,
    leagueDeleted: false,
    notes: [],
  };
  if (!auth.ok) return { ...base, error: auth.error };
  if (!opts.leagueId) return { ...base, error: "No league id" };

  const supabase = createClient();
  const notes: string[] = [];

  // Collect winner ids from trophies before wipe
  const winnerIds = new Set<string>();
  let hadCrystalBall = false;
  try {
    const { data: trophies } = await supabase
      .from("league_trophies")
      .select("winner_user_id, trophy_type, winner_name")
      .eq("league_id", opts.leagueId);
    for (const t of trophies || []) {
      if (t.winner_user_id) winnerIds.add(String(t.winner_user_id));
      if (t.trophy_type === "crystal_ball") {
        hadCrystalBall = true;
        notes.push(
          `Village Nerd (crystal_ball) was on: ${t.winner_name || t.winner_user_id}`
        );
      }
    }
  } catch {
    /* ignore */
  }

  // Always include admin self
  winnerIds.add(auth.userId);

  // Members of league
  try {
    const { data: mems } = await supabase
      .from("memberships")
      .select("user_id, is_bot")
      .eq("league_id", opts.leagueId);
    for (const m of mems || []) {
      if (!m.is_bot && m.user_id) winnerIds.add(String(m.user_id));
    }
  } catch {
    /* ignore */
  }

  // Wipe cloud trophies (hardware case)
  const wipe = await wipeLeagueTrophiesForSandbox(opts.leagueId);
  if (!wipe.ok) {
    return { ...base, error: wipe.error || "Trophy wipe failed", notes };
  }
  base.trophiesDeleted = wipe.deleted ?? 0;
  notes.push(`Deleted ${base.trophiesDeleted} trophy engraving(s).`);

  // Force-revoke Village Nerd hardware badges when CB trophy existed
  const forceBadges = hadCrystalBall
    ? ["national_nightmare", "war_room_legend", "championship_ring", "toilet_crown"]
    : ["championship_ring", "toilet_crown", "national_nightmare"];

  for (const uid of winnerIds) {
    const r = scrubLocalCareerForPlayer(uid, opts.leagueId, forceBadges);
    base.badgesRevoked += r.revoked;
    base.careerUnbanked += r.unbanked;
    base.membersScrubbed += 1;
  }
  notes.push(
    `Scrubbed local career for ${base.membersScrubbed} member(s); revoked ${base.badgesRevoked} permanent badge grant(s).`
  );

  // Optional league delete (admin path — not commissioner product)
  if (opts.deleteLeagueAfter) {
    // Creator must be commissioner for RLS, or use delete as owner
    const { data: league } = await supabase
      .from("leagues")
      .select("commissioner_id, name")
      .eq("id", opts.leagueId)
      .maybeSingle();

    if (!league) {
      notes.push("League row already gone.");
    } else if (league.commissioner_id !== auth.userId) {
      notes.push(
        "Not commissioner of this room — trophies scrubbed, but league row not deleted. Pass keys or delete as host later if empty."
      );
    } else {
      // Prefer normal deleteLeague eval when disposable; creator may still need empty room
      const { evaluateLeagueDelete } = await import("./league-delete-guard");
      const eval_ = await evaluateLeagueDelete(opts.leagueId);
      if (eval_.canHardDelete) {
        const { deleteLeague } = await import("./session-restore");
        const del = await deleteLeague(opts.leagueId);
        if (del.ok) {
          base.leagueDeleted = true;
          notes.push(`Deleted league "${league.name}".`);
        } else {
          notes.push(`League delete failed: ${del.error}`);
        }
      } else {
        // Creator admin escape for contaminated sim rooms only:
        // after trophy wipe, if still blocked (other humans), refuse mass delete.
        notes.push(
          `League not deleted (${eval_.reason}). History/people remain — only empty solo rooms delete. Pass keys or remove members first.`
        );
      }
    }
  }

  base.ok = true;
  base.notes = notes;
  return base;
}

/**
 * One-click: scrub every membership league that has Village Nerd / any trophies
 * and is a solo room (likely sim). Safer than mass-delete.
 */
export async function adminScrubAllCrystalBallContamination(): Promise<{
  ok: boolean;
  error?: string;
  reports: AdminScrubReport[];
}> {
  const list = await listAdminCleanupLeagues();
  if (!list.ok) return { ok: false, error: list.error, reports: [] };

  const targets = list.leagues.filter(
    (l) => l.crystalBallTrophies > 0 || l.trophyCount > 0
  );
  const reports: AdminScrubReport[] = [];

  for (const t of targets) {
    // Only auto-delete when solo (no other humans) — never nuke multi-player rooms
    const report = await adminScrubLeagueCareer({
      leagueId: t.leagueId,
      deleteLeagueAfter: t.otherHumans === 0 && t.isCommissioner,
    });
    reports.push(report);
  }

  return { ok: true, reports };
}

export type OrphanWeekPurgeReport = {
  ok: boolean;
  error?: string;
  leagueId: string;
  liveWeek: number;
  orphanWeeks: number[];
  deletedWeekCards: number;
  deletedWeekResults: number;
  notes: string[];
};

/**
 * Admin: delete Foundry/sim week inventory that sits AHEAD of trusted live week.
 * Example: live=0 but week_cards/week_results exist for week 5 → Board showed Week 5.
 *
 * Does NOT delete weeks ≤ live. Does NOT wipe the whole season.
 * Creator-only.
 */
export async function adminPurgeOrphanWeeksAheadOfLive(opts: {
  leagueId: string;
}): Promise<OrphanWeekPurgeReport> {
  const auth = requireCreator();
  const base: OrphanWeekPurgeReport = {
    ok: false,
    leagueId: opts.leagueId,
    liveWeek: 0,
    orphanWeeks: [],
    deletedWeekCards: 0,
    deletedWeekResults: 0,
    notes: [],
  };
  if (!auth.ok) return { ...base, error: auth.error };
  if (!opts.leagueId) return { ...base, error: "No league id" };

  const supabase = createClient();
  const notes: string[] = [];

  // Trusted live week from leagues.current_week
  let liveWeek = 0;
  try {
    const { data: lg } = await supabase
      .from("leagues")
      .select("current_week, sport_id")
      .eq("id", opts.leagueId)
      .maybeSingle();
    liveWeek = Number(lg?.current_week);
    if (!Number.isFinite(liveWeek)) liveWeek = lg?.sport_id === "nfl" ? 1 : 0;
  } catch {
    liveWeek = 0;
  }
  base.liveWeek = liveWeek;

  // Collect week numbers from cards + results ahead of live
  const orphanSet = new Set<number>();
  try {
    const { data: cards } = await supabase
      .from("week_cards")
      .select("id, week_number")
      .eq("league_id", opts.leagueId);
    for (const c of cards || []) {
      const w = Number(c.week_number);
      if (Number.isFinite(w) && w > liveWeek && w !== 99) orphanSet.add(w);
    }
  } catch {
    notes.push("Could not list week_cards.");
  }
  try {
    const { data: results } = await supabase
      .from("week_results")
      .select("id, week_number")
      .eq("league_id", opts.leagueId);
    for (const r of results || []) {
      const w = Number(r.week_number);
      if (Number.isFinite(w) && w > liveWeek && w !== 99) orphanSet.add(w);
    }
  } catch {
    notes.push("Could not list week_results.");
  }

  const orphanWeeks = [...orphanSet].sort((a, b) => a - b);
  base.orphanWeeks = orphanWeeks;
  if (!orphanWeeks.length) {
    notes.push(
      `No orphan weeks ahead of live week ${liveWeek}. Board should stay clean.`
    );
    base.ok = true;
    base.notes = notes;
    return base;
  }

  notes.push(
    `Live week=${liveWeek}. Purging sim residue weeks: ${orphanWeeks.join(", ")}`
  );

  // Delete week_results (+ game_results via cascade if configured; else explicit)
  try {
    const { data: wr } = await supabase
      .from("week_results")
      .select("id")
      .eq("league_id", opts.leagueId)
      .in("week_number", orphanWeeks);
    const wrIds = (wr || []).map((r) => r.id as string).filter(Boolean);
    if (wrIds.length) {
      await supabase.from("game_results").delete().in("week_result_id", wrIds);
      const { data: delWr, error } = await supabase
        .from("week_results")
        .delete()
        .eq("league_id", opts.leagueId)
        .in("week_number", orphanWeeks)
        .select("id");
      if (error) notes.push(`week_results delete: ${error.message}`);
      else base.deletedWeekResults = delWr?.length ?? wrIds.length;
    }
  } catch (e) {
    notes.push(
      `week_results purge failed: ${e instanceof Error ? e.message : "error"}`
    );
  }

  // Delete week_cards (+ card_games via cascade if present)
  try {
    const { data: cards } = await supabase
      .from("week_cards")
      .select("id")
      .eq("league_id", opts.leagueId)
      .in("week_number", orphanWeeks);
    const cardIds = (cards || []).map((c) => c.id as string).filter(Boolean);
    if (cardIds.length) {
      try {
        await supabase.from("card_games").delete().in("week_card_id", cardIds);
      } catch {
        /* optional table */
      }
      try {
        await supabase.from("picks").delete().in("week_card_id", cardIds);
      } catch {
        /* optional */
      }
      const { data: delCards, error } = await supabase
        .from("week_cards")
        .delete()
        .eq("league_id", opts.leagueId)
        .in("week_number", orphanWeeks)
        .select("id");
      if (error) notes.push(`week_cards delete: ${error.message}`);
      else base.deletedWeekCards = delCards?.length ?? cardIds.length;
    }
  } catch (e) {
    notes.push(
      `week_cards purge failed: ${e instanceof Error ? e.message : "error"}`
    );
  }

  // Clear client scored/card caches so Board reloads clean
  try {
    const { invalidateCloudWeekCaches } = await import("./cloud");
    invalidateCloudWeekCaches(opts.leagueId);
  } catch {
    /* ok */
  }

  notes.push(
    `Deleted ${base.deletedWeekCards} week card(s), ${base.deletedWeekResults} week result(s).`
  );
  base.ok = true;
  base.notes = notes;
  return base;
}

/** Purge orphan weeks for every membership league (creator). */
export async function adminPurgeAllOrphanWeeksAheadOfLive(): Promise<{
  ok: boolean;
  error?: string;
  reports: OrphanWeekPurgeReport[];
}> {
  const list = await listAdminCleanupLeagues();
  if (!list.ok) return { ok: false, error: list.error, reports: [] };
  const reports: OrphanWeekPurgeReport[] = [];
  for (const row of list.leagues) {
    const r = await adminPurgeOrphanWeeksAheadOfLive({
      leagueId: row.leagueId,
    });
    reports.push(r);
  }
  return { ok: true, reports };
}
