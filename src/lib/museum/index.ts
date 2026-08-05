/**
 * Museum Phase 1A foundation exports.
 * No production event generation. No Rivalry Wing UI.
 */

export * from "./types";
export * from "./identity";
export * from "./gates";
export {
  buildSnapshotGamePayloads,
  rebuildAllegianceSnapshotsAfterPublish,
  freezeAllegianceSnapshotsIfLocked,
} from "./snapshots";
export {
  buildDurableScoreInputs,
  persistDurableFinalScores,
} from "./final-scores";
export {
  MUSEUM_EVENT_GENERATION_ENABLED,
  tryGenerateFanFavoriteRivalryExhibits,
} from "./generator-stub";
