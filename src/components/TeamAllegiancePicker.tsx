"use client";

/**
 * Searchable team picker for declare-allegiance / Account.
 * CFB or NFL catalog via sportId — never mixes sports.
 */

import { useMemo, useState } from "react";
import {
  listCfbCatalog,
  type CanonicalTeam,
} from "@/lib/teams/cfb-catalog";
import { listNflCatalog } from "@/lib/teams/nfl-catalog";
import { listCbbCatalog } from "@/lib/teams/cbb-catalog";
import type { SportId } from "@/lib/sports/types";

type Props = {
  selectedId: string | null;
  onSelect: (team: CanonicalTeam) => void;
  /** Default cfb. nfl uses pro catalog only. */
  sportId?: SportId | string;
};

export default function TeamAllegiancePicker({
  selectedId,
  onSelect,
  sportId = "cfb",
}: Props) {
  const [q, setQ] = useState("");
  const teams = useMemo(
    () =>
      sportId === "nfl"
        ? listNflCatalog()
        : sportId === "cbb"
          ? listCbbCatalog()
          : listCfbCatalog(),
    [sportId]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return teams;
    return teams.filter((t) => {
      if (t.name.toLowerCase().includes(needle)) return true;
      if (t.conference.toLowerCase().includes(needle)) return true;
      if (t.id.includes(needle.replace(/\s+/g, "-"))) return true;
      return t.aliases.some((a) => a.toLowerCase().includes(needle));
    });
  }, [teams, q]);

  const selected = selectedId
    ? teams.find((t) => t.id === selectedId) || null
    : null;

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={
          sportId === "nfl"
            ? "Search NFL teams or divisions…"
            : "Search teams or conferences…"
        }
        className="w-full bg-background border border-border rounded-xl px-4 py-3 text-base min-h-[48px] focus:outline-none focus:border-primary"
        autoComplete="off"
      />

      {selected && (
        <div
          className="rounded-xl border-2 px-4 py-3 flex items-center gap-3"
          style={{
            borderColor: selected.colors.primary,
            backgroundColor: `${selected.colors.primary}18`,
          }}
        >
          <span
            className="w-3 h-10 rounded-full shrink-0"
            style={{ backgroundColor: selected.colors.primary }}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="font-bold text-foreground truncate">{selected.name}</p>
            <p className="text-xs text-muted">{selected.conference}</p>
          </div>
        </div>
      )}

      <div className="max-h-[min(50vh,22rem)] overflow-y-auto rounded-xl border border-border divide-y divide-border/60">
        {filtered.length === 0 && (
          <p className="text-sm text-muted text-center py-8 px-3">
            No teams match. Try another spelling.
          </p>
        )}
        {filtered.map((t) => {
          const on = t.id === selectedId;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t)}
              className={`w-full text-left px-3 py-3 min-h-[52px] flex items-center gap-3 transition touch-manipulation ${
                on ? "bg-primary/10" : "hover:bg-card-hover"
              }`}
            >
              <span
                className="w-2.5 h-8 rounded-full shrink-0"
                style={{ backgroundColor: t.colors.primary }}
                aria-hidden
              />
              <span className="flex-1 min-w-0">
                <span className="font-semibold text-sm block truncate">
                  {t.name}
                </span>
                <span className="text-[11px] text-muted">{t.conference}</span>
              </span>
              {on && (
                <span className="text-primary text-xs font-black shrink-0">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
