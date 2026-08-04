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
