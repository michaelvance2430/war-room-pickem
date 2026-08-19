"use client";

/**
 * Favorite-team allegiance beside the sport's Crystal Ball experience.
 * This is identity, not the championship prediction. The saved team also
 * feeds the commissioner's anonymous blue league-interest game markers.
 */

import { useEffect, useState } from "react";
import TeamAllegiancePicker from "@/components/TeamAllegiancePicker";
import {
  EVENT_FAVORITE_TEAM_UPDATED,
  getMyFavoriteTeamId,
  resolveFavoriteTeam,
  setMyFavoriteTeam,
} from "@/lib/favorite-teams";
import type { SportId } from "@/lib/sports/types";
import type { CanonicalTeam } from "@/lib/teams/cfb-catalog";

type Props = {
  sportId: Extract<SportId, "cfb" | "nfl">;
};

export default function CrystalBallFavoriteTeamCard({ sportId }: Props) {
  const nfl = sportId === "nfl";
  const [favoriteId, setFavoriteId] = useState<string | null>(null);
  const [selected, setSelected] = useState<CanonicalTeam | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadFavorite() {
      const id = await getMyFavoriteTeamId(sportId);
      if (cancelled) return;
      const team = resolveFavoriteTeam(sportId, id);
      setFavoriteId(team?.id || null);
      setSelected(team);
      setEditing(!team);
      setLoading(false);
    }

    void loadFavorite();
    const onUpdated = () => void loadFavorite();
    window.addEventListener(EVENT_FAVORITE_TEAM_UPDATED, onUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener(EVENT_FAVORITE_TEAM_UPDATED, onUpdated);
    };
  }, [sportId]);

  async function saveFavorite() {
    if (!selected || saving) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await setMyFavoriteTeam(sportId, selected.id);
    setSaving(false);
    if (!result.ok) {
      setError(result.error || "Could not save your favorite team.");
      return;
    }
    setFavoriteId(selected.id);
    setEditing(false);
    setSaved(true);
  }

  if (loading) {
    return (
      <section className="mb-6 rounded-2xl border border-sky-500/25 bg-sky-500/5 p-4">
        <p className="text-xs font-semibold text-sky-300 animate-pulse">
          Loading your team…
        </p>
      </section>
    );
  }

  const favorite = resolveFavoriteTeam(sportId, favoriteId);

  if (!editing && favorite) {
    return (
      <section className="mb-6 rounded-2xl border-2 border-sky-500/50 bg-sky-500/10 p-4 shadow-[0_0_28px_rgba(59,130,246,0.12)]">
        <div className="flex items-center gap-3">
          <span
            className="h-12 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: favorite.colors.primary }}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-300">
              {nfl ? "Your NFL team" : "Your college football team"}
            </p>
            <p className="truncate text-lg font-black text-foreground">
              {favorite.name}
            </p>
            <p className="text-xs text-muted">
              Its games appear in blue for your commissioner.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelected(favorite);
              setEditing(true);
              setSaved(false);
            }}
            className="min-h-[44px] shrink-0 rounded-xl border border-sky-500/40 px-3 py-2 text-xs font-bold text-sky-300"
          >
            Change
          </button>
        </div>
        {saved && (
          <p className="mt-3 text-xs font-semibold text-sky-300">
            Favorite team saved.
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="mb-6 rounded-2xl border-2 border-sky-500/50 bg-sky-500/10 p-5 shadow-[0_0_28px_rgba(59,130,246,0.12)]">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-300">
        {nfl ? "Your NFL team" : "Your college football team"}
      </p>
      <h2 className="mt-1 text-lg font-black text-foreground">
        Who do you ride with?
      </h2>
      <p className="mb-4 mt-1 text-xs leading-relaxed text-muted">
        This is separate from your {nfl ? "Super Bowl" : "national champion"}{" "}
        pick. Your commissioner will see games involving your favorite team
        marked in blue—without seeing who chose it.
      </p>

      <TeamAllegiancePicker
        sportId={sportId}
        selectedId={selected?.id || null}
        onSelect={setSelected}
      />

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <div className="mt-4 flex gap-2">
        {favorite && (
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setSelected(favorite);
              setEditing(false);
              setError(null);
            }}
            className="min-h-[48px] rounded-xl border border-border px-4 text-sm font-semibold text-muted"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          disabled={!selected || saving}
          onClick={() => void saveFavorite()}
          className="min-h-[48px] flex-1 rounded-xl bg-sky-400 px-4 text-sm font-black text-slate-950 disabled:opacity-40"
        >
          {saving
            ? "Saving…"
            : selected
              ? `SAVE ${selected.name.toUpperCase()}`
              : "CHOOSE YOUR TEAM"}
        </button>
      </div>
    </section>
  );
}
