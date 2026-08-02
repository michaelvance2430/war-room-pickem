"use client";

/**
 * Deferred room chrome — STRICT budget.
 *
 * Freezes came from mounting 15+ dynamic modal chunks while the user was still
 * trying to click Home. Rules:
 * - Wave 0 only: roster hydrator (nameplates). Always, after Nav defers.
 * - Wave 1 (job-adjacent): only after 12s idle OR user has changed routes twice.
 * - Wave 2 (ceremonies/eggs/video): only after 25s, and only ONE slot group.
 * Never mount wave 2 if a wave-1 dialog is open.
 */

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import RoomDataHydrator from "@/components/RoomDataHydrator";
import { isGuestMode } from "@/lib/guest-mode";
import { hasVisibleModal } from "@/lib/smooth";

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
  const pathname = usePathname();
  const [wave, setWave] = useState(0);
  const [routeHops, setRouteHops] = useState(0);
  const [ceremonyOk, setCeremonyOk] = useState(false);

  // Count real navigation so look-around happens before popups
  useEffect(() => {
    setRouteHops((n) => n + 1);
  }, [pathname]);

  useEffect(() => {
    // Wave 1: user has poked around OR sat still long enough
    const armWave1 = () => setWave((w) => Math.max(w, 1));
    const t1 = window.setTimeout(armWave1, 12_000);
    return () => window.clearTimeout(t1);
  }, []);

  useEffect(() => {
    if (routeHops >= 2) setWave((w) => Math.max(w, 1));
  }, [routeHops]);

  useEffect(() => {
    // Wave 2: ceremonies only after the room is boring-stable
    if (wave < 1) return;
    let retry: number | undefined;
    const t2 = window.setTimeout(() => {
      if (hasVisibleModal()) {
        retry = window.setTimeout(() => setWave(2), 8_000);
        return;
      }
      setWave(2);
    }, 14_000);
    return () => {
      window.clearTimeout(t2);
      if (retry != null) window.clearTimeout(retry);
    };
  }, [wave]);

  // Stagger wave-2 children so cold-open video isn't competing with ring modal JS
  useEffect(() => {
    if (wave < 2) {
      setCeremonyOk(false);
      return;
    }
    const t = window.setTimeout(() => setCeremonyOk(true), 600);
    return () => window.clearTimeout(t);
  }, [wave]);

  return (
    <>
      {/* Wave 0: nameplates only — never blocks taps */}
      {!guest && <RoomDataHydrator />}

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

      {wave >= 2 && ceremonyOk && (
        <>
          {!guest && <SeasonCountdownTicker />}
          {!guest && <SeasonOpenWelcome />}
          {!guest && <CrewRevealModal />}
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
