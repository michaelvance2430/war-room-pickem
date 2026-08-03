"use client";

/**
 * Deferred room chrome — STRICT budget.
 *
 * EMERGENCY (2026-08): NOT mounted in production. DeferredChromeGate returns
 * null and never imports this module when NODE_ENV=production. Keep this file
 * for offline isolation of children after freezes are contained.
 *
 * Freezes came from mounting 15+ dynamic modal chunks while the user was still
 * trying to click Home. Rules:
 * - Wave 0 only: roster hydrator (nameplates). Always, after Nav defers.
 * - Wave 1 (job-adjacent): only after 12s idle OR user has changed routes twice.
 * - Wave 2 (ceremonies/eggs/video): only after 25s, and only ONE slot group.
 * Never mount wave 2 if a wave-1 dialog is open.
 *
 * Isolation (dev): localStorage warroom-iso
 *   { deferred:false } | { wave1:false } | { wave2:false }
 */

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import RoomDataHydrator from "@/components/RoomDataHydrator";
import { isGuestMode } from "@/lib/guest-mode";
import { hasVisibleModal } from "@/lib/smooth";
import {
  wrMount,
  wrEffect,
  wrDeferred,
  isoEnabled,
  wrProfileRoute,
} from "@/lib/runtime-iso";

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
const CrewWeekEightModal = dynamic(
  () => import("@/components/CrewWeekEightModal"),
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
  if (pathname?.startsWith("/profile")) {
    wrProfileRoute("RoomDeferredChrome.render", `wave pending path=${pathname}`);
  }
  const [wave, setWave] = useState(0);
  const [routeHops, setRouteHops] = useState(0);
  const [ceremonyOk, setCeremonyOk] = useState(false);
  const allowWave1 = isoEnabled("wave1");
  const allowWave2 = isoEnabled("wave2");

  useEffect(() => {
    return wrMount("RoomDeferredChrome");
  }, []);

  // Count real navigation so look-around happens before popups
  useEffect(() => {
    wrEffect("RoomDeferredChrome.routeHops");
    if (pathname?.startsWith("/profile")) {
      wrProfileRoute("RoomDeferredChrome.routeHop", pathname || "");
    }
    setRouteHops((n) => n + 1);
  }, [pathname]);

  useEffect(() => {
    if (!allowWave1) {
      wrDeferred("wave1 disabled by iso");
      return;
    }
    wrEffect("RoomDeferredChrome.armWave1Timer");
    const armWave1 = () => {
      wrDeferred("wave → 1 (12s idle)");
      setWave((w) => Math.max(w, 1));
    };
    const t1 = window.setTimeout(armWave1, 12_000);
    return () => window.clearTimeout(t1);
  }, [allowWave1]);

  useEffect(() => {
    if (!allowWave1) return;
    if (routeHops >= 2) {
      wrDeferred(`wave → 1 (routeHops=${routeHops})`);
      setWave((w) => Math.max(w, 1));
    }
  }, [routeHops, allowWave1]);

  useEffect(() => {
    if (!allowWave2) {
      wrDeferred("wave2 disabled by iso");
      return;
    }
    if (wave < 1) return;
    wrEffect("RoomDeferredChrome.armWave2Timer");
    let retry: number | undefined;
    const t2 = window.setTimeout(() => {
      if (hasVisibleModal()) {
        wrDeferred("wave2 delayed — modal visible");
        retry = window.setTimeout(() => {
          wrDeferred("wave → 2 (retry)");
          setWave(2);
        }, 8_000);
        return;
      }
      wrDeferred("wave → 2");
      setWave(2);
    }, 14_000);
    return () => {
      window.clearTimeout(t2);
      if (retry != null) window.clearTimeout(retry);
    };
  }, [wave, allowWave2]);

  // Stagger wave-2 children so cold-open video isn't competing with ring modal JS
  useEffect(() => {
    if (wave < 2) {
      setCeremonyOk(false);
      return;
    }
    wrDeferred("ceremonyOk arm +600ms");
    const t = window.setTimeout(() => setCeremonyOk(true), 600);
    return () => window.clearTimeout(t);
  }, [wave]);

  useEffect(() => {
    wrDeferred(`state wave=${wave} hops=${routeHops} ceremonyOk=${ceremonyOk}`);
  }, [wave, routeHops, ceremonyOk]);

  return (
    <>
      {/* Wave 0: nameplates only — never blocks taps */}
      {!guest && <RoomDataHydrator />}

      {allowWave1 && wave >= 1 && (
        <>
          {!guest && <LoginWelcomeModal />}
          {!guest && <RulesOnboardingModal />}
          {!guest && <CrewWeekEightModal />}
          {!guest && <LeagueBuildLockReminder />}
          {!guest && <CardPublishedModal />}
          {!guest && <BoredPracticeDoneModal />}
          <GazetteModal />
          <GazetteShelfReveal />
          <StoryDoorModal />
          <BadgeUnlockModal />
        </>
      )}

      {allowWave2 && wave >= 2 && ceremonyOk && (
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
