"use client";

/**
 * EMERGENCY CONTAINMENT (P0 main-thread freeze)
 * - Identity-first paint only
 * - No getPlayerBadges / badge catalog on initial render
 * - Heavy sections deferred until user expands (dynamic import)
 * - No league-wide peer sync before interactive
 *
 * NOTE: Still static-imports @/lib/store (findPlayer) and @/lib/league —
 * both pull store → badges.ts. Pre-render freeze investigation: see
 * docs/PROFILE_PRE_RENDER_FREEZE.md. Do not restore eager shelves yet.
 */

import { useEffect, useRef, useState, type ComponentType } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Avatar from "@/components/Avatar";
import AvatarLightbox from "@/components/AvatarLightbox";
import { divisionFullLabel } from "@/lib/divisions";
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
  isMockPlayer,
  mockRoastFor,
  mockRoastLabel,
} from "@/lib/mock-roasts";
import { findPlayer } from "@/lib/store";
import { getLeague, getSession } from "@/lib/league";
import { Player } from "@/lib/types";
import { wrProfile, wrProfileTimed, wrProfileRoute } from "@/lib/runtime-iso";

// Module evaluation boundary — if this never logs, freeze is BEFORE profile chunk runs
wrProfileRoute("module-top");

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
  wrProfileRoute("render-enter");
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [player, setPlayer] = useState<Player | null>(null);
  const [ready, setReady] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [joinTitle, setJoinTitle] = useState<string | null>(null);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const [blueFalconCount, setBlueFalconCount] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [DetailsPanel, setDetailsPanel] = useState<ComponentType<{
    player: Player;
    joinTitle: string | null;
    isSelf: boolean;
  }> | null>(null);
  const hadPaintRef = useRef(false);

  useEffect(() => {
    wrProfileRoute("effect-enter", `id=${id.slice(0, 8)}`);
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

      const failSafe = window.setTimeout(() => {
        if (!cancelled) setReady(true);
      }, 2_500);

      try {
        let found: Player | null = null;
        let title: string | null = null;
        let seen: string | null = null;

        // Roster only — no standings, no badge catalog
        try {
          const { loadLeagueRoster } = await import("@/lib/cloud");
          const roster = await loadLeagueRoster();
          if (cancelled) return;
          if (roster.length) {
            const titles = computeJoinTitles(roster);
            title = titles.get(id) || null;
            const row = roster.find((m) => m.userId === id);
            if (row) {
              if (row.lastSeenAt) seen = row.lastSeenAt;
              found = rosterToPlayer(row);
            }
          }
        } catch {
          /* offline */
        }

        if (!found) found = findPlayer(id);

        if (found) {
          // Lightweight creator flag only — no permanent badge grants / catalog
          found = withCreatorFlag(found);
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

        if (!cancelled) {
          setPlayer(found);
          setJoinTitle(title);
          setLastSeenAt(seen);
          if (found) hadPaintRef.current = true;
          setReady(true);
          window.clearTimeout(failSafe);
          wrProfile("data-effect-first-paint", undefined, found ? "found" : "missing");
        }

        if (!found || cancelled) return;

        // Blue Falcon — non-blocking, after paint
        void (async () => {
          try {
            const { hydrateBlueFalconFromCloud, getBlueFalconCount } =
              await import("@/lib/blue-falcon");
            let bf = await hydrateBlueFalconFromCloud(id);
            if (!bf) bf = getBlueFalconCount(id);
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
          wrProfile("interactive");
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
    wrProfile("details-import-start");
    const t0 = performance.now();
    try {
      // Dynamic import — modules NOT on initial render path
      const mod = await import("@/components/ProfileHeavyDetails");
      const ms = performance.now() - t0;
      if (ms > 500) {
        wrProfile("SLOW_SECTION", ms, "ProfileHeavyDetails import");
      } else {
        wrProfile("details-import-done", ms);
      }
      setDetailsPanel(() => mod.default);
      setDetailsOpen(true);
      // Yield before React mounts the heavy tree
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

  const leagueName = getLeague()?.name || "War Room";
  const sessionPlayerId = getSession()?.playerId;
  const sportId = getLeague()?.sportId || "cfb";

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
                  {isSandboxMode()
                    ? " Sandbox: sim cheevos don't stick to career."
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
