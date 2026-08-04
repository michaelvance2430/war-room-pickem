"use client";

/**
 * Foundry-only CFB skin / atmosphere tester.
 * Drives the REAL production resolver + Home atmosphere.
 * Never mounted in the player shell — Foundry is the workshop.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSession } from "@/lib/league";
import { isAppCreator } from "@/lib/creator";
import {
  CREATOR_SKIN_SIM_EVENT,
  creatorSkinSimIndicatorLine,
  formatEasternWall,
  getCreatorSkinSim,
  installCreatorSkinConsoleRecovery,
  paintAutomaticSeasonTheme,
  peekResolvedCfbSkin,
  resetCreatorSkinSimToReal,
  setCreatorSkinSim,
  thanksgivingThursdayEt,
} from "@/lib/season-theme";

type Mode = "real" | "simulated";

const PRESETS: { label: string; etDate: string; etTime: string; week: number }[] =
  [
    { label: "Opening · W0", etDate: "2026-08-28", etTime: "12:00", week: 0 },
    { label: "Opening · W6", etDate: "2026-10-03", etTime: "12:00", week: 6 },
    { label: "Grind · W7", etDate: "2026-10-10", etTime: "12:00", week: 7 },
    { label: "Grind · W13", etDate: "2026-11-21", etTime: "12:00", week: 13 },
    { label: "Champ · W14", etDate: "2026-12-05", etTime: "12:00", week: 14 },
    { label: "Champ · W18", etDate: "2027-01-19", etTime: "12:00", week: 18 },
    {
      label: "Halloween eve",
      etDate: "2026-10-30",
      etTime: "00:00",
      week: 9,
    },
    {
      label: "Halloween day",
      etDate: "2026-10-31",
      etTime: "12:00",
      week: 9,
    },
    {
      label: "Halloween +1",
      etDate: "2026-11-01",
      etTime: "23:59",
      week: 9,
    },
    {
      label: "After Halloween",
      etDate: "2026-11-02",
      etTime: "00:00",
      week: 9,
    },
    {
      label: "Xmas eve-1",
      etDate: "2026-12-24",
      etTime: "00:00",
      week: 15,
    },
    {
      label: "Christmas",
      etDate: "2026-12-25",
      etTime: "12:00",
      week: 15,
    },
    {
      label: "Xmas +1 end",
      etDate: "2026-12-26",
      etTime: "23:59",
      week: 15,
    },
    {
      label: "After Xmas",
      etDate: "2026-12-27",
      etTime: "00:00",
      week: 15,
    },
    {
      label: "NYE",
      etDate: "2026-12-31",
      etTime: "12:00",
      week: 16,
    },
    {
      label: "New Year",
      etDate: "2027-01-01",
      etTime: "12:00",
      week: 16,
    },
    {
      label: "Jan 2",
      etDate: "2027-01-02",
      etTime: "23:59",
      week: 16,
    },
    {
      label: "After NY",
      etDate: "2027-01-03",
      etTime: "00:00",
      week: 16,
    },
  ];

function thanksgivingPresets(year: number) {
  const thu = thanksgivingThursdayEt(year);
  const wed = `${thu.year}-11-${String(thu.day - 1).padStart(2, "0")}`;
  const th = `${thu.year}-11-${String(thu.day).padStart(2, "0")}`;
  const fri = `${thu.year}-11-${String(thu.day + 1).padStart(2, "0")}`;
  const sat = `${thu.year}-11-${String(thu.day + 2).padStart(2, "0")}`;
  return [
    { label: "TG Wed", etDate: wed, etTime: "00:00", week: 13 },
    { label: "TG Thu", etDate: th, etTime: "12:00", week: 13 },
    { label: "TG Fri end", etDate: fri, etTime: "23:59", week: 13 },
    { label: "After TG", etDate: sat, etTime: "00:00", week: 13 },
  ];
}

/**
 * Full skin/theme controls for Foundry Hub only.
 * Not a floating player-app control.
 */
export default function CreatorSkinPreview() {
  const [allowed, setAllowed] = useState(false);
  const [mode, setMode] = useState<Mode>("real");
  const [etDate, setEtDate] = useState("2026-10-31");
  const [etTime, setEtTime] = useState("12:00");
  const [week, setWeek] = useState(9);
  const [indicator, setIndicator] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshIndicator = useCallback(() => {
    setIndicator(creatorSkinSimIndicatorLine(getSession()?.playerId));
    const sim = getCreatorSkinSim(getSession()?.playerId);
    if (sim?.active) {
      setMode("simulated");
      setEtDate(sim.etDate);
      setEtTime(sim.etTime);
      setWeek(sim.week);
    } else {
      setMode("real");
    }
  }, []);

  useEffect(() => {
    const uid = getSession()?.playerId;
    const ok = isAppCreator(uid);
    setAllowed(ok);
    if (!ok) return;
    installCreatorSkinConsoleRecovery();
    refreshIndicator();
    const wall = formatEasternWall(new Date());
    setEtDate(wall.etDate);
    setEtTime(wall.etTime);

    function onSim() {
      refreshIndicator();
      void paintAutomaticSeasonTheme();
    }
    window.addEventListener(CREATOR_SKIN_SIM_EVENT, onSim);
    return () => window.removeEventListener(CREATOR_SKIN_SIM_EVENT, onSim);
  }, [refreshIndicator]);

  const resolved = useMemo(
    () => peekResolvedCfbSkin({ etDate, etTime, week }),
    [etDate, etTime, week]
  );

  const allPresets = useMemo(() => {
    const y = Number(etDate.slice(0, 4)) || 2026;
    return [...PRESETS, ...thanksgivingPresets(y)];
  }, [etDate]);

  if (!allowed) return null;

  async function applySim() {
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "real") {
        await resetCreatorSkinSimToReal();
      } else {
        setCreatorSkinSim({ etDate, etTime, week });
        await paintAutomaticSeasonTheme();
      }
      refreshIndicator();
    } finally {
      setBusy(false);
    }
  }

  async function resetReal() {
    if (busy) return;
    setBusy(true);
    try {
      await resetCreatorSkinSimToReal();
      const wall = formatEasternWall(new Date());
      setEtDate(wall.etDate);
      setEtTime(wall.etTime);
      setMode("real");
      refreshIndicator();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      id="skin-tester"
      className="rounded-2xl border-2 border-amber-400/40 bg-card p-4 space-y-3 scroll-mt-24"
    >
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
          Foundry · skin tester
        </p>
        <h2 className="text-sm font-bold text-foreground mt-0.5">
          CFB atmosphere preview
        </h2>
        <p className="text-xs text-muted mt-1 leading-relaxed">
          Workshop only — never on the player app. Uses the production resolver
          + real Home paint. Browser only. No DB writes.
        </p>
      </div>

      {indicator ? (
        <div
          className="rounded-lg border border-amber-400/50 bg-amber-500/10 px-3 py-2"
          role="status"
        >
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-amber-300">
            Sim active
          </p>
          <p className="text-xs font-semibold text-amber-100 tabular-nums mt-0.5">
            {indicator}
          </p>
          <p className="text-[11px] text-muted mt-1 leading-snug">
            Theme will paint while you walk the app. Reset here or in console
            before demos.
          </p>
        </div>
      ) : null}

      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase text-muted">Mode</p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setMode("real")}
            className={`flex-1 min-h-[40px] rounded-lg text-[11px] font-bold ${
              mode === "real"
                ? "bg-primary/20 text-primary border border-primary/40"
                : "border border-border text-muted"
            }`}
          >
            Real / Automatic
          </button>
          <button
            type="button"
            onClick={() => setMode("simulated")}
            className={`flex-1 min-h-[40px] rounded-lg text-[11px] font-bold ${
              mode === "simulated"
                ? "bg-amber-500/20 text-amber-100 border border-amber-400/50"
                : "border border-border text-muted"
            }`}
          >
            Simulated
          </button>
        </div>
      </div>

      {mode === "simulated" ? (
        <>
          <label className="block text-[10px] font-bold uppercase text-muted">
            Simulated Eastern date
            <input
              type="date"
              value={etDate}
              onChange={(e) => setEtDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground"
            />
          </label>
          <label className="block text-[10px] font-bold uppercase text-muted">
            Simulated Eastern time
            <input
              type="time"
              value={etTime}
              onChange={(e) => setEtTime(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground"
            />
          </label>
          <label className="block text-[10px] font-bold uppercase text-muted">
            Simulated CFB week (0–18)
            <input
              type="number"
              min={0}
              max={18}
              value={week}
              onChange={(e) => setWeek(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground"
            />
          </label>

          <div>
            <p className="text-[10px] font-bold uppercase text-muted mb-1">
              Quick jumps
            </p>
            <div className="flex flex-wrap gap-1">
              {allPresets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setEtDate(p.etDate);
                    setEtTime(p.etTime);
                    setWeek(p.week);
                    setMode("simulated");
                  }}
                  className="min-h-[32px] px-2 rounded-md border border-border/70 text-[10px] font-semibold text-foreground hover:border-amber-400/50"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}

      <div className="rounded-lg border border-border/60 bg-black/40 px-2.5 py-2">
        <p className="text-[10px] font-bold uppercase text-muted">
          Resolved skin
        </p>
        <p className="text-sm font-extrabold text-white mt-0.5">
          {mode === "real" ? "(real time on Apply)" : resolved.label}
        </p>
        {mode === "simulated" ? (
          <p className="text-[10px] text-muted mt-0.5 font-mono">{resolved.id}</p>
        ) : null}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void applySim()}
          className="flex-1 min-h-[44px] rounded-lg bg-amber-500 text-black text-xs font-extrabold disabled:opacity-50"
        >
          {busy ? "…" : "Apply"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void resetReal()}
          className="flex-1 min-h-[44px] rounded-lg border border-border text-xs font-bold text-foreground disabled:opacity-50"
        >
          Reset to real time
        </button>
      </div>

      <p className="text-[10px] text-muted leading-snug">
        Console recovery:{" "}
        <code className="text-amber-200/90">__wrResetSkinPreview()</code>
        {" · "}
        Foundry only — not on Home / Picks / Standings.
      </p>
    </section>
  );
}
