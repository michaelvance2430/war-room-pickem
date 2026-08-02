"use client";

/**
 * Staged heavy chrome — never mount 15+ modals in one tick.
 * Wave 0: roster hydrator only (titles/borders).
 * Wave 1: interactive room modals (badges, gazette, story).
 * Wave 2: rare ceremonies / eggs.
 */

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import RoomDataHydrator from "@/components/RoomDataHydrator";
import { isGuestMode } from "@/lib/guest-mode";

const LoginWelcomeModal = dynamic(
  () => import("@/components/LoginWelcomeModal"),
  { ssr: false }
);
const RulesOnboardingModal = dynamic(
  () => import("@/components/RulesOnboardingModal"),
  { ssr: false }
);
const BadgeUnlockModal = dynamic(
  () => import("@/components/BadgeUnlockModal"),
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
const CardPublishedModal = dynamic(
  () => import("@/components/CardPublishedModal"),
  { ssr: false }
);
const BoredPracticeDoneModal = dynamic(
  () => import("@/components/BoredPracticeDoneModal"),
  { ssr: false }
);
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
  const [wave, setWave] = useState(0);

  useEffect(() => {
    // Critical path = hydrator only. Popups/ceremonies wait until look-around
    // works. Jul 31–Aug 2 freezes were this stack racing the user on open.
    const t1 = window.setTimeout(() => setWave(1), 8_000);
    const t2 = window.setTimeout(() => setWave(2), 20_000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  return (
    <>
      {/* Always: one roster hydrate for nameplates */}
      {!guest && <RoomDataHydrator />}

      {/* Wave 1: room signals after tabs are already usable */}
      {wave >= 1 && (
        <>
          {!guest && <LoginWelcomeModal />}
          {!guest && <RulesOnboardingModal />}
          {!guest && <LeagueBuildLockReminder />}
          {!guest && <CardPublishedModal />}
          {!guest && <BoredPracticeDoneModal />}
          <GazetteModal />
          <GazetteShelfReveal />
          <StoryDoorModal />
          <BadgeUnlockModal />
        </>
      )}

      {/* Wave 2: rare ceremonies — long after first paint is boring */}
      {wave >= 2 && (
        <>
          {!guest && <CrewRevealModal />}
          {!guest && <SeasonCountdownTicker />}
          {!guest && <SeasonOpenWelcome />}
          {!guest && <RingCeremonyModal />}
          {!guest && <SeasonFinaleModal />}
          {!guest && <WeeklyColdOpenModal />}
          {!guest && <BirthdayGazetteModal />}
          {!guest && <PlatformAnniversaryModal />}
          {!guest && <EasterEggHost />}
          {!guest && <EggFlexNewspaper />}
          {!guest && <MascotSighting />}
        </>
      )}
    </>
  );
}
