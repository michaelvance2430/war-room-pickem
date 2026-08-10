"use client";

/**
 * P0 FREEZE FIX — identity-first profile route.
 *
 * NEVER static-import @/lib/store or @/lib/league here.
 * Both pull store → badges.ts (~70KB catalog) into the route chunk and
 * caused 17s main-thread longtasks on "View Profile" (Standings → profile).
 *
 * Session/league: @/lib/session-read (localStorage only).
 * Offline fallback findPlayer: dynamic import after first paint only.
 * Badges / trophies / résumé: ProfileHeavyDetails dynamic import on demand.
 */

import { useEffect, useRef, useState, type ComponentType } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Avatar from "@/components/Avatar";
import AvatarLightbox from "@/components/AvatarLightbox";
import ProfileRankPlacard from "@/components/ProfileRankPlacard";
import { divisionFullLabel } from "@/lib/divisions";
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
  isMockPlayer,
  mockRoastFor,
  mockRoastLabel,
} from "@/lib/mock-roasts";
import { readLeague, readSession } from "@/lib/session-read";
import { Player } from "@/lib/types";
import { wrProfile, wrProfileTimed, wrProfileRoute } from "@/lib/runtime-iso";
import {
  ensureProfileNavTraceForRoute,
  profileNavIdentityEnd,
  profileNavIdentityStart,
  profileNavMark,
  profileNavMount,
  profileNavRender,
  profileNavUsable,
} from "@/lib/profile-nav-trace";
import type { CanonicalTeam } from "@/lib/teams/cfb-catalog";

// Module evaluation boundary — if this never logs, freeze is BEFORE profile chunk runs
const __profileModuleT0 =
  typeof performance !== "undefined" ? performance.now() : 0;
wrProfileRoute("module-top");
if (typeof performance !== "undefined") {
  try {
    performance.mark("wr-profile:module-eval");
  } catch {
    /* ok */
  }
}

function mark(label: string, extra?: string) {
  wrProfileRoute(label, extra);
  try {
    performance.mark(`wr-profile:${label}`);
    if (
      typeof process !== "undefined" &&
      process.env.NODE_ENV === "development"
    ) {
      const ms =
        typeof performance !== "undefined"
          ? Math.round(performance.now() - __profileModuleT0)
          : 0;
      console.log(
        `[WR-PERF][profile] ${label} +${ms}ms${extra ? ` ${extra}` : ""}`
      );
    } else if (
      typeof localStorage !== "undefined" &&
      localStorage.getItem("warroom-runtime-debug") === "1"
    ) {
      const ms =
        typeof performance !== "undefined"
          ? Math.round(performance.now() - __profileModuleT0)
          : 0;
      console.log(
        `[WR-PERF][profile] ${label} +${ms}ms${extra ? ` ${extra}` : ""}`
      );
    }
  } catch {
    /* ok */
  }
}

/** Local copy — do NOT import from @/lib/badges (pulls full catalog onto route). */
function formatMemberSince(iso?: string): string {
  if (!iso) return "Recently joined";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  } catch {
    return "Recently joined";
  }
}

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

function Chip({
  label,
  value,
  accent,
  valueClassName,
}: {
  label: string;
  value: string;
  accent?: boolean;
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

const HeavyDetailsPlaceholder = ({
  onLoad,
  loading,
}: {
  onLoad: () => void;
  loading: boolean;
}) => (
  <div className="rounded-2xl border border-border bg-card/80 p-5 mb-6">
    <p className="text-sm font-semibold mb-1">Profile details</p>
    <p className="text-xs text-muted mb-3 leading-relaxed">
      Badges, trophies, résumé, and season plot load on demand so the app stays
      responsive.
    </p>
    <button
      type="button"
      onClick={onLoad}
      disabled={loading}
      className="px-4 py-2.5 rounded-xl bg-primary text-black text-sm font-bold disabled:opacity-60 min-h-[44px]"
    >
      {loading ? "Loading details…" : "Load profile details"}
    </button>
  </div>
);

/**
 * Lightweight production profile — identity first, heavy work deferred.
 */
export default function ProfilePage() {
  mark("render-enter");
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  profileNavRender();

  const [player, setPlayer] = useState<Player | null>(null);
  const [ready, setReady] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  /** Sport-keyed allegiance — never collapse CFB/NFL into one field */
  const [allegianceLoading, setAllegianceLoading] = useState(true);
  /** When league context is nfl|cfb, only that sport is shown; else both */
  const [allegianceContext, setAllegianceContext] = useState<
    "nfl" | "cfb" | "cbb" | "both"
  >("both");
  const [cfbFavorite, setCfbFavorite] = useState<CanonicalTeam | null>(null);
  const [nflFavorite, setNflFavorite] = useState<CanonicalTeam | null>(null);
  const [cbbFavorite, setCbbFavorite] = useState<CanonicalTeam | null>(null);
  const [cfbAnswered, setCfbAnswered] = useState(false);
  const [nflAnswered, setNflAnswered] = useState(false);
  const [cbbAnswered, setCbbAnswered] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [joinTitle, setJoinTitle] = useState<string | null>(null);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const [blueFalconCount, setBlueFalconCount] = useState(0);
  const [sandboxHint, setSandboxHint] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [DetailsPanel, setDetailsPanel] = useState<ComponentType<{
    player: Player;
    joinTitle: string | null;
    isSelf: boolean;
  }> | null>(null);
  const hadPaintRef = useRef(false);

  useEffect(() => {
    if (id) {
      ensureProfileNavTraceForRoute(id);
      profileNavMount(id);
    }
    mark("effect-enter", `id=${id.slice(0, 8)}`);
    wrProfile("data-effect-start", undefined, `id=${id.slice(0, 8)}`);
    let cancelled = false;

    function rosterToPlayer(row: {
      userId: string;
      name: string;
      division?: string;
      totalPoints?: number;
      avatarUrl?: string | null;
      joinedAt?: string | null;
    }): Player {
      return {
        id: row.userId,
        name: row.name || "Player",
        division: (row.division as Player["division"]) || "North",
        totalPoints: row.totalPoints || 0,
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

    async function load() {
      setLoadError(null);
      setJoinTitle(null);
      setLastSeenAt(null);
      setBlueFalconCount(0);
      setDetailsOpen(false);
      setDetailsPanel(null);
      setCfbFavorite(null);
      setNflFavorite(null);
      setCbbFavorite(null);
      setCfbAnswered(false);
      setNflAnswered(false);
      setCbbAnswered(false);
      setAllegianceLoading(true);

      const me = readSession()?.playerId || null;
      const isSelf = !!(me && me === id);
      mark(
        "identity",
        `route_id=${id.slice(0, 8)} expect=user_id self=${isSelf}`
      );
      profileNavIdentityStart(
        `route_id=${id.slice(0, 8)} self=${isSelf}`
      );

      const failSafe = window.setTimeout(() => {
        if (!cancelled) {
          mark("failsafe-ready");
          profileNavMark("failsafe-ready");
          setReady(true);
          profileNavUsable("failsafe");
        }
      }, 2_500);

      try {
        let found: Player | null = null;
        let title: string | null = null;
        let seen: string | null = null;
        let source = "none";

        // 1) Prefer loadLeaguePlayers — same list Standings uses (player.id = user_id).
        //    Warm cache hit after Standings = paint without waiting on roster RPC.
        try {
          mark("players-import-start");
          profileNavMark("identity-players-import-start");
          const t0 = performance.now();
          const { loadLeaguePlayers, loadLeagueRoster } = await import(
            "@/lib/cloud"
          );
          mark(
            "cloud-import-done",
            `${Math.round(performance.now() - t0)}ms`
          );
          profileNavMark(
            "identity-cloud-import-done",
            `${Math.round(performance.now() - t0)}ms`
          );
          const t1 = performance.now();
          const players = await loadLeaguePlayers("ProfilePage.identity");
          mark(
            "players-fetch-done",
            `${Math.round(performance.now() - t1)}ms n=${players.length}`
          );
          profileNavMark(
            "identity-players-fetch-done",
            `${Math.round(performance.now() - t1)}ms n=${players.length}`
          );
          if (cancelled) return;
          const hit = players.find((p) => p.id === id);
          if (hit) {
            found = { ...hit };
            source = "loadLeaguePlayers.user_id";
            // Paint immediately — roster meta (join title / lastSeen) fills in after
            if (!cancelled) {
              setPlayer(withCreatorFlag(found));
              setReady(true);
              hadPaintRef.current = true;
              window.clearTimeout(failSafe);
              mark(
                "first-usable-paint",
                `fast source=${source} name=${found.name.slice(0, 20)}`
              );
              profileNavIdentityEnd(`fast source=${source}`);
              profileNavUsable(`first-content source=${source}`);
              wrProfile("interactive");
            }
            // Allegiance (non-blocking) — sport-aware, no cross-sport fallback
            void import("@/lib/favorite-teams").then(async (m) => {
              try {
                const lg = readLeague();
                const raw = (lg?.sportId || "").toString().toLowerCase();
                const ctx: "nfl" | "cfb" | "cbb" | "both" =
                  raw === "nfl" ? "nfl" : raw === "cfb" ? "cfb" : raw === "cbb" ? "cbb" : "both";
                if (cancelled) return;
                setAllegianceContext(ctx);
                setAllegianceLoading(true);
                setCfbFavorite(null);
                setNflFavorite(null);
                setCbbFavorite(null);
                if (ctx === "nfl" || ctx === "both") {
                  const tid = await m.getUserFavoriteTeamId(id, "nfl");
                  const t = tid ? await m.getUserFavoriteTeam(id, "nfl") : null;
                  if (!cancelled) {
                    setNflAnswered(!!tid);
                    setNflFavorite(t);
                  }
                }
                if (ctx === "cfb" || ctx === "both") {
                  const tid = await m.getUserFavoriteTeamId(id, "cfb");
                  const t = tid ? await m.getUserFavoriteTeam(id, "cfb") : null;
                  if (!cancelled) {
                    setCfbAnswered(!!tid);
                    setCfbFavorite(t);
                  }
                }
                if (ctx === "cbb" || ctx === "both") {
                  const tid = await m.getUserFavoriteTeamId(id, "cbb");
                  const t = tid ? await m.getUserFavoriteTeam(id, "cbb") : null;
                  if (!cancelled) { setCbbAnswered(!!tid); setCbbFavorite(t); }
                }
              } catch {
                /* ignore */
              } finally {
                if (!cancelled) setAllegianceLoading(false);
              }
            });
          }

          // Roster only for join titles / lastSeen / membership_id recovery
          const t2 = performance.now();
          const roster = await loadLeagueRoster();
          mark(
            "roster-fetch-done",
            `${Math.round(performance.now() - t2)}ms n=${roster.length}`
          );
          profileNavMark(
            "identity-roster-fetch-done",
            `${Math.round(performance.now() - t2)}ms n=${roster.length}`
          );
          if (cancelled) return;
          if (roster.length) {
            const titles = computeJoinTitles(roster);
            title = titles.get(id) || null;
            const row = roster.find((m) => m.userId === id);
            if (row?.lastSeenAt) seen = row.lastSeenAt;
            if (!found && row) {
              found = rosterToPlayer(row);
              source = "loadLeagueRoster.user_id";
            }
            // Detect membership_id mistaken as route id
            if (!found) {
              const byMem = roster.find((m) => m.membershipId === id);
              if (byMem) {
                mark(
                  "ID_MISMATCH",
                  `route used membership_id; user_id=${byMem.userId.slice(0, 8)}`
                );
                profileNavMark(
                  "route-replace",
                  `membership_id→user_id=${byMem.userId.slice(0, 8)}`
                );
                found = rosterToPlayer(byMem);
                source = "membership_id→user_id";
                try {
                  window.history.replaceState(
                    null,
                    "",
                    `/profile/${byMem.userId}`
                  );
                } catch {
                  /* ok */
                }
              }
            }
          }
        } catch {
          /* offline */
        }

        // 2) Offline / demo fallback — only if cloud path missed
        if (!found) {
          try {
            mark("store-fallback-start");
            const tStore = performance.now();
            const { findPlayer } = await import("@/lib/store");
            found = findPlayer(id);
            source = found ? "store.findPlayer" : "none";
            mark(
              "store-fallback-done",
              `${Math.round(performance.now() - tStore)}ms found=${!!found}`
            );
          } catch {
            /* ignore */
          }
        }

        if (found) {
          found = withCreatorFlag(found);
          // Peer-only engagement — never block paint
          if (!isSelf) {
            void import("@/lib/engagement").then(({ markEngagement }) => {
              if (me) markEngagement(me, "opened_other_profile");
            });
          }
        }

        if (!cancelled) {
          setPlayer(found);
          setJoinTitle(title);
          setLastSeenAt(seen);
          if (found) hadPaintRef.current = true;
          setReady(true);
          window.clearTimeout(failSafe);
          mark(
            "first-usable-paint",
            found
              ? `found source=${source} name=${found.name.slice(0, 20)}`
              : "missing"
          );
          profileNavIdentityEnd(
            found ? `source=${source}` : "missing"
          );
          profileNavUsable(
            found ? `first-content source=${source}` : "missing"
          );
          wrProfile(
            "data-effect-first-paint",
            undefined,
            found ? `found:${source}` : "missing"
          );
          wrProfile("interactive");
        }

        if (!found || cancelled) return;

        void import("@/lib/season-mode").then((m) => {
          if (!cancelled) setSandboxHint(m.isSandboxMode());
        });

        void import("@/lib/favorite-teams").then(async (m) => {
          try {
            const uid = found!.id;
            const lg = readLeague();
            const raw = (lg?.sportId || "").toString().toLowerCase();
            const ctx: "nfl" | "cfb" | "cbb" | "both" =
              raw === "nfl" ? "nfl" : raw === "cfb" ? "cfb" : raw === "cbb" ? "cbb" : "both";
            if (cancelled) return;
            setAllegianceContext(ctx);
            setAllegianceLoading(true);
            setCfbFavorite(null);
            setNflFavorite(null);
            setCbbFavorite(null);
            if (ctx === "nfl" || ctx === "both") {
              const tid = await m.getUserFavoriteTeamId(uid, "nfl");
              const t = tid ? await m.getUserFavoriteTeam(uid, "nfl") : null;
              if (!cancelled) {
                setNflAnswered(!!tid);
                setNflFavorite(t);
              }
            }
            if (ctx === "cfb" || ctx === "both") {
              const tid = await m.getUserFavoriteTeamId(uid, "cfb");
              const t = tid ? await m.getUserFavoriteTeam(uid, "cfb") : null;
              if (!cancelled) {
                setCfbAnswered(!!tid);
                setCfbFavorite(t);
              }
            }
            if (ctx === "cbb" || ctx === "both") {
              const tid = await m.getUserFavoriteTeamId(uid, "cbb");
              const t = tid ? await m.getUserFavoriteTeam(uid, "cbb") : null;
              if (!cancelled) { setCbbAnswered(!!tid); setCbbFavorite(t); }
            }
          } catch {
            /* optional until migration */
          } finally {
            if (!cancelled) setAllegianceLoading(false);
          }
        });

        // Blue Falcon after paint — never on critical path
        void (async () => {
          try {
            const { hydrateBlueFalconFromCloud, getBlueFalconCount } =
              await import("@/lib/blue-falcon");
            let bf = await hydrateBlueFalconFromCloud(found!.id);
            if (!bf) bf = getBlueFalconCount(found!.id);
            if (!cancelled) setBlueFalconCount(bf);
          } catch {
            /* optional */
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
        if (!cancelled) {
          setReady(true);
          wrProfile("data-effect-done");
        }
      }
    }

    if (!hadPaintRef.current) setReady(false);
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function loadHeavyDetails() {
    if (!player || detailsLoading) return;
    setDetailsLoading(true);
    mark("details-import-start");
    wrProfile("details-import-start");
    const t0 = performance.now();
    try {
      const mod = await import("@/components/ProfileHeavyDetails");
      const ms = performance.now() - t0;
      mark("details-import-done", `${Math.round(ms)}ms`);
      if (ms > 500) {
        wrProfile("SLOW_SECTION", ms, "ProfileHeavyDetails import");
      } else {
        wrProfile("details-import-done", ms);
      }
      setDetailsPanel(() => mod.default);
      setDetailsOpen(true);
      await new Promise((r) => setTimeout(r, 0));
    } catch (e) {
      wrProfile(
        "details-import-fail",
        undefined,
        e instanceof Error ? e.message : "fail"
      );
    } finally {
      setDetailsLoading(false);
    }
  }

  // Light localStorage only — never @/lib/league (that pulls store→badges)
  const league = readLeague();
  const session = readSession();
  const leagueName = league?.name || "War Room";
  const sessionPlayerId = session?.playerId;
  const sportId = league?.sportId || "cfb";

  if (!ready) {
    return (
      <div className="min-h-screen flex flex-col">
        <main className="flex-1 flex flex-col items-center justify-center px-4 gap-2">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted">Opening profile…</p>
        </main>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen flex flex-col">
        <main className="flex-1 max-w-lg mx-auto px-4 py-16 text-center">
          <h1 className="text-xl font-bold mb-2">Player not found</h1>
          <p className="text-sm text-muted mb-2">
            Open a profile from Standings (click a name).
          </p>
          {id && (
            <p className="text-xs text-muted mb-2 font-mono break-all">
              id: {id}
            </p>
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
  const isSelfProfile = !!(
    sessionPlayerId &&
    sessionPlayerId === player.id
  );
  const equipped = wrProfileTimed("equipped-title-read", () =>
    getEquippedTitleLabel(player.id)
  );

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4 text-xs">
          <Link href="/" className="text-muted hover:text-foreground">
            ← Home
          </Link>
          <span className="text-border" aria-hidden>
            ·
          </span>
          <Link href="/standings" className="text-muted hover:text-foreground">
            Standings
          </Link>
          <span className="text-border" aria-hidden>
            ·
          </span>
          <Link
            href="/account"
            className="text-primary font-semibold hover:underline"
          >
            Account
          </Link>
        </div>

        {player.isCreator && isSelfProfile && (
          <Link
            href="/foundry"
            className="mb-4 flex min-h-[48px] w-full items-center justify-between rounded-xl border-2 border-amber-400/60 bg-amber-500/10 px-4 text-sm font-extrabold text-amber-200"
          >
            <span>Enter Foundry</span>
            <span aria-hidden>→</span>
          </Link>
        )}

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

        <section className="relative rounded-2xl border border-border bg-card p-5 sm:p-6 mb-6">
          <ProfileRankPlacard player={player} />
          <div className="flex min-h-[132px] flex-col gap-5 items-start sm:min-h-0 sm:flex-row sm:pr-[150px]">
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
                borderId={mock ? "plain" : undefined}
              />
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                {equipped && (
                  <span
                    className="text-xs sm:text-sm font-black uppercase tracking-wide text-amber-300 shrink-0"
                    title="Equipped on Account"
                  >
                    {equipped}
                  </span>
                )}
                <h1 className="text-2xl font-bold truncate">{player.name}</h1>
                {!mock && allegianceLoading && (
                  <span className="text-[10px] text-muted font-medium animate-pulse">
                    Team…
                  </span>
                )}
                {!mock &&
                  !allegianceLoading &&
                  (allegianceContext === "cfb" ||
                    allegianceContext === "both") && (
                    <AllegianceChip
                      label="CFB Team"
                      team={cfbFavorite}
                      empty={
                        cfbAnswered
                          ? "No team declared"
                          : "No CFB team declared"
                      }
                    />
                  )}
                {!mock &&
                  !allegianceLoading &&
                  (allegianceContext === "cbb" || allegianceContext === "both") && (
                    <AllegianceChip label="College Basketball Team" team={cbbFavorite} empty={cbbAnswered ? "No team declared" : "No college basketball team declared"} />
                  )}
                {!mock &&
                  !allegianceLoading &&
                  (allegianceContext === "nfl" ||
                    allegianceContext === "both") && (
                    <AllegianceChip
                      label="NFL Team"
                      team={nflFavorite}
                      empty={
                        nflAnswered
                          ? "No team declared"
                          : "No NFL team declared"
                      }
                    />
                  )}
                {!mock &&
                  !allegianceLoading &&
                  isSelfProfile &&
                  allegianceContext === "cbb" &&
                  !cbbAnswered && (
                    <Link href="/declare-allegiance?sport=cbb&next=/" className="text-[11px] font-bold text-primary underline-offset-2 hover:underline">Choose College Basketball Team</Link>
                  )}
                {!mock &&
                  !allegianceLoading &&
                  isSelfProfile &&
                  allegianceContext === "nfl" &&
                  !nflFavorite && (
                    <Link
                      href="/declare-allegiance?sport=nfl&next=/"
                      className="text-[11px] font-bold text-primary underline-offset-2 hover:underline"
                    >
                      Choose NFL Team
                    </Link>
                  )}
                {!mock &&
                  !allegianceLoading &&
                  isSelfProfile &&
                  allegianceContext === "cfb" &&
                  !cfbAnswered && (
                    <Link
                      href="/declare-allegiance?sport=cfb&next=/"
                      className="text-[11px] font-bold text-primary underline-offset-2 hover:underline"
                    >
                      Choose CFB Team
                    </Link>
                  )}
                {!mock && isJustJoined(player.memberSince) && (
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
                ) : (
                  "New recruit"
                )}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Chip
                  label="Member since"
                  value={
                    mock ? "Never" : formatMemberSince(player.memberSince)
                  }
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
              </div>
              {isSelfProfile && !mock && (
                <p className="text-[10px] text-muted mt-2 leading-relaxed">
                  Standings own season points. Badges and hardware load when you
                  open details below.
                  {sandboxHint
                    ? " Preseason: early cheevos don't stick to career yet."
                    : ""}
                </p>
              )}
            </div>
          </div>
        </section>

        {!detailsOpen && (
          <HeavyDetailsPlaceholder
            onLoad={() => void loadHeavyDetails()}
            loading={detailsLoading}
          />
        )}

        {detailsOpen && DetailsPanel && (
          <DetailsPanel
            player={player}
            joinTitle={joinTitle}
            isSelf={isSelfProfile}
          />
        )}

        <p className="text-[10px] text-muted text-center mt-4">
          {leagueName}
        </p>
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

function AllegianceChip({
  label,
  team,
  empty,
}: {
  label: string;
  team: CanonicalTeam | null;
  empty: string;
}) {
  if (team) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border"
        style={{
          borderColor: `${team.colors.primary}99`,
          color: team.colors.primary,
          backgroundColor: `${team.colors.primary}14`,
        }}
        title={label}
      >
        <span className="text-[9px] opacity-80 normal-case tracking-normal">
          {label}
        </span>
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: team.colors.primary }}
          aria-hidden
        />
        {team.name}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center text-[10px] font-semibold text-muted px-2 py-0.5 rounded-full border border-border"
      title={label}
    >
      {empty}
    </span>
  );
}
