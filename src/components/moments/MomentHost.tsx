"use client";

/**
 * Production-safe War Room Moments runtime host.
 *
 * SAFE NAV MODE (default ON): mounts nothing — auto Moments / cinematics
 * cannot intercept navigation while we prove base app stability.
 * Creator override: localStorage warroom-safe-nav-off=1
 */

import dynamic from "next/dynamic";
import { isSafeNavMode } from "@/lib/safe-nav";

const SeasonOpeningMoment = dynamic(
  () => import("@/components/moments/SeasonOpeningMoment"),
  { ssr: false }
);

const RingCeremonyModal = dynamic(
  () => import("@/components/RingCeremonyModal"),
  { ssr: false }
);

const GazetteModal = dynamic(
  () => import("@/components/GazetteModal"),
  { ssr: false }
);

const WeeklyColdOpenModal = dynamic(
  () => import("@/components/WeeklyColdOpenModal"),
  { ssr: false }
);

export default function MomentHost() {
  // P0: no auto moments / full-screen cinematics until nav is proven stable
  if (isSafeNavMode()) {
    return null;
  }

  return (
    <>
      <SeasonOpeningMoment />
      <RingCeremonyModal />
      <GazetteModal />
      <WeeklyColdOpenModal />
    </>
  );
}
