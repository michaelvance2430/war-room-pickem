"use client";

/**
 * Deferred profile shelves — dynamically imported AFTER identity paint.
 * Contains all badge catalog evaluation and heavy trophy/resume work.
 * Must never be statically imported from profile/page.tsx.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import BadgeShelf from "@/components/BadgeShelf";
import WwcPassportShelf from "@/components/WwcPassportShelf";
import DiscoveryPassportShelf from "@/components/DiscoveryPassportShelf";
import EasterEggTracker from "@/components/EasterEggTracker";
import ProfileTrophyCase from "@/components/ProfileTrophyCase";
import FootballResume from "@/components/FootballResume";
import ProfileSeasonPlot from "@/components/ProfileSeasonPlot";
import CommishCareerCard from "@/components/CommishCareerCard";
import {
  buildSeasonPlot,
  buildSignatureStyle,
} from "@/lib/profile-signature";
import {
  formatMemberSince,
  getPlayerBadges,
  withPermanentBadges,
} from "@/lib/badges";
import { getPlayerWwcBadges } from "@/lib/sports/wwc-badge-eval";
import { buildFootballResume } from "@/lib/player-history";
import { syncCareerWithPlayer } from "@/lib/career-cheevo";
import { applyLegacyBadgeGrants } from "@/lib/legacy-badge-grants";
import { nukeAccumulatedSandboxCareersOnce } from "@/lib/sandbox-wipe";
import { withCreatorFlag } from "@/lib/creator";
import { filterCrewCheevos } from "@/lib/crew-cheevos";
import {
  getProfileHardware,
  type ProfileTrophy,
} from "@/lib/profile-hardware";
import { isMockPlayer } from "@/lib/mock-roasts";
import { getLeague } from "@/lib/league";
import { Player } from "@/lib/types";
import type { LeagueTrophy } from "@/lib/trophies";
import type { BadgeStatus } from "@/lib/types";
import { wrProfile } from "@/lib/runtime-iso";
import { hasOfficialScoredWeek } from "@/lib/season-scored";
import {
  profileNavMark,
  profileNavSyncEnd,
  profileNavSyncStart,
} from "@/lib/profile-nav-trace";

type Props = {
  player: Player;
  joinTitle: string | null;
  isSelf: boolean;
};

const SLOW_MS = 500;

function yieldToBrowser(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

/**
 * Run sync work off the critical path: yield first, time it, log if >500ms, yield after.
 * Does not block navigation — only called after identity paint + user opens details.
 */
async function runChunked<T>(
  label: string,
  fn: () => T
): Promise<T | null> {
  await yieldToBrowser();
  const t0 = profileNavSyncStart(`ProfileHeavyDetails.${label}`);
  const wall0 = performance.now();
  try {
    const out = fn();
    const ms = performance.now() - wall0;
    profileNavSyncEnd(`ProfileHeavyDetails.${label}`, t0);
    if (ms > SLOW_MS) wrProfile("SLOW_SECTION", ms, label);
    else wrProfile(label, ms);
    await yieldToBrowser();
    return out;
  } catch (e) {
    profileNavSyncEnd(
      `ProfileHeavyDetails.${label}`,
      t0,
      e instanceof Error ? e.message : "fail"
    );
    wrProfile(
      "SLOW_SECTION",
      performance.now() - wall0,
      `${label} FAIL ${e instanceof Error ? e.message : ""}`
    );
    return null;
  }
}

export default function ProfileHeavyDetails({
  player: seed,
  isSelf,
}: Props) {
  const [player, setPlayer] = useState(seed);
  const [badges, setBadges] = useState<BadgeStatus[]>([]);
  const [wwcBadges, setWwcBadges] = useState<BadgeStatus[]>([]);
  const [hardware, setHardware] = useState<ProfileTrophy[]>([]);
  const [resume, setResume] = useState<ReturnType<
    typeof buildFootballResume
  > | null>(null);
  const [seasonPlot, setSeasonPlot] = useState<ReturnType<
    typeof buildSeasonPlot
  > | null>(null);
  /** Official scored week in this league — never invent plot stats without it */
  const [storyStarted, setStoryStarted] = useState(false);
  const [signature, setSignature] = useState<string>("");
  const [phase, setPhase] = useState<"loading" | "ready">("loading");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      /**
       * Production freeze (Mike 2026-08): 4s + 83s longtasks after render-enter
       * while details ran. Standings re-query on this path was concurrent with
       * trophies. CRITICAL PATH = subject-only badges + trophies; peers idle.
       */
      wrProfile("heavy-details-start");
      profileNavMark("heavy-details-start");
      await yieldToBrowser();
      if (cancelled) return;

      const lg = getLeague();
      const sportId = lg?.sportId || "cfb";
      const isWwc = sportId === "soccer_wwc";
      const mock = isMockPlayer(seed);
      let subject: Player = withPermanentBadges(withCreatorFlag(seed));
      let leaguePeers: Player[] = [subject];

      // ── Phase A: badges with [subject] only — NO loadLeaguePlayers/standings ──
      const badgeList = await runChunked("evaluateBadges", () => {
        try {
          nukeAccumulatedSandboxCareersOnce([seed.id]);
          applyLegacyBadgeGrants({ id: seed.id, name: seed.name });
          return getPlayerBadges(subject, [subject]);
        } catch {
          return [] as BadgeStatus[];
        }
      });
      if (cancelled) return;
      if (badgeList) {
        setBadges(badgeList);
        try {
          syncCareerWithPlayer(subject, badgeList);
        } catch {
          /* ok */
        }
      }

      if (isWwc) {
        const wwc = await runChunked("evaluateWwcBadges", () => {
          try {
            return getPlayerWwcBadges(withPermanentBadges(seed));
          } catch {
            return [] as BadgeStatus[];
          }
        });
        if (!cancelled && wwc) setWwcBadges(wwc);
      }

      // ── Phase B: trophies (yield around module eval — large chunk) ──
      let trophies: LeagueTrophy[] = [];
      try {
        await yieldToBrowser();
        if (cancelled) return;
        const tImport0 = profileNavSyncStart("trophies-module-import");
        const wallImp = performance.now();
        const { loadCareerTrophiesWonByUser, loadLeagueTrophies } =
          await import("@/lib/trophies");
        profileNavSyncEnd("trophies-module-import", tImport0);
        wrProfile("trophies-module-import", performance.now() - wallImp);
        await yieldToBrowser();
        if (cancelled) return;
        profileNavMark("trophy-fetch-start");
        try {
          const career = await loadCareerTrophiesWonByUser(seed.id, {
            playerName: seed.name || undefined,
          });
          trophies = career.length
            ? career
            : await loadLeagueTrophies().catch(() => [] as LeagueTrophy[]);
        } catch {
          trophies = await loadLeagueTrophies().catch(
            () => [] as LeagueTrophy[]
          );
        }
        profileNavMark("trophy-fetch-end", `n=${trophies.length}`);
        await yieldToBrowser();
        if (cancelled) return;

        const hw = await runChunked("buildTrophies", () =>
          getProfileHardware({
            playerId: seed.id,
            playerName: seed.name,
            leagueTrophies: trophies,
            sportId: lg?.sportId,
            activeLeagueName: lg?.name,
            activeLeagueId: lg?.id,
          })
        );
        if (!cancelled && hw) {
          const tSet = profileNavSyncStart("setHardware");
          setHardware(hw);
          profileNavSyncEnd("setHardware", tSet, `n=${hw.length}`);
        }
      } catch {
        /* ok */
      }

      if (cancelled) return;

      const badgeSnap = badgeList || [];
      const peerList = leaguePeers;

      const res = await runChunked("buildResume", () =>
        buildFootballResume({
          player: subject,
          peers: peerList,
          trophies,
          badges: badgeSnap,
          memberSinceLabel: mock
            ? "Never"
            : formatMemberSince(subject.memberSince),
        })
      );
      if (!cancelled && res) setResume(res);

      const scored = await runChunked("hasOfficialScoredWeek", () =>
        hasOfficialScoredWeek()
      );
      if (!cancelled) setStoryStarted(!!scored);

      const sig = await runChunked("buildSignature", () => {
        if (mock) return "Demo NPC. Not a real résumé.";
        if (!scored) {
          return sportId === "nfl"
            ? "Still writing their Sunday story."
            : "Still writing their Saturday story.";
        }
        return buildSignatureStyle({
          player: subject,
          badges: badgeSnap,
          sportId,
          peers: peerList,
        });
      });
      if (!cancelled && sig) setSignature(sig);

      if (!mock && scored) {
        const plot = await runChunked("buildSeasonPlot", () =>
          buildSeasonPlot(subject, peerList)
        );
        if (!cancelled && plot) setSeasonPlot(plot);
      } else if (!cancelled) {
        setSeasonPlot(null);
      }

      // Paint shelves before peer upgrade / eggs
      if (!cancelled) {
        const tPhase = profileNavSyncStart("setPhase-ready");
        setPhase("ready");
        profileNavSyncEnd("setPhase-ready", tPhase);
        wrProfile("heavy-details-ready");
        profileNavMark("heavy-details-ready");
      }

      // ── Phase C (idle): full league peers — may re-hit standings; never block paint ──
      await yieldToBrowser();
      if (cancelled) return;
      try {
        const { loadLeaguePlayers } = await import("@/lib/cloud");
        const players = await loadLeaguePlayers(
          "ProfileHeavyDetails.peers"
        ).catch(() => [] as Player[]);
        if (cancelled || !players.length) return;
        leaguePeers = players;
        const richer = players.find((p) => p.id === seed.id);
        if (richer) {
          subject = withPermanentBadges(
            withCreatorFlag({
              ...richer,
              avatarUrl: seed.avatarUrl || richer.avatarUrl,
              memberSince: seed.memberSince || richer.memberSince,
              name: seed.name || richer.name,
            })
          );
          if (!cancelled) setPlayer(subject);
        }
        const upgraded = await runChunked("evaluateBadges-peers", () => {
          try {
            return getPlayerBadges(subject, leaguePeers);
          } catch {
            return null;
          }
        });
        if (!cancelled && upgraded) {
          setBadges(upgraded);
          try {
            syncCareerWithPlayer(subject, upgraded);
          } catch {
            /* ok */
          }
        }
        if (!cancelled && scored) {
          const plot = await runChunked("buildSeasonPlot-peers", () =>
            buildSeasonPlot(subject, leaguePeers)
          );
          if (!cancelled && plot) setSeasonPlot(plot);
        }
      } catch {
        /* ok */
      }

      // Eggs — after shelves
      try {
        await yieldToBrowser();
        if (cancelled) return;
        const { loadCloudEggFinds } = await import("@/lib/egg-cloud");
        const { grantPermanentBadgeId, mergePermanentBadges } =
          await import("@/lib/permanent-badges");
        const eggIds = await loadCloudEggFinds(seed.id);
        for (const eid of eggIds) {
          grantPermanentBadgeId(seed.id, eid);
        }
        if (!cancelled) {
          setPlayer((prev) => ({
            ...prev,
            permanentBadgeIds: mergePermanentBadges(
              prev.id,
              prev.permanentBadgeIds
            ),
          }));
        }
      } catch {
        /* ok */
      }
    })();

    return () => {
      cancelled = true;
    };
    // seed.id only — full seed object changes would restart thrash
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed.id]);

  const lg = getLeague();
  const sportId = lg?.sportId || "cfb";
  const isWwcLeague = sportId === "soccer_wwc";
  const mock = isMockPlayer(player);
  const earnedCount = badges.filter((b) => b.earned).length;
  const leagueName = lg?.name || "War Room";

  if (phase === "loading") {
    return (
      <div className="rounded-2xl border border-border bg-card/50 px-4 py-8 text-center mb-6">
        <p className="text-sm text-muted">Loading badges &amp; hardware…</p>
      </div>
    );
  }

  return (
    <>
      {!mock && (
        <div className="mb-6">
          <CommishCareerCard userId={player.id} />
        </div>
      )}

      {signature ? (
        <p className="text-sm text-foreground/90 leading-relaxed mb-4 border-l-2 border-primary/50 pl-3 italic">
          {signature}
        </p>
      ) : null}

      <ProfileTrophyCase
        items={hardware}
        playerName={player.name}
        leagueName={leagueName}
        isSelf={isSelf}
        winnerAvatarUrl={player.avatarUrl}
      />

      <DiscoveryPassportShelf playerId={player.id} isSelf={isSelf} />

      <EasterEggTracker playerId={player.id} isSelf={isSelf} />

      {!mock && (
        <ProfileSeasonPlot
          plot={seasonPlot}
          rival={storyStarted ? resume?.rival ?? null : null}
          sportId={sportId}
          storyStarted={storyStarted}
          isSelf={isSelf}
        />
      )}

      {resume && (
        <FootballResume
          resume={resume}
          playerId={player.id}
          isSelf={isSelf}
          storyStarted={storyStarted}
        />
      )}

      {isWwcLeague && wwcBadges.length > 0 && (
        <WwcPassportShelf badges={wwcBadges} />
      )}

      {!isWwcLeague && badges.length > 0 && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-5 sm:p-6 mb-6">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-[10px] uppercase tracking-wider text-amber-300 font-bold">
              Crew marks
            </p>
            <Link href="/crew" className="text-[11px] font-bold text-primary">
              Live foxhole →
            </Link>
          </div>
          <BadgeShelf badges={filterCrewCheevos(badges)} />
        </div>
      )}

      {!isWwcLeague && (
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 mb-6">
          {badges.length > 0 ? (
            <>
              <p className="text-[10px] uppercase tracking-wider text-muted font-bold mb-1">
                Achievements
              </p>
              <p className="text-xs text-muted mb-4">
                {earnedCount > 0
                  ? `${earnedCount} earned in this catalog — open a badge for the story.`
                  : "Nothing earned yet. The first card is still destiny."}
              </p>
              <BadgeShelf badges={badges} />
            </>
          ) : (
            <p className="text-sm text-muted">No badges loaded.</p>
          )}
        </div>
      )}
    </>
  );
}
