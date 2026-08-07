"use client";

/**
 * Production-safe War Room Moments runtime host.
 *
 * SAFE NAV MODE (default ON): mounts only founder-graduated Moments.
 * Season Cold Open is approved for one-time production playback beginning
 * Aug 17, 2026. Every other auto Moment remains frozen.
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
  // Founder-graduated exception: Cold Open owns its release + seen gates.
  if (isSafeNavMode()) {
    return <WeeklyColdOpenModal />;
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
