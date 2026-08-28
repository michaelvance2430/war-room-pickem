/**
 * Build + validate durable snapshot *plans* (pure, side-effect free).
 * Does not write Supabase or touch production.
 */

import { planFirstRoundByes } from "./byes";
import { filterEligibleActiveHumans } from "./eligibility";
import { partitionPostseasonFields } from "./partition";
import { sortChampionshipOrder } from "./ordering";
import { validateSnapshotPlan } from "./validate";
import type {
  CreationReason,
  PlannedParticipant,
  PostseasonMemberInput,
  SnapshotPlan,
  ValidationResult,
} from "./types";
import { canonicalSeasonKey } from "./season-identity";

export type BuildSnapshotPlanInput = {
  leagueId: string;
  sportId: string;
  cutWeek: number;
  cutPercent: unknown;
  /** Full membership list; filtered to eligible humans */
  members: readonly PostseasonMemberInput[];
  /** Optional; defaults to canonicalSeasonKey() */
  seasonKey?: string;
  creationReason?: CreationReason;
  initiatingActorUserId?: string | null;
  /** Already-frozen plan: re-score must not mutate — pass through for identity checks */
  existingFrozenPlan?: SnapshotPlan | null;
  /**
   * User ids who joined after freeze — excluded from a new plan when
   * simulating post-cut join against an already-built frozen field list.
   * When building fresh, omit.
   */
  excludeUserIds?: readonly string[];
};

/**
 * Construct a deterministic snapshot plan from standings + cut rules.
 * If existingFrozenPlan is provided, returns it unchanged (re-score safety).
 */
export function buildSnapshotPlan(input: BuildSnapshotPlanInput): {
  plan: SnapshotPlan | null;
  validation: ValidationResult;
  error?: string;
} {
  if (input.existingFrozenPlan) {
    const validation = validateSnapshotPlan(input.existingFrozenPlan);
    return { plan: input.existingFrozenPlan, validation };
  }

  if (!input.leagueId?.trim()) {
    return {
      plan: null,
      validation: { ok: false, errors: ["leagueId required"] },
      error: "leagueId required",
    };
  }

  let eligible = filterEligibleActiveHumans(input.members);
  if (input.excludeUserIds?.length) {
    const ban = new Set(input.excludeUserIds);
    eligible = eligible.filter((m) => !ban.has(m.userId));
  }

  // Deterministic: sort by id after filter before partition re-sorts by standings
  eligible = sortChampionshipOrder(eligible);

  const part = partitionPostseasonFields(eligible, input.cutPercent);
  if (!part.ok) {
    return {
      plan: null,
      validation: { ok: false, errors: [part.error] },
      error: part.error,
    };
  }

  const seasonKey = input.seasonKey ?? canonicalSeasonKey();
  const participants: PlannedParticipant[] = [];

  if (!part.contested) {
    for (const m of part.nonQualifiers) {
      participants.push({
        userId: m.userId,
        displayName: m.displayName,
        field: "eliminated",
        seed: null,
        firstRoundBye: false,
        divisionSnapshot: m.division ? String(m.division) : null,
        standingsRankAtCut: null,
        seasonPointsAtCut: m.totalPoints,
      });
    }

    const plan: SnapshotPlan = {
      leagueId: input.leagueId,
      seasonKey,
      sportId: input.sportId || "cfb",
      cutWeek: input.cutWeek,
      cutPercent: part.cutPercent,
      eligibleHumanCount: eligible.length,
      qualifierCount: 0,
      toiletBowlActive: false,
      contested: false,
      uncontestedReason: part.uncontestedReason,
      participants,
      creationReason: input.creationReason || "cut_week_scored",
      initiatingActorUserId: input.initiatingActorUserId ?? null,
      metadata: {
        formula: "ceil(n*(100-cut)/100)",
        engine: "ps1-pure",
      },
    };

    const validation = validateSnapshotPlan(plan);
    return { plan, validation };
  }

  // Championship seeds 1..q (already championship order)
  const champByes = planFirstRoundByes(part.championship.length);
  part.championship.forEach((m, i) => {
    const seed = i + 1;
    participants.push({
      userId: m.userId,
      displayName: m.displayName,
      field: "championship",
      seed,
      firstRoundBye: !!champByes.byeBySeed.get(seed),
      divisionSnapshot: m.division ? String(m.division) : null,
      standingsRankAtCut: i + 1,
      seasonPointsAtCut: m.totalPoints,
    });
  });

  if (part.toiletBowlActive) {
    const toiletIds = new Set(part.toiletParticipants.map((m) => m.userId));
    const toiletByes = planFirstRoundByes(part.toiletParticipants.length);
    part.toiletParticipants.forEach((m, i) => {
      const seed = i + 1;
      participants.push({
        userId: m.userId,
        displayName: m.displayName,
        field: "toilet",
        seed,
        firstRoundBye: !!toiletByes.byeBySeed.get(seed),
        divisionSnapshot: m.division ? String(m.division) : null,
        standingsRankAtCut: null,
        seasonPointsAtCut: m.totalPoints,
      });
    });
    for (const m of part.nonQualifiers) {
      if (toiletIds.has(m.userId)) continue;
      participants.push({
        userId: m.userId,
        displayName: m.displayName,
        field: "eliminated",
        seed: null,
        firstRoundBye: false,
        divisionSnapshot: m.division ? String(m.division) : null,
        standingsRankAtCut: eligible.findIndex((x) => x.userId === m.userId) + 1,
        seasonPointsAtCut: m.totalPoints,
      });
    }
  } else {
    // Non-qualifiers eliminated — Not contested toilet
    for (const m of part.nonQualifiers) {
      participants.push({
        userId: m.userId,
        displayName: m.displayName,
        field: "eliminated",
        seed: null,
        firstRoundBye: false,
        divisionSnapshot: m.division ? String(m.division) : null,
        standingsRankAtCut: null,
        seasonPointsAtCut: m.totalPoints,
      });
    }
  }

  // Stable participant order for plan identity: field order then seed
  participants.sort((a, b) => {
    const fo = fieldOrder(a.field) - fieldOrder(b.field);
    if (fo !== 0) return fo;
    return (a.seed ?? 999) - (b.seed ?? 999);
  });

  const plan: SnapshotPlan = {
    leagueId: input.leagueId,
    seasonKey,
    sportId: input.sportId || "cfb",
    cutWeek: input.cutWeek,
    cutPercent: part.cutPercent,
    eligibleHumanCount: eligible.length,
    qualifierCount: part.qualifierCount,
    toiletBowlActive: part.toiletBowlActive,
    contested: true,
    uncontestedReason: null,
    participants,
    creationReason: input.creationReason || "cut_week_scored",
    initiatingActorUserId: input.initiatingActorUserId ?? null,
    metadata: {
      formula: "min(16,ceil(n*(100-cut)/100))",
      engine: "ps1-pure",
      toiletLabel: part.toiletBowlActive ? "active" : "Not contested",
    },
  };

  const validation = validateSnapshotPlan(plan);
  return { plan, validation, error: validation.ok ? undefined : validation.errors.join("; ") };
}

function fieldOrder(f: PlannedParticipant["field"]): number {
  if (f === "championship") return 0;
  if (f === "toilet") return 1;
  return 2;
}

/** Stable JSON fingerprint for plan equality tests (ignores metadata noise if needed). */
export function snapshotPlanFingerprint(plan: SnapshotPlan): string {
  const body = {
    leagueId: plan.leagueId,
    seasonKey: plan.seasonKey,
    sportId: plan.sportId,
    cutWeek: plan.cutWeek,
    cutPercent: plan.cutPercent,
    eligibleHumanCount: plan.eligibleHumanCount,
    qualifierCount: plan.qualifierCount,
    toiletBowlActive: plan.toiletBowlActive,
    contested: plan.contested,
    participants: plan.participants.map((p) => ({
      userId: p.userId,
      field: p.field,
      seed: p.seed,
      firstRoundBye: p.firstRoundBye,
    })),
  };
  return JSON.stringify(body);
}
