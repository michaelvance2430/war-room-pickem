import type { SportId } from "@/lib/sports/types";

/**
 * Native-safe Act III seam.
 *
 * The platform owns identity, truth, persistence, history, and lifecycle.
 * Each sport owns its postseason game. Consumers must render the chapter's
 * phases and mechanics; they must never substitute one sport's UI for another.
 */
export type ActThreeSportId = Extract<SportId, "cbb" | "cfb" | "nfl">;
export type ActThreeStatus = "reference_implemented" | "design_locked";
export type ActThreePhaseKind =
  | "reveal"
  | "prediction"
  | "allocation"
  | "elimination"
  | "finale"
  | "ceremony";

export type ActThreePhase = {
  id: string;
  label: string;
  kind: ActThreePhaseKind;
};

export type ActThreeChapter = {
  sportId: ActThreeSportId;
  name: string;
  status: ActThreeStatus;
  nativeRequired: true;
  shared: {
    account: true;
    leagueIdentity: true;
    profileHistory: true;
    achievementsAndTrophies: true;
    gazetteAndNotifications: true;
    databaseLockAuthority: true;
    foundryProofRequired: true;
  };
  phases: readonly ActThreePhase[];
  prediction: {
    preseasonReceiptVisible: true;
    lockAuthority: "database_first_real_kickoff_or_tip";
    payoff: string;
  };
  game: {
    signature: string;
    participation: string;
    scoring: string;
    strategy: string;
  };
  activation: {
    configFinalized: boolean;
    productionEnabled: boolean;
  };
  foundryProof: readonly string[];
};

const SHARED_ACT_THREE_SERVICES = {
  account: true,
  leagueIdentity: true,
  profileHistory: true,
  achievementsAndTrophies: true,
  gazetteAndNotifications: true,
  databaseLockAuthority: true,
  foundryProofRequired: true,
} as const;

export const ACT_THREE_CHAPTERS: Record<ActThreeSportId, ActThreeChapter> = {
  cbb: {
    sportId: "cbb",
    name: "The Fieldhouse · March Mode",
    status: "reference_implemented",
    nativeRequired: true,
    shared: SHARED_ACT_THREE_SERVICES,
    phases: [
      { id: "selection-show", label: "Selection Sunday", kind: "reveal" },
      { id: "national-bracket", label: "The Field of 68", kind: "prediction" },
      { id: "war-room-brackets", label: "Championship + Toilet Bowl", kind: "elimination" },
      { id: "national-title", label: "National Championship", kind: "finale" },
      { id: "rings", label: "Ring Ceremony", kind: "ceremony" },
    ],
    prediction: {
      preseasonReceiptVisible: true,
      lockAuthority: "database_first_real_kickoff_or_tip",
      payoff: "Village Nerd · preseason national champion prophecy",
    },
    game: {
      signature: "Every NCAA tournament game; 67 decisions",
      participation: "Everyone keeps picking after War Room bracket elimination",
      scoring: "March round scoring plus frozen-seed War Room bracket advancement",
      strategy: "Complete bracket plus round-specific decisions",
    },
    activation: { configFinalized: true, productionEnabled: false },
    foundryProof: [
      "Selection Sunday opens the complete bracket",
      "All 67 decisions persist and score",
      "Championship and Toilet Bowl resolve without overlap",
      "Village Nerd and Ring Ceremony resolve",
      "Season cannot advance beyond its final window",
    ],
  },
  cfb: {
    sportId: "cfb",
    name: "Bowl Mania · Road Through the CFP",
    status: "design_locked",
    nativeRequired: true,
    shared: SHARED_ACT_THREE_SERVICES,
    phases: [
      { id: "bowl-reveal", label: "Bowl Slate Reveal", kind: "reveal" },
      { id: "bowl-bankroll", label: "Bowl Mania", kind: "allocation" },
      { id: "cfp-bracket", label: "Road Through the CFP", kind: "prediction" },
      { id: "cfp-title", label: "National Championship", kind: "finale" },
      { id: "cfb-rings", label: "Ring Ceremony", kind: "ceremony" },
    ],
    prediction: {
      preseasonReceiptVisible: true,
      lockAuthority: "database_first_real_kickoff_or_tip",
      payoff: "Week 0 Crystal Ball receipt survives through the CFP",
    },
    game: {
      signature: "Curated bowl campaign feeding the CFP bracket",
      participation: "Every active player remains involved through bowl season",
      scoring: "15–25 curated bowls plus CFP outcomes",
      strategy: "Allocate a fixed 100-point bowl bankroll; reward obscure-bowl knowledge",
    },
    activation: { configFinalized: false, productionEnabled: false },
    foundryProof: [
      "Bowl catalog and real kickoff locks are authoritative",
      "Exactly 100 bankroll points are allocated without duplication or overspend",
      "CFP bracket advances from real results",
      "Certified Sicko uses only eligible obscure bowls",
      "Week 0 Crystal Ball payoff and Ring Ceremony resolve",
    ],
  },
  nfl: {
    sportId: "nfl",
    name: "The Road to the Bowl",
    status: "design_locked",
    nativeRequired: true,
    shared: SHARED_ACT_THREE_SERVICES,
    phases: [
      { id: "playoff-reveal", label: "Playoff Field Reveal", kind: "reveal" },
      { id: "playoff-bracket", label: "The Road to the Bowl", kind: "prediction" },
      { id: "nuclear-bank", label: "Nuclear Chip Arsenal", kind: "allocation" },
      { id: "conference-crowns", label: "AFC + NFC Championships", kind: "elimination" },
      { id: "super-bowl", label: "The Super Bowl", kind: "finale" },
      { id: "nfl-rings", label: "Ring Ceremony", kind: "ceremony" },
    ],
    prediction: {
      preseasonReceiptVisible: true,
      lockAuthority: "database_first_real_kickoff_or_tip",
      payoff: "Week 1 Super Bowl Crystal Ball remains visible through the postseason",
    },
    game: {
      signature: "Full NFL playoff bracket with AFC, NFC, matchup, and champion picks",
      participation: "Every active player plays through the Super Bowl",
      scoring: "Playoff game outcomes plus bracket milestones",
      strategy: "A limited consumable confidence arsenal forces spend-now or save-later decisions",
    },
    activation: { configFinalized: false, productionEnabled: false },
    foundryProof: [
      "Wild Card field and byes match the official bracket",
      "AFC and NFC paths advance without reseeding errors",
      "Each Nuclear Chip can be spent only once",
      "Unspent chips remain available in later rounds",
      "Week 1 Crystal Ball payoff and Ring Ceremony resolve",
    ],
  },
};

export function getActThreeChapter(sportId: ActThreeSportId): ActThreeChapter {
  return ACT_THREE_CHAPTERS[sportId];
}

/** Blocks a chapter from activation while founder-level tuning is unresolved. */
export function canActivateActThree(chapter: ActThreeChapter): boolean {
  return chapter.activation.configFinalized && chapter.activation.productionEnabled;
}

export function validateActThreeChapter(chapter: ActThreeChapter): string[] {
  const errors: string[] = [];
  if (!chapter.nativeRequired) errors.push("Act III must ship in the native app.");
  if (!chapter.shared.databaseLockAuthority) errors.push("Database lock authority is required.");
  if (!chapter.shared.foundryProofRequired) errors.push("Foundry proof is required.");
  if (!chapter.phases.length) errors.push("At least one Act III phase is required.");
  if (new Set(chapter.phases.map((phase) => phase.id)).size !== chapter.phases.length) {
    errors.push("Act III phase ids must be unique.");
  }
  if (!chapter.phases.some((phase) => phase.kind === "finale")) errors.push("A finale is required.");
  if (!chapter.phases.some((phase) => phase.kind === "ceremony")) errors.push("A ceremony is required.");
  if (!chapter.foundryProof.length) errors.push("Foundry proof cases are required.");
  return errors;
}
