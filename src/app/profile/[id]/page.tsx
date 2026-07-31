"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Nav from "@/components/Nav";
import AvatarLightbox from "@/components/AvatarLightbox";
import BadgeShelf from "@/components/BadgeShelf";
import {
  formatMemberSince,
  getAchievementPoints,
  getPlayerBadges,
  memberDuration,
} from "@/lib/badges";
import {
  isMockPlayer,
  mockRoastFor,
  mockRoastLabel,
} from "@/lib/mock-roasts";
import { findPlayer, loadPlayers, savePlayers } from "@/lib/store";
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
 * Profile page — keep it dumb:
 * 1) read id from URL
 * 2) findPlayer(id)
 * 3) render
 */
export default function ProfilePage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [player, setPlayer] = useState<Player | null>(null);
  const [ready, setReady] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [avatarInput, setAvatarInput] = useState("");
  const [showAvatarForm, setShowAvatarForm] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // 1) Local/mock roster
      let found = findPlayer(id);

      // 2) Live league standings (Supabase) — real multiplayer ids
      if (!found) {
        try {
          const { loadLeaguePlayers } = await import("@/lib/cloud");
          const league = await loadLeaguePlayers();
          found = league.find((p) => p.id === id) ?? null;
          if (found) {
            // Pull avatar from roster when available
            try {
              const { loadLeagueRoster } = await import("@/lib/cloud");
              const roster = await loadLeagueRoster();
              const row = roster.find((m) => m.userId === id);
              if (row?.avatarUrl) {
                found = { ...found, avatarUrl: row.avatarUrl };
              }
            } catch {
              /* optional */
            }
          }
        } catch {
          /* offline / no session */
        }
      }

      if (cancelled) return;
      setPlayer(found);
      setAvatarInput(found?.avatarUrl || "");
      setReady(true);
    }

    setReady(false);
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const badges = useMemo(
    () => (player ? getPlayerBadges(player) : []),
    [player]
  );
  const points = useMemo(
    () => (player ? getAchievementPoints(player) : 0),
    [player]
  );

  function saveAvatar() {
    if (!player || player.isMock) return;
    const url = avatarInput.trim() || null;
    const next = loadPlayers().map((p) =>
      p.id === player.id ? { ...p, avatarUrl: url } : p
    );
    savePlayers(next);
    setPlayer({ ...player, avatarUrl: url });
    setShowAvatarForm(false);
  }

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
          <p className="text-sm text-muted mb-4">id: {id || "(empty)"}</p>
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
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border border-badge-legendary text-badge-legendary">
                    Creator
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

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Chip
                  label="Member since"
                  value={mock ? "Never" : formatMemberSince(player.memberSince)}
                />
                <Chip label="Achievement pts" value={String(points)} accent />
                <Chip label="Season pts" value={String(player.totalPoints)} />
                <Chip
                  label="Gold badges"
                  value={String(
                    badges.filter(
                      (b) => b.earned && b.def.tier === "legendary"
                    ).length
                  )}
                />
              </div>

              {!mock && (
                <div className="mt-4">
                  {!showAvatarForm ? (
                    <button
                      type="button"
                      onClick={() => setShowAvatarForm(true)}
                      className="text-xs text-primary hover:underline"
                    >
                      {player.avatarUrl
                        ? "Change profile photo"
                        : "Add profile photo"}
                    </button>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="url"
                        value={avatarInput}
                        onChange={(e) => setAvatarInput(e.target.value)}
                        placeholder="Paste image URL"
                        className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={saveAvatar}
                        className="px-3 py-2 rounded-lg bg-primary text-black text-sm font-medium"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAvatarForm(false)}
                        className="px-3 py-2 rounded-lg border border-border text-sm text-muted"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
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

        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <BadgeShelf badges={badges} />
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
