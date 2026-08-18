import { createClient } from "@/lib/supabase/client";
import { getSession } from "@/lib/league";
import { canonicalSeasonKey } from "./season-identity";

export type FrozenPostseasonParticipant = {
  userId: string;
  displayName: string;
  field: "championship" | "toilet" | "eliminated";
  seed: number | null;
  firstRoundBye: boolean;
  division: string | null;
  standingsRankAtCut: number | null;
  seasonPointsAtCut: number | null;
};

export type FrozenPostseasonSnapshot = {
  id: string;
  leagueId: string;
  seasonKey: string;
  cutWeek: number;
  frozenAt: string;
  participants: FrozenPostseasonParticipant[];
};

/** Read-only authoritative cut snapshot. Missing schema/snapshot fails closed. */
export async function loadFrozenPostseasonSnapshot(
  seasonKey = canonicalSeasonKey()
): Promise<FrozenPostseasonSnapshot | null> {
  const leagueId = getSession()?.leagueId;
  if (!leagueId) return null;
  const supabase = createClient();
  const { data: snapshot, error } = await supabase
    .from("league_postseason_snapshots")
    .select("id,league_id,season_key,cut_week,frozen_at")
    .eq("league_id", leagueId)
    .eq("season_key", seasonKey)
    .maybeSingle();
  if (error || !snapshot) return null;

  const { data: rows, error: participantError } = await supabase
    .from("league_postseason_participants")
    .select("user_id,display_name_snapshot,field,seed,first_round_bye,division_snapshot,standings_rank_at_cut,season_points_at_cut")
    .eq("snapshot_id", snapshot.id)
    .order("field")
    .order("seed");
  if (participantError || !rows?.length) return null;

  return {
    id: snapshot.id as string,
    leagueId: snapshot.league_id as string,
    seasonKey: snapshot.season_key as string,
    cutWeek: Number(snapshot.cut_week),
    frozenAt: snapshot.frozen_at as string,
    participants: rows.map((row) => ({
      userId: row.user_id as string,
      displayName: row.display_name_snapshot as string,
      field: row.field as FrozenPostseasonParticipant["field"],
      seed: row.seed == null ? null : Number(row.seed),
      firstRoundBye: !!row.first_round_bye,
      division: (row.division_snapshot as string | null) || null,
      standingsRankAtCut:
        row.standings_rank_at_cut == null ? null : Number(row.standings_rank_at_cut),
      seasonPointsAtCut:
        row.season_points_at_cut == null ? null : Number(row.season_points_at_cut),
    })),
  };
}
