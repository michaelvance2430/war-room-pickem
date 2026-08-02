"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Nav from "@/components/Nav";
import AvatarLightbox from "@/components/AvatarLightbox";
import BadgeShelf from "@/components/BadgeShelf";
import WwcPassportShelf from "@/components/WwcPassportShelf";
import DiscoveryPassportShelf from "@/components/DiscoveryPassportShelf";
import EasterEggTracker from "@/components/EasterEggTracker";
import ProfileTrophyCase from "@/components/ProfileTrophyCase";
import FootballResume from "@/components/FootballResume";
import ProfileSeasonPlot from "@/components/ProfileSeasonPlot";
import CommishCareerCard from "@/components/CommishCareerCard";
import Avatar from "@/components/Avatar";
import {
  buildSeasonPlot,
  buildSignatureStyle,
} from "@/lib/profile-signature";
import { divisionFullLabel } from "@/lib/divisions";
import {
  formatMemberSince,
  getPlayerBadges,
  syncLeagueCheevoKing,
  withPermanentBadges,
} from "@/lib/badges";
import { getPlayerWwcBadges } from "@/lib/sports/wwc-badge-eval";
import { buildFootballResume } from "@/lib/player-history";
import { syncCareerWithPlayer } from "@/lib/career-cheevo";
import { applyLegacyBadgeGrants } from "@/lib/legacy-badge-grants";
import { nukeAccumulatedSandboxCareersOnce } from "@/lib/sandbox-wipe";
import { isSandboxMode } from "@/lib/season-mode";
import { withCreatorFlag } from "@/lib/creator";
import {
  computeJoinTitles,
  isJustJoined,
  joinTitleTierLabel,
  justJoinedBadgeLabel,
} from "@/lib/join-titles";
import { getEquippedTitleLabel } from "@/lib/equipped-title-store";
import { formatLastSeen, lastSeenToneClass } from "@/lib/last-seen";
import {
  getProfileHardware,
  type ProfileTrophy,
} from "@/lib/profile-hardware";
import {
  isMockPlayer,
  mockRoastFor,
  mockRoastLabel,
} from "@/lib/mock-roasts";
import { findPlayer } from "@/lib/store";
import { getLeague, getSession } from "@/lib/league";
import { Player } from "@/lib/types";
import type { LeagueTrophy } from "@/lib/trophies";


function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

/**
 * Profile: load player (cloud first on live), always show full badge shelves.
 */
export default function ProfilePage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [player, setPlayer] = useState<Player | null>(null);
  const [ready, setReady] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Join-order flex title (e.g. Day-One Demon, Bottom Feeder) */
  const [joinTitle, setJoinTitle] = useState<string | null>(null);
  const [leagueTrophies, setLeagueTrophies] = useState<LeagueTrophy[]>([]);
  const [leaguePeers, setLeaguePeers] = useState<Player[]>([]);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const [blueFalconCount, setBlueFalconCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadError(null);
      setJoinTitle(null);
      setLeagueTrophies([]);
      setLastSeenAt(null);
      setBlueFalconCount(0);
      // Fail-safe: never leave full-page Loading forever
      const failSafe = window.setTimeout(() => {
        if (!cancelled) setReady(true);
      }, 5_000);

      try {
        let found: Player | null = null;
        let leagueForSync: Player[] = [];
        let title: string | null = null;
        let seen: string | null = null;

        // Parallel hot path — was sequential (players → roster → N trophy queries)
        try {
          const { loadLeaguePlayers, loadLeagueRoster } = await import(
            "@/lib/cloud"
          );
          const [players, roster] = await Promise.all([
            loadLeaguePlayers().catch(() => [] as Player[]),
            loadLeagueRoster().catch(() => []),
          ]);
          if (cancelled) return;
          leagueForSync = players;
          found = leagueForSync.find((p) => p.id === id) ?? null;

          if (roster.length) {
            const titles = computeJoinTitles(roster);
            title = titles.get(id) || null;
            const row = roster.find((m) => m.userId === id);
            if (row?.lastSeenAt) seen = row.lastSeenAt;
            if (found && row) {
              found = {
                ...found,
                avatarUrl: row.avatarUrl ?? found.avatarUrl,
                name: row.name || found.name,
                memberSince: row.joinedAt || found.memberSince,
              };
            } else if (!found && row) {
              // Roster hit without standings row — still paint a shell
              found = {
                id: row.userId,
                name: row.name || "Player",
                division: (row.division as Player["division"]) || "North",
                totalPoints: 0,
                weeklyPoints: [],
                atsCorrect: 0,
                atsTotal: 0,
                currentStreak: 0,
                bestWeek: 0,
                worstWeek: 0,
                perfectWeeks: 0,
                bestBetHits: 0,
                bestBetTotal: 0,
                propHits: 0,
                propTotal: 0,
                weeksPlayed: 0,
                avatarUrl: row.avatarUrl || undefined,
                memberSince: row.joinedAt || undefined,
              };
            }
          }
        } catch {
          /* no session / offline */
        }

        if (!found) {
          found = findPlayer(id);
        }

        if (found) {
          try {
            applyLegacyBadgeGrants(found);
          } catch {
            /* ignore */
          }
          found = withPermanentBadges(withCreatorFlag(found));
          try {
            const me = getSession()?.playerId;
            if (me && me !== found.id) {
              void import("@/lib/engagement").then(({ markEngagement }) => {
                markEngagement(me, "opened_other_profile");
              });
            }
          } catch {
            /* ignore */
          }
        }

        // Paint hero ASAP — trophies / eggs / blue falcon fill in after
        if (!cancelled) {
          setPlayer(found);
          setLeaguePeers(
            leagueForSync.length ? leagueForSync : found ? [found] : []
          );
          setJoinTitle(title);
          setLastSeenAt(seen);
          setReady(true);
          window.clearTimeout(failSafe);
        }

        if (!found || cancelled) return;

        // Background enrich (never blocks first paint)
        void (async () => {
          try {
            const { loadCareerTrophiesWonByUser, loadLeagueTrophies } =
              await import("@/lib/trophies");
            let trophies: LeagueTrophy[] = [];
            try {
              const career = await loadCareerTrophiesWonByUser(id, {
                playerName: found!.name || undefined,
              });
              trophies = career.length
                ? career
                : await loadLeagueTrophies().catch(() => []);
            } catch {
              trophies = await loadLeagueTrophies().catch(() => []);
            }
            if (!cancelled) setLeagueTrophies(trophies);
          } catch {
            /* optional */
          }

          try {
            const { loadCloudEggFinds } = await import("@/lib/egg-cloud");
            const { grantPermanentBadgeId, mergePermanentBadges } =
              await import("@/lib/permanent-badges");
            const eggIds = await loadCloudEggFinds(found!.id);
            for (const eid of eggIds) {
              grantPermanentBadgeId(found!.id, eid);
            }
            if (!cancelled) {
              setPlayer((prev) =>
                prev
                  ? {
                      ...prev,
                      permanentBadgeIds: mergePermanentBadges(
                        prev.id,
                        prev.permanentBadgeIds
                      ),
                    }
                  : prev
              );
            }
          } catch {
            /* eggs optional */
          }

          try {
            const { hydrateBlueFalconFromCloud, getBlueFalconCount } =
              await import("@/lib/blue-falcon");
            let bf = await hydrateBlueFalconFromCloud(id);
            if (!bf) bf = getBlueFalconCount(id);
            if (!cancelled) setBlueFalconCount(bf);
          } catch {
            /* optional */
          }

          // Defer cheevo-king / Visconti scrub — not needed for first paint
          if (leagueForSync.length) {
            try {
              syncLeagueCheevoKing(
                leagueForSync.map((p) => withPermanentBadges(p))
              );
              const { sanitizeLegacyLegendsOnBoot } = await import(
                "@/lib/legacy-badge-grants"
              );
              sanitizeLegacyLegendsOnBoot({
                roster: leagueForSync.map((p) => ({
                  id: p.id,
                  name: p.name,
                })),
              });
            } catch {
              /* ignore */
            }
          }
        })();
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Failed to load");
          setPlayer(null);
          setReady(true);
        }
      } finally {
        window.clearTimeout(failSafe);
        if (!cancelled) setReady(true);
      }
    }

    setReady(false);
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const badges = useMemo(() => {
    if (!player) return [];
    try {
      // Scrub sim career before badge/career paint (accurate shelf numbers)
      nukeAccumulatedSandboxCareersOnce([player.id]);
      applyLegacyBadgeGrants({ id: player.id, name: player.name });
      return getPlayerBadges(
        player,
        leaguePeers.length ? leaguePeers : undefined
      );
    } catch {
      return [];
    }
  }, [player, leaguePeers]);

  const isWwcLeague = getLeague()?.sportId === "soccer_wwc";

  const wwcBadges = useMemo(() => {
    if (!player || !isWwcLeague) return [];
    try {
      return getPlayerWwcBadges(withPermanentBadges(player));
    } catch {
      return [];
    }
  }, [player, isWwcLeague]);

  // Bank career cheevos (side effect) — numbers live under resume fold, not hero
  useMemo(() => {
    if (!player) return null;
    try {
      return syncCareerWithPlayer(player, badges);
    } catch {
      return null;
    }
  }, [player, badges]);

  const hardware: ProfileTrophy[] = useMemo(() => {
    if (!player) return [];
    try {
      const lg = getLeague();
      return getProfileHardware({
        playerId: player.id,
        playerName: player.name,
        leagueTrophies,
        sportId: lg?.sportId,
        activeLeagueName: lg?.name,
        activeLeagueId: lg?.id,
      });
    } catch {
      return [];
    }
  }, [player, leagueTrophies]);

  const leagueName = getLeague()?.name || "War Room";
  const sessionPlayerId = getSession()?.playerId;
  const isSelfProfile = !!(player && sessionPlayerId && sessionPlayerId === player.id);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted">
        Loading…
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen flex flex-col">
        <Nav />
        <main className="flex-1 max-w-lg mx-auto px-4 py-16 text-center">
          <h1 className="text-xl font-bold mb-2">Player not found</h1>
          <p className="text-sm text-muted mb-2">
            Open a profile from Standings (click a name).
          </p>
          {id && (
            <p className="text-xs text-muted mb-2 font-mono break-all">id: {id}</p>
          )}
          {loadError && (
            <p className="text-xs text-danger mb-4">{loadError}</p>
          )}
          <Link href="/standings" className="text-primary text-sm hover:underline">
            ← Standings
          </Link>
        </main>
      </div>
    );
  }

  const mock = isMockPlayer(player);
  const roast = mockRoastFor(player);
  const roastNum = mockRoastLabel(player);
  const ini = initials(player.name);
  const earnedCount = badges.filter((b) => b.earned).length;
  const sportId = getLeague()?.sportId || "cfb";
  const peers = leaguePeers.length ? leaguePeers : [player];

  let resume = null as ReturnType<typeof buildFootballResume> | null;
  try {
    resume = buildFootballResume({
      player,
      peers,
      trophies: leagueTrophies,
      badges,
      memberSinceLabel: mock
        ? "Never"
        : formatMemberSince(player.memberSince),
    });
  } catch {
    resume = null;
  }

  const signature = mock
    ? roast || "Demo NPC. Not a real résumé."
    : buildSignatureStyle({
        player,
        badges,
        sportId,
        peers,
      });
  const seasonPlot = buildSeasonPlot(player, peers);

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <Link
          href="/standings"
          className="text-xs text-muted hover:text-foreground mb-4 inline-block"
        >
          ← Standings
        </Link>

        {mock && roast && (
          <div className="mb-4 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3">
            <div className="flex justify-between gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-warning">
                Demo NPC · Not a real person
              </span>
              {roastNum && (
                <span className="text-[10px] font-mono text-muted">
                  roast {roastNum}
                </span>
              )}
            </div>
            <p className="text-sm">{roast}</p>
          </div>
        )}

        {!mock && (
          <div className="mb-6">
            <CommishCareerCard userId={player.id} />
          </div>
        )}

        <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            <button
              type="button"
              onClick={() => setLightbox(true)}
              className="shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title="Expand photo"
            >
              <Avatar
                name={player.name}
                avatarUrl={player.avatarUrl}
                size="xl"
                userId={player.id}
                borderId={
                  mock
                    ? "plain"
                    : undefined
                }
              />
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                {getEquippedTitleLabel(player.id) && (
                  <span
                    className="text-xs sm:text-sm font-black uppercase tracking-wide text-amber-300 shrink-0"
                    title="Equipped on Account"
                  >
                    {getEquippedTitleLabel(player.id)}
                  </span>
                )}
                <h1 className="text-2xl font-bold truncate">{player.name}</h1>
                {!mock &&
                  isJustJoined(player.memberSince) && (
                    <span
                      className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full border border-sky-400/50 bg-sky-400/15 text-sky-200"
                      title="Joined this league in the last 24 hours"
                    >
                      {justJoinedBadgeLabel(joinTitle)}
                    </span>
                  )}
                {player.isCreator && (
                  <span
                    className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border border-yellow-500 text-yellow-500"
                    title="Built the app — not the same as league commissioner"
                  >
                    The Creator
                  </span>
                )}
                {mock && (
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border border-warning/60 text-warning">
                    NPC
                  </span>
                )}
              </div>
              <p className="text-sm text-muted mb-2">
                {divisionFullLabel(player.division, sportId)} ·{" "}
                {mock ? (
                  "Lab-grown for your league"
                ) : joinTitle ? (
                  <>
                    <span
                      className={
                        joinTitle === "Bottom Feeder"
                          ? "text-muted"
                          : joinTitle === "Opened the Room"
                            ? "text-amber-300 font-medium"
                            : "text-foreground font-medium"
                      }
                      title={
                        joinTitleTierLabel(joinTitle)
                          ? `Join wave: ${joinTitleTierLabel(joinTitle)}`
                          : undefined
                      }
                    >
                      {joinTitle}
                    </span>
                    {isJustJoined(player.memberSince) ? (
                      <span className="text-sky-300/90"> · new in the room</span>
                    ) : null}
                  </>
                ) : (
                  "New recruit"
                )}
              </p>

              {/* Signature style — who they are when they play */}
              <p className="text-sm text-foreground/90 leading-relaxed mb-3 border-l-2 border-primary/50 pl-3 italic">
                {signature}
              </p>

              <div className="grid grid-cols-2 gap-2">
                <Chip
                  label="Member since"
                  value={mock ? "Never" : formatMemberSince(player.memberSince)}
                />
                <Chip
                  label="Last in"
                  value={mock ? "NPC" : formatLastSeen(lastSeenAt)}
                  valueClassName={
                    mock ? undefined : lastSeenToneClass(lastSeenAt)
                  }
                />
                {!mock && (
                  <Chip
                    label="Blue Falcon Count"
                    value={String(blueFalconCount)}
                    accent={blueFalconCount > 0}
                  />
                )}
                {!mock && blueFalconCount > 0 && (
                  <div className="col-span-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300 mb-0.5">
                      Quit mid-season
                    </p>
                    <p className="text-[11px] text-muted leading-relaxed">
                      Left {blueFalconCount} league
                      {blueFalconCount === 1 ? "" : "s"} before finishing —
                      not bracket knockout, walking out of the room. Commish
                      may kick high Blue Falcons before kickoff.
                    </p>
                  </div>
                )}
              </div>
              {isSelfProfile && !mock && (
                <p className="text-[10px] text-muted mt-2 leading-relaxed">
                  Standings own season points. Hardware and the plot live here.
                  Blue Falcon Count tracks leagues you quit before the season
                  ended.
                  {isSandboxMode()
                    ? " Sandbox: sim cheevos don't stick to career."
                    : ""}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* 1. Hardware — what they own */}
        <ProfileTrophyCase
          items={hardware}
          playerName={player.name}
          leagueName={leagueName}
          isSelf={isSelfProfile}
          winnerAvatarUrl={player.avatarUrl}
        />

        {/* Passport stamps & zero-point discoveries */}
        <DiscoveryPassportShelf
          playerId={player.id}
          isSelf={isSelfProfile}
        />

        {/* Easter egg finds — count only, never total catalog size */}
        <EasterEggTracker
          playerId={player.id}
          isSelf={!!isSelfProfile}
        />

        {/* 2. Season plot — rival, streak, last card */}
        {!mock && (
          <ProfileSeasonPlot
            plot={seasonPlot}
            rival={resume?.rival ?? null}
            sportId={sportId}
          />
        )}

        {/* 3. Resume — titles + years; spreadsheet folded */}
        {resume && (
          <FootballResume
            resume={resume}
            playerId={player.id}
            isSelf={isSelfProfile}
          />
        )}

        {/* 4. Achievements — shelves, not X/Y hero numbers */}
        {isWwcLeague && wwcBadges.length > 0 && (
          <WwcPassportShelf badges={wwcBadges} />
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
              <div>
                <h2 className="font-semibold text-lg mb-2">Badge shelves</h2>
                <p className="text-sm text-muted">
                  Could not load badges. Try a hard refresh.
                </p>
              </div>
            )}
          </div>
        )}

        {isWwcLeague && (
          <details className="rounded-2xl border border-border bg-card p-5 sm:p-6 mb-6">
            <summary className="font-semibold text-sm cursor-pointer text-muted hover:text-foreground">
              Also show classic War Room badge shelves
            </summary>
            <div className="mt-4">
              {badges.length > 0 ? (
                <BadgeShelf badges={badges} />
              ) : (
                <p className="text-sm text-muted">No football badges loaded.</p>
              )}
            </div>
          </details>
        )}
      </main>

      <AvatarLightbox
        open={lightbox}
        onClose={() => setLightbox(false)}
        name={player.name}
        avatarUrl={player.avatarUrl}
        initials={ini}
      />
    </div>
  );
}

function Chip({
  label,
  value,
  accent,
  valueClassName,
}: {
  label: string;
  value: string;
  accent?: boolean;
  /** Overrides accent color (e.g. last-seen green / yellow / red) */
  valueClassName?: string;
}) {
  return (
    <div className="rounded-lg bg-background border border-border px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted">
        {label}
      </div>
      <div
        className={`text-sm font-semibold truncate ${
          valueClassName || (accent ? "text-primary" : "")
        }`}
      >
        {value}
      </div>
    </div>
  );
}




