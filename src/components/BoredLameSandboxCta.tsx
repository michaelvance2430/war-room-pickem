"use client";

/**
 * Pre–Week 0 “nothing to do” escape hatch.
 * Huge sarcastic CTA → practice on bots / demo card. Dies at opening kickoff.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getLeague, isOps } from "@/lib/league";
import { hasOpeningWeekStarted } from "@/lib/ring-ceremony";
import { firstSeasonWeek } from "@/lib/season-calendar";
import { weekTitle } from "@/lib/dates";
import { isPreLockCalm } from "@/lib/first-week";
import { getSession } from "@/lib/league";
import { isGuestMode } from "@/lib/guest-mode";
import {
  loadWeekCard,
  publishWeekCard,
  seedBotPicksForWeekInCloud,
  setLeagueActiveWeek,
} from "@/lib/cloud";
import { generateDemoSlate } from "@/lib/demo-slate";
import { propFromPreset, rotatingPropPreset } from "@/lib/prop-presets";
import { isPreseasonCommishToolsAllowed } from "@/lib/season-mode";

export default function BoredLameSandboxCta() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [sportId, setSportId] = useState("cfb");

  useEffect(() => {
    if (isGuestMode()) {
      setShow(false);
      return;
    }
    const league = getLeague();
    const sid = league?.sportId || "cfb";
    setSportId(sid);
    // Hidden once opening week has started (Week 0 CFB / Week 1 NFL)
    if (hasOpeningWeekStarted(sid)) {
      setShow(false);
      return;
    }
    // Main audience: calm first session / nothing real to pick yet
    const pid = getSession()?.playerId;
    setShow(!!pid);
  }, []);

  if (!show) return null;

  const first = firstSeasonWeek(sportId);
  const openLabel = weekTitle(first, sportId);
  const sub =
    first === 0
      ? "Available until Week 0 kickoff. Then this goes away for good."
      : `Available until ${openLabel} kickoff. Then this goes away for good.`;

  async function onBored() {
    setNote(null);
    setBusy(true);
    try {
      const league = getLeague();
      const sid = league?.sportId === "nfl" ? "nfl" : "cfb";
      const week = firstSeasonWeek(sid);

      // If a card already exists, just go pick
      const existing = await loadWeekCard(week);
      if (existing?.games?.length) {
        await setLeagueActiveWeek(week).catch(() => undefined);
        router.push("/picks");
        setBusy(false);
        return;
      }

      // Host / ops in preseason: one-tap demo week + bots → picks
      if (isOps() && isPreseasonCommishToolsAllowed()) {
        const games = generateDemoSlate(week, 5, sid);
        const prop = propFromPreset(rotatingPropPreset(week, sid), week);
        const pub = await publishWeekCard({
          weekNumber: week,
          games,
          prop,
        });
        if (!pub.ok) {
          setNote(pub.error || "Couldn’t start a fake week. Try Host tools.");
          setBusy(false);
          return;
        }
        await seedBotPicksForWeekInCloud(week).catch(() => undefined);
        await setLeagueActiveWeek(week).catch(() => undefined);
        setNote("Fake week is live. Lock a card. Bots already did.");
        router.push("/picks");
        setBusy(false);
        return;
      }

      // Player, no card yet — can’t publish for the room
      setNote(
        "No card yet. Ask your host to publish a demo week — or wait until they do. This button still dies at Week 0 either way."
      );
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn’t start practice.");
    }
    setBusy(false);
  }

  return (
    <section className="mb-5 rounded-2xl border-2 border-dashed border-muted/40 bg-black/30 px-4 py-5 sm:px-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted mb-2 text-center">
        Nothing real to pick yet
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void onBored()}
        className="w-full py-5 sm:py-6 min-h-[64px] rounded-2xl bg-primary text-black text-lg sm:text-xl font-black tracking-tight disabled:opacity-50 shadow-[0_0_40px_rgba(34,197,94,0.2)] active:scale-[0.99] transition"
      >
        {busy ? "Spinning up bots…" : "I’m bored. Fake week."}
      </button>
      <p className="text-[11px] sm:text-xs text-muted text-center mt-2.5 leading-relaxed max-w-md mx-auto">
        {sub}
      </p>
      <p className="text-[10px] text-muted/80 text-center mt-1.5 leading-relaxed max-w-sm mx-auto">
        Practice on bots. Lock a card. Room wakes up. Not the real season —
        dry-run only.
      </p>
      {note && (
        <p className="text-xs text-primary text-center mt-3 font-medium leading-relaxed">
          {note}
        </p>
      )}
    </section>
  );
}
