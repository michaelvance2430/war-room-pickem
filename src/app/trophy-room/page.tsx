"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import YouBadge from "@/components/YouBadge";
import { getSession, getLeague, isCommissioner } from "@/lib/league";
import { loadLeagueRoster, type LeagueRosterMember } from "@/lib/cloud";
import {
  TROPHY_META,
  awardTrophy,
  defaultSeasonYear,
  groupTrophiesBySeason,
  loadLeagueTrophies,
  removeTrophy,
  type LeagueTrophy,
  type TrophyType,
} from "@/lib/trophies";
import { isSelfPlayer, selfNameClass } from "@/lib/self-highlight";

const TYPES: TrophyType[] = ["championship", "toilet_bowl", "crystal_ball"];

export default function TrophyRoomPage() {
  const [trophies, setTrophies] = useState<LeagueTrophy[]>([]);
  const [roster, setRoster] = useState<LeagueRosterMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState("");
  const [selfId, setSelfId] = useState<string | null>(null);
  const [commish, setCommish] = useState(false);

  // Award form
  const [year, setYear] = useState(defaultSeasonYear());
  const [type, setType] = useState<TrophyType>("championship");
  const [winnerUserId, setWinnerUserId] = useState("");
  const [winnerName, setWinnerName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [formMsg, setFormMsg] = useState<string | null>(null);

  async function reload() {
    setLoadError(null);
    try {
      const [list, members] = await Promise.all([
        loadLeagueTrophies(),
        loadLeagueRoster(),
      ]);
      setTrophies(list);
      setRoster(members.filter((m) => !m.isBot));
    } catch {
      setLoadError("Could not load trophy room.");
    }
  }

  useEffect(() => {
    const session = getSession();
    setSelfId(session?.playerId || null);
    setCommish(isCommissioner());
    setLeagueName(getLeague()?.name || "");
    reload().finally(() => setLoading(false));
  }, []);

  function onPickMember(userId: string) {
    setWinnerUserId(userId);
    const m = roster.find((r) => r.userId === userId);
    if (m) setWinnerName(m.name);
  }

  async function onAward(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormMsg(null);
    const result = await awardTrophy({
      seasonYear: year,
      trophyType: type,
      winnerName: winnerName || "Unknown",
      winnerUserId: winnerUserId || null,
      subtitle: subtitle || null,
      notes: notes || null,
    });
    setBusy(false);
    if (!result.ok) {
      setFormMsg(result.error || "Failed to award");
      return;
    }
    setFormMsg("Trophy engraved.");
    setSubtitle("");
    setNotes("");
    await reload();
  }

  async function onRemove(id: string, label: string) {
    if (!confirm(`Remove ${label} from the Trophy Room?`)) return;
    setBusy(true);
    const result = await removeTrophy(id);
    setBusy(false);
    if (!result.ok) {
      setFormMsg(result.error || "Could not remove");
      return;
    }
    await reload();
  }

  const seasons = groupTrophiesBySeason(trophies);
  const meta = TROPHY_META[type];

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="text-2xl font-bold">Trophy Room</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/30">
              League history
            </span>
          </div>
          <p className="text-sm text-muted max-w-2xl leading-relaxed">
            {leagueName ? (
              <>
                <span className="text-foreground font-medium">{leagueName}</span>
                {" · "}
              </>
            ) : null}
            Championships, Toilet Bowls, and Village Nerd awards — year after
            year. Stays with this league even when players join, leave, or the
            commissioner is passed on. Season reset does{" "}
            <span className="text-foreground font-medium">not</span> clear this
            room.
          </p>
        </div>

        {/* Legend pedestals */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10">
          {TYPES.map((t) => {
            const m = TROPHY_META[t];
            return (
              <div
                key={t}
                className={`rounded-xl border ${m.border} bg-card/80 p-4 ${m.glow}`}
              >
                <div className="text-3xl mb-2" aria-hidden>
                  {m.emoji}
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
          <p className="text-sm text-muted py-8 text-center">Opening the vault…</p>
        )}

        {loadError && (
          <p className="text-sm text-danger mb-4">{loadError}</p>
        )}

        {!loading && seasons.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center mb-10">
            <div className="text-4xl mb-3" aria-hidden>
              🏆
            </div>
            <p className="font-medium mb-1">Empty shelves — for now</p>
            <p className="text-sm text-muted max-w-md mx-auto">
              When the season ends, the commissioner engraves winners here.
              Friends come back next year and the hardware is still waiting.
            </p>
            {!commish && (
              <p className="text-xs text-muted mt-3">
                Only the commissioner can award trophies.
              </p>
            )}
          </div>
        )}

        {!loading &&
          seasons.map(({ year: y, items }) => (
            <section key={y} className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-lg font-bold tracking-tight">{y} Season</h2>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {TYPES.map((t) => {
                  const m = TROPHY_META[t];
                  const item = items.find((i) => i.trophyType === t);
                  if (!item) {
                    return (
                      <div
                        key={t}
                        className="rounded-xl border border-border/60 border-dashed bg-card/30 p-5 min-h-[140px] flex flex-col justify-center opacity-50"
                      >
                        <div className="text-2xl mb-2 grayscale">{m.emoji}</div>
                        <div className="text-xs uppercase tracking-wide text-muted">
                          {m.short}
                        </div>
                        <p className="text-sm text-muted mt-1">Not awarded</p>
                      </div>
                    );
                  }
                  const mine = isSelfPlayer(item.winnerUserId, selfId);
                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border ${m.border} bg-gradient-to-b from-card to-black/40 p-5 min-h-[140px] ${m.glow} relative`}
                    >
                      <div className="text-3xl mb-2">{m.emoji}</div>
                      <div
                        className={`text-xs uppercase tracking-wide font-semibold ${m.accent}`}
                      >
                        {m.title}
                      </div>
                      <div
                        className={`text-lg mt-1 ${selfNameClass(mine, "font-bold")}`}
                      >
                        {item.winnerName}
                        {mine && <YouBadge />}
                      </div>
                      {item.subtitle && (
                        <p className="text-xs text-muted mt-1">{item.subtitle}</p>
                      )}
                      {item.notes && (
                        <p className="text-[11px] text-muted/80 mt-2 italic">
                          {item.notes}
                        </p>
                      )}
                      {commish && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void onRemove(
                              item.id,
                              `${y} ${m.title} — ${item.winnerName}`
                            )
                          }
                          className="absolute top-3 right-3 text-[10px] text-muted hover:text-danger"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

        {commish && (
          <section className="rounded-xl border border-primary/30 bg-card p-5 space-y-4">
            <div>
              <h2 className="font-semibold text-primary">Engrave a trophy</h2>
              <p className="text-xs text-muted mt-1">
                One of each type per season year. Re-saving the same year + type
                overwrites the previous winner. One-time setup: run{" "}
                <code className="text-foreground">supabase/trophy-room.sql</code>{" "}
                in Supabase if awards fail.
              </p>
            </div>

            <form onSubmit={(e) => void onAward(e)} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block text-xs text-muted">
                  Season year
                  <input
                    type="number"
                    min={2000}
                    max={2100}
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value) || year)}
                    className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                  />
                </label>
                <label className="block text-xs text-muted sm:col-span-2">
                  Trophy
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as TrophyType)}
                    className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                  >
                    {TYPES.map((t) => (
                      <option key={t} value={t}>
                        {TROPHY_META[t].emoji} {TROPHY_META[t].title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block text-xs text-muted">
                Winner (from roster)
                <select
                  value={winnerUserId}
                  onChange={(e) => onPickMember(e.target.value)}
                  className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                >
                  <option value="">— Select player —</option>
                  {roster.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs text-muted">
                Name on plaque (auto-fills from roster; edit if they left)
                <input
                  value={winnerName}
                  onChange={(e) => setWinnerName(e.target.value)}
                  placeholder="Display name"
                  required
                  className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                />
              </label>

              <label className="block text-xs text-muted">
                Subtitle (optional)
                <input
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder={
                    type === "crystal_ball"
                      ? "e.g. Predicted Ohio State"
                      : type === "toilet_bowl"
                        ? "e.g. Flush King"
                        : "e.g. Undefeated bracket"
                  }
                  className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                />
              </label>

              <label className="block text-xs text-muted">
                Notes (optional)
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Lore for next year…"
                  className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                />
              </label>

              <p className={`text-xs ${meta.accent}`}>{meta.blurb}</p>

              <button
                type="submit"
                disabled={busy || !winnerName.trim()}
                className="px-4 py-2 rounded-lg bg-primary text-black text-sm font-semibold disabled:opacity-50"
              >
                {busy ? "Engraving…" : "Award trophy"}
              </button>
              {formMsg && (
                <p
                  className={`text-xs ${
                    formMsg.toLowerCase().includes("engrave")
                      ? "text-primary"
                      : "text-danger"
                  }`}
                >
                  {formMsg}
                </p>
              )}
            </form>

            <p className="text-[11px] text-muted">
              Stepping down?{" "}
              <Link href="/commissioner" className="text-primary hover:underline">
                Pass commissioner
              </Link>{" "}
              — the Trophy Room stays with the league.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
