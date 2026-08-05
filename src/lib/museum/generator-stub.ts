/**
 * Fan Favorite Rivalry generator — Phase 1A STUB (disabled).
 *
 * Phase 1B will implement real generation using:
 *  - museum_allegiance_snapshots (frozen, both sides)
 *  - game_final_scores (durable numeric finals)
 *  - pick_games at generation time
 *  - deterministic templates
 *
 * This stub must never insert museum_events.
 */

export const MUSEUM_EVENT_GENERATION_ENABLED = false as const;

export type GenerateRivalryResult = {
  ok: true;
  generated: false;
  reason: string;
};

/**
 * Intentionally inert. Call sites may invoke after scoring for future wiring;
 * always no-ops until Phase 1B flips MUSEUM_EVENT_GENERATION_ENABLED with approval.
 */
export async function tryGenerateFanFavoriteRivalryExhibits(_opts: {
  leagueId: string;
  weekNumber: number;
  weekResultId?: string | null;
}): Promise<GenerateRivalryResult> {
  void _opts;
  if (!MUSEUM_EVENT_GENERATION_ENABLED) {
    return {
      ok: true,
      generated: false,
      reason: "phase_1a_generation_disabled",
    };
  }
  // Unreachable until Phase 1B
  return {
    ok: true,
    generated: false,
    reason: "phase_1a_generation_disabled",
  };
}
