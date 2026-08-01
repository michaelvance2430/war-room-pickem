"use client";

/**
 * Trophy Room — view engraved hardware.
 * All awards auto-engrave (no manual fill form). Host can Sync anytime.
 */

import { useEffect, useState } from "react";
import Nav from "@/components/Nav";
import YouBadge from "@/components/YouBadge";
import PlayerLink from "@/components/PlayerLink";
import { getSession, getLeague, isCommissioner, isOps } from "@/lib/league";
import { loadLeagueRoster, type LeagueRosterMember } from "@/lib/cloud";
import {
  TROPHY_META,
  defaultSeasonYear,
  groupTrophiesBySeason,
  loadLeagueTrophies,
  removeTrophy,
  type LeagueTrophy,
  type TrophyType,
} from "@/lib/trophies";
import ChampionshipBanner from "@/components/ChampionshipBanner";
import TrophyShareButton from "@/components/TrophyShareButton";
import HardwareTrophyIcon from "@/components/HardwareTrophyIcon";
import Link from "next/link";
import { isSelfPlayer, selfNameClass } from "@/lib/self-highlight";
import type { ProfileTrophyKind } from "@/lib/profile-hardware";
import { autoEngraveAllTrophies } from "@/lib/auto-trophies";
import { divisionFromTrophyType } from "@/lib/division-champions";
import { divisionDisplayLabel } from "@/lib/divisions";
import { seedPriorSeason2025Trophies } from "@/lib/prior-season-seed";
import { resolveLiveTrophyHolder } from "@/lib/trophy-share";

const BIG_TYPES: TrophyType[] = [
  "championship",
  "toilet_bowl",
  "crystal_ball",
];

const DIV_TYPES: TrophyType[] = [
  "division_north",
  "division_south",
  "division_east",
  "division_west",
];

export default function TrophyRoomPage() {
  const [trophies, setTrophies] = useState<LeagueTrophy[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState("");
  const [sportId, setSportId] = useState<string>("cfb");
  const [selfId, setSelfId] = useState<string | null>(null);
  const [canSync, setCanSync] = useState(false);
  const [busy, setBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  /** Full roster so every current trophy holder can resolve a face */
  const [roster, setRoster] = useState<LeagueRosterMember[]>([]);

  async function reload() {
    setLoadError(null);
    try {
      const list = await loadLeagueTrophies();
      setTrophies(list);
    } catch {
      setLoadError("Could not load trophy room.");
    }
  }

  async function loadRosterAvatars() {
    try {
      const rows = await loadLeagueRoster();
      setRoster(rows);
    } catch {
      setRoster([]);
    }
  }

  /** Live name + face — updates when holders rename / change photos. */
  function liveHolder(
    winnerUserId: string | null | undefined,
    winnerName: string
  ) {
    return resolveLiveTrophyHolder(roster, winnerUserId, winnerName);
  }

  useEffect(() => {
    const session = getSession();
    const league = getLeague();
    setSelfId(session?.playerId || null);
    setCanSync(isCommissioner() || isOps());
    setLeagueName(league?.name || "");
    setSportId(league?.sportId || "cfb");
    void loadRosterAvatars();
    reload()
      .then(async () => {
        // Quiet auto-sync when host opens the room
        if (isCommissioner() || isOps()) {
          try {
            await autoEngraveAllTrophies({});
            // Re-link Excel winners (e.g. Jstray → Toilet Bowl) + profile ids
            await seedPriorSeason2025Trophies();
            await reload();
            await loadRosterAvatars();
          } catch {
            /* ignore */
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function onSync() {
    setBusy(true);
    setSyncMsg(null);
    try {
      const res = await autoEngraveAllTrophies({});
      const relink = await seedPriorSeason2025Trophies();
      setSyncMsg(
        [res.message, relink.ok ? "Excel holders re-linked to live profiles." : null]
          .filter(Boolean)
          .join(" · ")
      );
      await reload();
      await loadRosterAvatars();
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : "Sync failed");
    }
    setBusy(false);
  }

  async function onImport2025() {
    if (
      !confirm(
        "Engrave full 2025–26 Excel season into this Trophy Room?\n\n" +
          "· Championship → Kahmann\n" +
          "· Toilet Bowl → Justin Strayer\n" +
          "· Village Nerd → Big Ball Ben\n\n" +
          "Safe to re-run. Links profiles when those names are in the roster."
      )
    ) {
      return;
    }
    setBusy(true);
    setSyncMsg(null);
    try {
      const res = await seedPriorSeason2025Trophies();
      setSyncMsg(res.message);
      await reload();
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : "Import failed");
    }
    setBusy(false);
  }

  async function onRemove(id: string, label: string) {
    if (!confirm(`Remove ${label} from the Trophy Room?`)) return;
    setBusy(true);
    const result = await removeTrophy(id);
    setBusy(false);
    if (!result.ok) {
      setSyncMsg(result.error || "Could not remove");
      return;
    }
    await reload();
  }

  const seasons = groupTrophiesBySeason(trophies);
  const year = defaultSeasonYear();

  function plaque(
    y: number,
    t: TrophyType,
    items: LeagueTrophy[]
  ) {
    const m = TROPHY_META[t];
    const item = items.find((i) => i.trophyType === t);
    if (!item) {
      return (
        <div
          key={t}
          className="rounded-xl border border-border/60 border-dashed bg-card/30 p-5 min-h-[160px] flex flex-col justify-center opacity-50"
        >
          <div className="mb-2">
            <HardwareTrophyIcon
              kind={
                t.startsWith("division_")
                  ? "championship"
                  : (t as "championship" | "toilet_bowl" | "crystal_ball")
              }
              sportId={sportId}
              size={52}
              empty
            />
          </div>
          <div className="text-xs uppercase tracking-wide text-muted">
            {t.startsWith("division_")
              ? divisionDisplayLabel(
                  divisionFromTrophyType(t) || "North",
                  sportId
                )
              : m.short}
          </div>
          <p className="text-sm text-muted mt-1">Not yet · auto when ready</p>
        </div>
      );
    }
    const live = liveHolder(item.winnerUserId, item.winnerName);
    const mine = isSelfPlayer(live.userId || item.winnerUserId, selfId);
    const shareKind = (
      t.startsWith("division_") ? "division" : t
    ) as ProfileTrophyKind;
    const divKey = divisionFromTrophyType(t);
    const sharePayload = {
      kind: shareKind,
      seasonYear: item.seasonYear,
      winnerName: live.name,
      leagueName,
      subtitle: item.subtitle,
      sportId,
      division: divKey || undefined,
      winnerUserId: live.userId || item.winnerUserId || undefined,
      winnerAvatarUrl: live.avatarUrl || undefined,
    };
    const title = item.subtitle || m.title;
    return (
      <div
        key={item.id}
        className={`rounded-xl border ${m.border} bg-gradient-to-b from-card to-black/40 p-5 min-h-[160px] ${m.glow} relative`}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <HardwareTrophyIcon
            kind={
              t.startsWith("division_")
                ? "championship"
                : (t as "championship" | "toilet_bowl" | "crystal_ball")
            }
            sportId={sportId}
            size={76}
            animate
          />
          <div className="flex items-center gap-1.5">
            <TrophyShareButton compact trophy={sharePayload} />
            {canSync && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void onRemove(
                    item.id,
                    `${y} ${title} — ${live.name}`
                  )
                }
                className="text-[10px] text-muted hover:text-danger px-1"
              >
                Remove
              </button>
            )}
          </div>
        </div>
        <div className={`text-xs uppercase tracking-wide font-semibold ${m.accent}`}>
          {title}
        </div>
        <div className={`text-lg mt-1 ${selfNameClass(mine, "font-bold")}`}>
          <PlayerLink
            id={live.userId || item.winnerUserId}
            name={live.name}
          />
          {mine && <YouBadge />}
        </div>
        {item.notes && (
          <p className="text-[11px] text-muted/80 mt-2 italic">{item.notes}</p>
        )}
        <div className="mt-3">
          <TrophyShareButton
            trophy={sharePayload}
            label={mine ? "Share my win" : "Share this win"}
            className="w-full justify-center"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="text-2xl font-bold">Trophy Room</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/30">
              Auto-engraved
            </span>
          </div>
          <p className="text-sm text-muted max-w-2xl leading-relaxed">
            {leagueName ? (
              <>
                <span className="text-foreground font-medium">{leagueName}</span>
                {" · "}
              </>
            ) : null}
            Championships, Toilet Bowls, conference/division titles, and Village
            Nerd — written by the season, not by a form. Stays with this league
            forever. Season reset does{" "}
            <span className="text-foreground font-medium">not</span> clear this
            room.
          </p>
          <p className="mt-2 text-xs text-muted leading-relaxed max-w-xl">
            <strong className="text-foreground">How it locks in:</strong>{" "}
            conference titles after cut week · Championship / Toilet when the
            bracket final is decided · Village Nerd when Crystal Ball is crowned.
          </p>
          <p className="mt-2 text-xs">
            <Link
              href="/museum"
              className="text-amber-300 font-semibold hover:underline"
            >
              Open War Room Museum →
            </Link>
          </p>

          {canSync && (
            <div className="mt-4 flex flex-col gap-2">
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onSync()}
                  className="min-h-[44px] px-4 rounded-xl bg-primary text-black text-sm font-bold disabled:opacity-50"
                >
                  {busy ? "Syncing…" : "Sync trophies now"}
                </button>
                <p className="text-[11px] text-muted">
                  Host only · re-runs auto-engrave for {year}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onImport2025()}
                  className="min-h-[44px] px-4 rounded-xl border-2 border-amber-400/50 bg-amber-500/15 text-amber-100 text-sm font-bold disabled:opacity-50"
                >
                  {busy ? "Engraving…" : "Import 2025–26 season (Excel)"}
                </button>
                <p className="text-[11px] text-muted">
                  Full 2025–26 · Kahmann Champ · Strayer Toilet · Big Ball Ben
                  Nerd
                </p>
              </div>
            </div>
          )}
          {syncMsg && (
            <p className="mt-2 text-xs text-primary font-medium leading-relaxed">
              {syncMsg}
            </p>
          )}
        </div>

        <ChampionshipBanner
          trophies={trophies}
          leagueName={leagueName}
          sportId={sportId}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10">
          {BIG_TYPES.map((t) => {
            const m = TROPHY_META[t];
            return (
              <div
                key={t}
                className={`rounded-xl border ${m.border} bg-card/80 p-4 ${m.glow}`}
              >
                <div className="mb-2 flex items-center min-h-[72px]">
                  <HardwareTrophyIcon
                    kind={t}
                    sportId={sportId}
                    size={68}
                    animate
                  />
                </div>
                <div className={`font-semibold ${m.accent}`}>{m.title}</div>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  {m.blurb}
                </p>
              </div>
            );
          })}
        </div>

        {loading && (
          <p className="text-sm text-muted py-8 text-center">
            Opening the vault…
          </p>
        )}

        {loadError && (
          <p className="text-sm text-danger mb-4">{loadError}</p>
        )}

        {!loading && seasons.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center mb-10">
            <div className="flex justify-center mb-3 opacity-70">
              <HardwareTrophyIcon
                kind="championship"
                sportId={sportId}
                size={88}
                animate={false}
              />
            </div>
            <p className="font-medium mb-1">Empty shelves — for now</p>
            <p className="text-sm text-muted max-w-md mx-auto">
              Hardware appears automatically when the season decides it — cut
              week, bracket finals, Crystal Ball crown. Hosts can hit Sync
              anytime.
            </p>
          </div>
        )}

        {!loading &&
          seasons.map(({ year: y, items }) => (
            <section key={y} className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-lg font-bold tracking-tight">{y} Season</h2>
                <div className="flex-1 h-px bg-border" />
              </div>
              <p className="text-[10px] uppercase tracking-wider text-muted font-bold mb-2">
                Big hardware
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {BIG_TYPES.map((t) => plaque(y, t, items))}
              </div>
              <p className="text-[10px] uppercase tracking-wider text-muted font-bold mb-2">
                {sportId === "nfl"
                  ? "Division titles"
                  : "Conference titles"}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {DIV_TYPES.map((t) => plaque(y, t, items))}
              </div>
            </section>
          ))}

        {canSync && (
          <p className="text-[11px] text-muted mt-6">
            Stepping down?{" "}
            <Link href="/commissioner" className="text-primary hover:underline">
              Pass commissioner
            </Link>{" "}
            — the Trophy Room stays with the league. Optional SQL:{" "}
            <code className="text-foreground">supabase/division-trophies.sql</code>
            .
          </p>
        )}
      </main>
    </div>
  );
}
