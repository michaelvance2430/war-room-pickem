"use client";

/**
 * Production-safe Moment runtime host.
 * Never goes through RoomDeferredChrome.
 * One blocking Moment surface for now: Season Opening.
 */

import dynamic from "next/dynamic";

const SeasonOpeningMoment = dynamic(
  () => import("@/components/moments/SeasonOpeningMoment"),
  { ssr: false }
);

export default function MomentHost() {
  return <SeasonOpeningMoment />;
}
