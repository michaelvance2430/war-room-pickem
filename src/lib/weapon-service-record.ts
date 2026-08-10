import { createClient } from "@/lib/supabase/client";

export type WeaponType = "tactical_nuke" | "dead_hand" | "jdam" | "hellfire";

export type WeaponServiceEvent = {
  id: string;
  userId: string;
  leagueId: string;
  leagueName: string;
  sportId: "cfb" | "nfl" | "cbb";
  seasonYear: number;
  weekNumber: number | null;
  weaponType: WeaponType;
  phase: "regular_season" | "postseason";
  status: "authorized" | "resolved" | "voided_by_admin";
  rawPoints: number | null;
  adjustedPoints: number | null;
  decisionsChanged: number | null;
  outcome: "success" | "failure" | "mixed" | null;
  authorizedAt: string;
  resolvedAt: string | null;
};

export type WeaponServiceSummary = {
  tacticalNukes: number;
  deadHands: number;
  jdams: number;
  hellfires: number;
  campaigns: number;
  total: number;
};

export const EMPTY_WEAPON_SERVICE_SUMMARY: WeaponServiceSummary = { tacticalNukes: 0, deadHands: 0, jdams: 0, hellfires: 0, campaigns: 0, total: 0 };

type CloudRow = {
  id: string; user_id: string; league_id: string; league_name: string;
  sport_id: "cfb" | "nfl" | "cbb"; season_year: number; week_number: number | null;
  weapon_type: WeaponType; phase: "regular_season" | "postseason";
  authorization_status: "authorized" | "resolved" | "voided_by_admin";
  raw_points: number | null; adjusted_points: number | null;
  decisions_changed: number | null; outcome: "success" | "failure" | "mixed" | null;
  authorized_at: string; resolved_at: string | null;
};

const SELECT = "id,user_id,league_id,league_name,sport_id,season_year,week_number,weapon_type,phase,authorization_status,raw_points,adjusted_points,decisions_changed,outcome,authorized_at,resolved_at";

function mapRow(row: CloudRow): WeaponServiceEvent {
  return { id: row.id, userId: row.user_id, leagueId: row.league_id, leagueName: row.league_name, sportId: row.sport_id, seasonYear: row.season_year, weekNumber: row.week_number, weaponType: row.weapon_type, phase: row.phase, status: row.authorization_status, rawPoints: row.raw_points, adjustedPoints: row.adjusted_points, decisionsChanged: row.decisions_changed, outcome: row.outcome, authorizedAt: row.authorized_at, resolvedAt: row.resolved_at };
}

/** Owner-only service history. Browsers have no INSERT/UPDATE/DELETE grant. */
export async function loadWeaponServiceRecord(userId: string): Promise<WeaponServiceEvent[]> {
  if (!userId) return [];
  try {
    const { data, error } = await createClient().from("weapon_service_events").select(SELECT).eq("user_id", userId).neq("authorization_status", "voided_by_admin").order("authorized_at", { ascending: false });
    if (error) throw error;
    return ((data || []) as unknown as CloudRow[]).map(mapRow);
  } catch { return []; }
}

/** One query for Gazette/rank evaluation across a roster. */
export async function loadWeaponServiceCounts(userIds: string[]): Promise<Map<string, Record<WeaponType, number>>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  const result = new Map<string, Record<WeaponType, number>>();
  if (!ids.length) return result;
  try {
    const { data, error } = await createClient().from("weapon_service_totals").select("user_id,tactical_nukes,dead_hands,jdams,hellfires").in("user_id", ids);
    if (error) throw error;
    for (const row of (data || []) as unknown as Array<{ user_id: string; tactical_nukes: number; dead_hands: number; jdams: number; hellfires: number }>) {
      result.set(row.user_id, { tactical_nuke: Number(row.tactical_nukes) || 0, dead_hand: Number(row.dead_hands) || 0, jdam: Number(row.jdams) || 0, hellfire: Number(row.hellfires) || 0 });
    }
  } catch { /* migration may not have reached this environment yet */ }
  return result;
}

/** Profile-safe aggregate: intentionally contains no operational event detail. */
export async function loadWeaponServiceSummary(userId: string): Promise<WeaponServiceSummary> {
  if (!userId) return EMPTY_WEAPON_SERVICE_SUMMARY;
  try {
    const { data, error } = await createClient().from("weapon_service_totals").select("tactical_nukes,dead_hands,jdams,hellfires,campaigns,total_authorizations").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    const row = data as { tactical_nukes?: number; dead_hands?: number; jdams?: number; hellfires?: number; campaigns?: number; total_authorizations?: number } | null;
    return row ? { tacticalNukes: Number(row.tactical_nukes) || 0, deadHands: Number(row.dead_hands) || 0, jdams: Number(row.jdams) || 0, hellfires: Number(row.hellfires) || 0, campaigns: Number(row.campaigns) || 0, total: Number(row.total_authorizations) || 0 } : EMPTY_WEAPON_SERVICE_SUMMARY;
  } catch { return EMPTY_WEAPON_SERVICE_SUMMARY; }
}

export function summarizeWeaponService(events: WeaponServiceEvent[]) {
  const active = events.filter((event) => event.status !== "voided_by_admin");
  const count = (type: WeaponType) => active.filter((event) => event.weaponType === type).length;
  return { total: active.length, tacticalNukes: count("tactical_nuke"), deadHands: count("dead_hand"), jdams: count("jdam"), hellfires: count("hellfire"), seasons: new Set(active.map((event) => `${event.sportId}:${event.seasonYear}`)).size, latest: active[0] || null };
}
