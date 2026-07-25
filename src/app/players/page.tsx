"use client";

import { useState, useEffect } from "react";
import Nav from "@/components/Nav";
import { loadPlayers, savePlayers } from "@/lib/store";
import { Division, Player } from "@/lib/types";

const DIVISIONS: Division[] = ["North", "South", "East", "West"];

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [newName, setNewName] = useState("");
  const [newDivision, setNewDivision] = useState<Division>("North");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setPlayers(loadPlayers());
  }, []);

  function persist(next: Player[]) {
    setPlayers(next);
    savePlayers(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function addPlayer() {
    const name = newName.trim();
    if (!name) return;
    if (players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      alert("That name is already taken");
      return;
    }
    const player: Player = {
      id: `p-${Date.now()}`,
      name,
      division: newDivision,
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
    };
    persist([...players, player]);
    setNewName("");
  }

  function removePlayer(id: string) {
    if (id === "1") {
      alert("Can't remove the Commissioner account");
      return;
    }
    if (!confirm("Remove this player?")) return;
    persist(players.filter((p) => p.id !== id));
  }

  function changeDivision(id: string, division: Division) {
    persist(players.map((p) => (p.id === id ? { ...p, division } : p)));
  }

  function autoBalance() {
    const sorted = [...players].sort((a, b) => a.name.localeCompare(b.name));
    const next = sorted.map((p, i) => ({
      ...p,
      division: DIVISIONS[i % 4],
    }));
    persist(next);
  }

  const byDivision = DIVISIONS.map((d) => ({
    division: d,
    list: players.filter((p) => p.division === d),
  }));

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Players & Divisions</h1>
            <p className="text-sm text-muted">
              {players.length} players • Aim for equal divisions before the season
            </p>
          </div>
          {saved && <span className="text-sm text-primary">Saved</span>}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 mb-6">
          <h2 className="font-semibold mb-3">Add Player</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPlayer()}
              placeholder="Player name"
              className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
            <select
              value={newDivision}
              onChange={(e) => setNewDivision(e.target.value as Division)}
              className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
            >
              {DIVISIONS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <button
              onClick={addPlayer}
              className="px-4 py-2 rounded-lg bg-primary text-black text-sm font-medium hover:bg-primary-dim"
            >
              Add
            </button>
          </div>
        </div>

        <div className="flex justify-end mb-4">
          <button
            onClick={autoBalance}
            className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted hover:text-foreground"
          >
            Auto-balance divisions
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {byDivision.map(({ division, list }) => (
            <div key={division} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <span className="font-semibold">{division}</span>
                <span className="text-xs text-muted">{list.length}</span>
              </div>
              <div className="p-2 space-y-1 min-h-[120px]">
                {list.length === 0 && (
                  <p className="text-xs text-muted px-2 py-3">Empty</p>
                )}
                {list.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-card-hover group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {p.name}
                        {p.id === "1" && (
                          <span className="text-primary text-xs ml-1">(You)</span>
                        )}
                      </div>
                      <div className="text-xs text-muted">{p.totalPoints} pts</div>
                    </div>
                    <select
                      value={p.division}
                      onChange={(e) => changeDivision(p.id, e.target.value as Division)}
                      className="text-xs bg-background border border-border rounded px-1 py-0.5 opacity-0 group-hover:opacity-100 focus:opacity-100"
                    >
                      {DIVISIONS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    {p.id !== "1" && (
                      <button
                        onClick={() => removePlayer(p.id)}
                        className="text-xs text-danger opacity-0 group-hover:opacity-100"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
