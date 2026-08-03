"use client";

/**
 * Production-safe War Room Moments runtime host.
 * Never goes through RoomDeferredChrome.
 *
 * Mounts real presentation surfaces that were previously trapped in
 * DeferredChrome (Ring, Gazette) so Foundry + production can actually run them.
 */

import dynamic from "next/dynamic";

const SeasonOpeningMoment = dynamic(
  () => import("@/components/moments/SeasonOpeningMoment"),
  { ssr: false }
);

/** Championship / defending-champ ring walk — full ceremony, not a page redirect */
const RingCeremonyModal = dynamic(
  () => import("@/components/RingCeremonyModal"),
  { ssr: false }
);

/** Scored-week newspaper — must not silently open Home */
const GazetteModal = dynamic(
  () => import("@/components/GazetteModal"),
  { ssr: false }
);

/** Preseason cold open — mount so Foundry preview is not a dead route */
const WeeklyColdOpenModal = dynamic(
  () => import("@/components/WeeklyColdOpenModal"),
  { ssr: false }
);

export default function MomentHost() {
  return (
    <>
      <SeasonOpeningMoment />
      <RingCeremonyModal />
      <GazetteModal />
      <WeeklyColdOpenModal />
    </>
  );
}
