/**
 * Stage PS1 — pure postseason types (no I/O).
 * Law: docs/POSTSEASON-COMPETITION-LAW.md
 */

export type PostseasonField = "championship" | "toilet" | "eliminated";

export type CreationReason =
  | "cut_week_scored"
  | "manual_repair"
  | "system_backfill";

/** Minimal standings row for freeze planning (authoritative tiebreaks via Player map). */
export type PostseasonMemberInput = {
  userId: string;
  displayName: string;
  totalPoints: number;
  weeklyPoints?: number[];
  atsCorrect?: number;
  atsTotal?: number;
  currentStreak?: number;
  bestWeek?: number;
  worstWeek?: number;
  bestBetHits?: number;
  bestBetTotal?: number;
  propHits?: number;
  propTotal?: number;
  weeksPlayed?: number;
  division?: "North" | "South" | "East" | "West" | string | null;
  /** Production bot / trial bot */
  isBot?: boolean;
  /** Demo NPC */
  isMock?: boolean;
  /** Left the league */
  departed?: boolean;
  /** Foundry / fixture / sim */
  isFixture?: boolean;
  /** Active membership (default true) */
  isActive?: boolean;
};

export type CutPercentResult =
  | { ok: true; cutPercent: number }
  | { ok: false; error: string };

export type QualifierCountResult =
  | {
      ok: true;
      activeHumanCount: number;
      cutPercent: number;
      qualifierCount: number;
      /** When < 2 humans, postseason cannot be contested */
      contested: boolean;
    }
  | {
      ok: false;
      error: string;
      activeHumanCount: number;
      contested: false;
    };

export type PlannedParticipant = {
  userId: string;
  displayName: string;
  field: PostseasonField;
  seed: number | null;
  firstRoundBye: boolean;
  divisionSnapshot: string | null;
  standingsRankAtCut: number | null;
  seasonPointsAtCut: number | null;
};

export type SnapshotPlan = {
  leagueId: string;
  seasonKey: string;
  sportId: string;
  cutWeek: number;
  cutPercent: number;
  eligibleHumanCount: number;
  qualifierCount: number;
  toiletBowlActive: boolean;
  contested: boolean;
  /** Stable message when !contested */
  uncontestedReason: string | null;
  participants: PlannedParticipant[];
  creationReason: CreationReason;
  initiatingActorUserId: string | null;
  metadata: Record<string, unknown>;
};

export type FreezePreconditionInput = {
  /** Cut week number for this sport */
  cutWeek: number;
  /** Whether cut week scoring is about to complete / has completed in this transaction */
  cutWeekScoreAuthoritative: boolean;
  /** Snapshot already exists for league+season */
  snapshotAlreadyExists: boolean;
  /** Actor scoring the week */
  actorRole: "commissioner" | "deputy" | "member" | "system" | "service";
  actorUserId: string | null;
};

export type FreezePreconditionResult =
  | {
      ok: true;
      mayAutoFreeze: boolean;
      reason: string;
      creationReason: CreationReason;
    }
  | { ok: false; mayAutoFreeze: false; reason: string };

export type RepairEligibilityInput = {
  actorRole: "commissioner" | "deputy" | "member" | "system" | "service";
  /** Any authoritative postseason matchup result already recorded */
  postseasonResultExists: boolean;
  snapshotExists: boolean;
  repairNote: string | null | undefined;
};

export type RepairEligibilityResult =
  | { ok: true; mayRepair: true }
  | { ok: false; mayRepair: false; reason: string };

export type ValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] };
