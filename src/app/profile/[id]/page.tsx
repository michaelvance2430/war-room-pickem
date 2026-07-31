"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Nav from "@/components/Nav";
import AvatarLightbox from "@/components/AvatarLightbox";
import BadgeShelf from "@/components/BadgeShelf";
import {
  formatMemberSince,
  getPlayerBadges,
  memberDuration,
  syncLeagueCheevoKing,
  withPermanentBadges,
} from "@/lib/badges";
import { syncCareerWithPlayer } from "@/lib/career-cheevo";
import { withCreatorFlag } from "@/lib/creator";
import {
  isMockPlayer,
  mockRoastFor,
  mockRoastLabel,
} from "@/lib/mock-roasts";
import { findPlayer } from "@/lib/store";
import { Player } from "@/lib/types";

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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadError(null);
      try {
        let found: Player | null = null;
        let leagueForSync: Player[] = [];

        // Live league first (real multiplayer)
        try {
          const { loadLeaguePlayers, loadLeagueRoster } = await import(
            "@/lib/cloud"
          );
          leagueForSync = await loadLeaguePlayers();
          found = leagueForSync.find((p) => p.id === id) ?? null;
          if (found) {
            try {
              const roster = await loadLeagueRoster();
              const row = roster.find((m) => m.userId === id);
              if (row) {
                found = {
                  ...found,
                  avatarUrl: row.avatarUrl ?? found.avatarUrl,
                  name: row.name || found.name,
                };
              }
            } catch {
              /* optional */
            }
          }

          // Crown Cheevo King among live league (permanent storage by user id)
          if (leagueForSync.length) {
            syncLeagueCheevoKing(
              leagueForSync.map((p) => withPermanentBadges(p))
            );
          }
        } catch {
          /* no session / offline */
        }

        // Local/mock fallback
        if (!found) {
          found = findPlayer(id);
        }

        if (found) {
          found = withPermanentBadges(withCreatorFlag(found));
        }

        if (cancelled) return;
        setPlayer(found);
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Failed to load");
          setPlayer(null);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    setReady(false);
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const badges = useMemo(() => {
    if (!player) return [];
    try {
      return getPlayerBadges(player);
    } catch {
      return [];
    }
  }, [player]);

  const { seasonPoints, careerPoints } = useMemo(() => {
    if (!player) return { seasonPoints: 0, careerPoints: 0 };
    try {
      return syncCareerWithPlayer(player, badges);
    } catch {
      return { seasonPoints: 0, careerPoints: 0 };
    }
  }, [player, badges]);

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

        <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            <button
              type="button"
              onClick={() => setLightbox(true)}
              className="shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title="Expand photo"
            >
              {player.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={player.avatarUrl}
                  alt={player.name}
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-2 border-border"
                />
              ) : (
                <div
                  className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full border-2 flex items-center justify-center text-2xl font-bold bg-background ${
                    mock
                      ? "border-warning/50 text-warning"
                      : "border-border text-primary"
                  }`}
                >
                  {ini}
                </div>
              )}
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold truncate">{player.name}</h1>
                {player.isCreator && (
                  <span
                    className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border border-yellow-500 text-yellow-500"
                    title="Built the app — not the same as league commissioner"
                  >
                    Game creator
                  </span>
                )}
                {mock && (
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border border-warning/60 text-warning">
                    NPC
                  </span>
                )}
              </div>
              <p className="text-sm text-muted mb-3">
                {player.division} Division ·{" "}
                {mock
                  ? "Lab-grown for your league"
                  : memberDuration(player.memberSince)}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <Chip
                  label="Member since"
                  value={mock ? "Never" : formatMemberSince(player.memberSince)}
                />
                <Chip
                  label="Season cheevo pts"
                  value={String(seasonPoints)}
                  accent
                />
                <Chip
                  label="Career cheevo pts"
                  value={String(careerPoints)}
                />
                <Chip
                  label="Pick'em season pts"
                  value={String(player.totalPoints)}
                />
                <Chip
                  label="Badges earned"
                  value={`${earnedCount}/${badges.length || "?"}`}
                />
              </div>
              <p className="text-[10px] text-muted mt-2">
                Season cheevo = this year&apos;s earnable badges. Career =
                all-time (incl. creator legendary if you have it). Creator crown
                never pads season totals.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 mb-6">
          <h2 className="font-semibold mb-3">Season snapshot</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <Mini
              label="ATS"
              value={
                player.atsTotal
                  ? `${player.atsCorrect}-${player.atsTotal - player.atsCorrect}`
                  : "—"
              }
            />
            <Mini
              label="Streak"
              value={
                player.currentStreak > 0
                  ? `W${player.currentStreak}`
                  : player.currentStreak < 0
                    ? `L${Math.abs(player.currentStreak)}`
                    : "—"
              }
            />
            <Mini label="Best week" value={String(player.bestWeek || "—")} />
            <Mini
              label="Perfect weeks"
              value={String(player.perfectWeeks || 0)}
            />
          </div>
        </section>

        {/* Badges — always mount when we have a player */}
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 mb-6">
          {badges.length > 0 ? (
            <BadgeShelf badges={badges} />
          ) : (
            <div>
              <h2 className="font-semibold text-lg mb-2">Badge shelves</h2>
              <p className="text-sm text-muted">
                Could not load badges. Try a hard refresh.
              </p>
            </div>
          )}
        </div>
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
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg bg-background border border-border px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted">
        {label}
      </div>
      <div
        className={`text-sm font-semibold truncate ${accent ? "text-primary" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
