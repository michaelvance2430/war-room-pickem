"use client";

/**
 * Pre–Week 0 “nothing to do” escape hatch.
 * One fake week, re-do as many times as you want. Dies at opening kickoff.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getLeague } from "@/lib/league";
import { hasOpeningWeekStarted } from "@/lib/ring-ceremony";
import { firstSeasonWeek } from "@/lib/season-calendar";
import { weekTitle } from "@/lib/dates";
import { getSession } from "@/lib/league";
import { isGuestMode } from "@/lib/guest-mode";
import { isBoredPracticeActive } from "@/lib/bored-practice";
import { startBoredPracticeWeek } from "@/lib/bored-practice-run";

export default function BoredLameSandboxCta() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [sportId, setSportId] = useState("cfb");
  const [again, setAgain] = useState(false);

  useEffect(() => {
    if (isGuestMode()) {
      setShow(false);
      return;
    }
    const league = getLeague();
    const sid = league?.sportId || "cfb";
    setSportId(sid);
    if (hasOpeningWeekStarted(sid)) {
      setShow(false);
      return;
    }
    const pid = getSession()?.playerId;
    setShow(!!pid);
    setAgain(isBoredPracticeActive());
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
      const res = await startBoredPracticeWeek();
      setNote(res.message);
      setAgain(true);
      if (res.goToPicks) {
        router.push("/picks");
      }
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
        {busy
          ? "Spinning up bots…"
          : again
            ? "I’m bored again. Same fake week."
            : "I’m bored. Fake week."}
      </button>
      <p className="text-[11px] sm:text-xs text-muted text-center mt-2.5 leading-relaxed max-w-md mx-auto">
        {sub}
      </p>
      <p className="text-[10px] text-muted/80 text-center mt-1.5 leading-relaxed max-w-sm mx-auto">
        One practice week. Re-do it as many times as you want. Lock → we score
        it → room wakes up. Dry-run only.
      </p>
      {note && (
        <p className="text-xs text-primary text-center mt-3 font-medium leading-relaxed">
          {note}
        </p>
      )}
    </section>
  );
}
