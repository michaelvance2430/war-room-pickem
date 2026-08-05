/**
 * Museum Phase 1A — shared types.
 * Permanent event generation remains disabled until Phase 1B approval.
 */

export type MuseumEventType = "fan_favorite_rivalry";

/** Snapshot lifecycle — prelock is replaceable; frozen is immutable. */
export type AllegianceSnapshotStatus = "prelock" | "frozen";

export type RepresentedSide = "home" | "away";

export type MuseumParticipantOutcome = "won" | "lost" | "push" | "no_pick";

/** One game line for rebuild RPC (canonical teams already resolved confidently). */
export type AllegianceSnapshotGameInput = {
  cardGameId: string | null;
  providerGameId: string | null;
  gameIdentityKey: string;
  awayTeamId: string;
  homeTeamId: string;
  awayTeamName: string;
  homeTeamName: string;
  cardFavorite: "home" | "away" | null;
  cardSpread: number | null;
  awayRank: number | null;
  homeRank: number | null;
  rankSource: string | null;
};

export type DurableFinalScoreInput = {
  cardGameId: string | null;
  providerGameId: string | null;
  gameIdentityKey: string;
  awayTeamId: string | null;
  homeTeamId: string | null;
  awayTeamName: string;
  homeTeamName: string;
  awayScore: number;
  homeScore: number;
  /** null = unknown (default). Never invent OT. */
  overtime: boolean | null;
  sourceTimestamp: string | null;
  cardFavorite: "home" | "away" | null;
  cardSpread: number | null;
  underdogSide: "home" | "away" | null;
  awayRank: number | null;
  homeRank: number | null;
  rankSource: string | null;
};

export type RebuildSnapshotsResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  inserted?: number;
  frozen?: boolean;
  games?: number;
  error?: string;
};

export type UpsertFinalScoresResult = {
  ok: boolean;
  upserted?: number;
  error?: string;
};

export type FreezeSnapshotsResult = {
  ok: boolean;
  frozen?: boolean;
  updated?: number;
  reason?: string;
  error?: string;
};

/** Phase 1B will consume this shape; Phase 1A never writes events. */
export type MuseumEventRow = {
  id: string;
  leagueId: string;
  sportId: string;
  season: number;
  weekNumber: number;
  eventType: MuseumEventType;
  sourceCardId: string | null;
  sourceCardGameId: string | null;
  sourceProviderGameId: string | null;
  gameIdentityKey: string;
  occurredAt: string | null;
  finalizedAt: string;
  awayTeamId: string;
  homeTeamId: string;
  awayTeamNameSnapshot: string;
  homeTeamNameSnapshot: string;
  winningTeamId: string | null;
  losingTeamId: string | null;
  awayScore: number;
  homeScore: number;
  margin: number;
  overtime: boolean | null;
  factPayload: Record<string, unknown>;
  headline: string;
  plaque: string;
  humorPlaque: string;
  templateKey: string;
  templateVersion: number;
  tags: string[];
  createdAt: string;
};
