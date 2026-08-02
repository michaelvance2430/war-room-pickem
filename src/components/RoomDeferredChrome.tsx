"use client";

/**
 * Heavy room chrome that does NOT need to be in the initial JS parse
 * or first paint of every page. Nav mounts this after idle.
 *
 * Keep first-session coaches (walkthrough / welcome / rules) out of here —
 * those stay eager in Nav.
 */

import dynamic from "next/dynamic";
import RoomDataHydrator from "@/components/RoomDataHydrator";
import { isGuestMode } from "@/lib/guest-mode";

const LeagueBuildLockReminder = dynamic(
  () => import("@/components/LeagueBuildLockReminder"),
  { ssr: false }
);
const CrewRevealModal = dynamic(() => import("@/components/CrewRevealModal"), {
  ssr: false,
});
const SeasonCountdownTicker = dynamic(
  () => import("@/components/SeasonCountdownTicker"),
  { ssr: false }
);
const SeasonOpenWelcome = dynamic(
  () => import("@/components/SeasonOpenWelcome"),
  { ssr: false }
);
const RingCeremonyModal = dynamic(
  () => import("@/components/RingCeremonyModal"),
  { ssr: false }
);
const SeasonFinaleModal = dynamic(
  () => import("@/components/SeasonFinaleModal"),
  { ssr: false }
);
const CardPublishedModal = dynamic(
  () => import("@/components/CardPublishedModal"),
  { ssr: false }
);
const BoredPracticeDoneModal = dynamic(
  () => import("@/components/BoredPracticeDoneModal"),
  { ssr: false }
);
const WeeklyColdOpenModal = dynamic(
  () => import("@/components/WeeklyColdOpenModal"),
  { ssr: false }
);
const BirthdayGazetteModal = dynamic(
  () => import("@/components/BirthdayGazetteModal"),
  { ssr: false }
);
const PlatformAnniversaryModal = dynamic(
  () => import("@/components/PlatformAnniversaryModal"),
  { ssr: false }
);
const GazetteModal = dynamic(() => import("@/components/GazetteModal"), {
  ssr: false,
});
const GazetteShelfReveal = dynamic(
  () => import("@/components/GazetteShelfReveal"),
  { ssr: false }
);
const StoryDoorModal = dynamic(() => import("@/components/StoryDoorModal"), {
  ssr: false,
});
const BadgeUnlockModal = dynamic(
  () => import("@/components/BadgeUnlockModal"),
  { ssr: false }
);
const EasterEggHost = dynamic(() => import("@/components/EasterEggHost"), {
  ssr: false,
});
const EggFlexNewspaper = dynamic(
  () => import("@/components/EggFlexNewspaper"),
  { ssr: false }
);
const MascotSighting = dynamic(() => import("@/components/MascotSighting"), {
  ssr: false,
});

export default function RoomDeferredChrome() {
  const guest = isGuestMode();

  return (
    <>
      {/* Single roster → titles / borders / join badges */}
      {!guest && <RoomDataHydrator />}

      {!guest && <LeagueBuildLockReminder />}
      {!guest && <CrewRevealModal />}
      {!guest && <SeasonCountdownTicker />}
      {!guest && <SeasonOpenWelcome />}
      {!guest && <RingCeremonyModal />}
      {!guest && <SeasonFinaleModal />}
      {!guest && <CardPublishedModal />}
      {!guest && <BoredPracticeDoneModal />}
      {!guest && <WeeklyColdOpenModal />}
      {!guest && <BirthdayGazetteModal />}
      {!guest && <PlatformAnniversaryModal />}

      <GazetteModal />
      <GazetteShelfReveal />
      <StoryDoorModal />
      <BadgeUnlockModal />

      {!guest && <EasterEggHost />}
      {!guest && <EggFlexNewspaper />}
      {!guest && <MascotSighting />}
    </>
  );
}
