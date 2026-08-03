"use client";

/**
 * P0 KILL SWITCH — entire coaching UI disabled.
 *
 * Previous implementation was reported as making the app unclickable
 * (invisible overlay / pointer capture). Do not re-enable until a
 * non-blocking, card-only coach is verified on desktop + mobile with:
 * - no full-screen layer
 * - outer highlight layers use pointer-events: none
 * - only the small card accepts clicks
 * - dismiss removes all nodes from the DOM
 *
 * Hooks in @/lib/coaching remain for flags/backfill; this component is a no-op.
 */

export default function ContextualCoach() {
  return null;
}
