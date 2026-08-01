"use client";

/**
 * Pre–Week 0 escape hatch — private practice, zero live-season data.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getLeague, getSession } from "@/lib/league";
import { hasOpeningWeekStarted } from "@/lib/ring-ceremony";
import { firstSeasonWeek } from "@/lib/season-calendar";
import { weekTitle } from "@/lib/dates";
import { isGuestMode } from "@/lib/guest-mode";
import { BORED_PRACTICE_WEEK, isBoredPracticeActive } from "@/lib/bored-practice";
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
    setShow(!!getSession()?.playerId);
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
      if (res.ok) setAgain(true);
      if (res.goToPicks) {
        window.setTimeout(() => {
          router.push(`/picks?week=${BORED_PRACTICE_WEEK}&practice=1`);
        }, 350);
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn’t start practice.");
    }
    setBusy(false);
  }

  return (
    <section className="mb-5 rounded-2xl border-2 border-dashed border-muted/40 bg-black/30 px-4 py-5 sm:px-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted mb-2 text-center">
        Private practice · not the live season
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void onBored()}
        className="w-full py-5 sm:py-6 min-h-[64px] rounded-2xl bg-primary text-black text-lg sm:text-xl font-black tracking-tight disabled:opacity-50 shadow-[0_0_40px_rgba(34,197,94,0.2)] active:scale-[0.99] transition"
      >
        {busy
          ? "Building a fake week…"
          : again
            ? "I’m bored again. New fake week."
            : "I’m bored. Fake week."}
      </button>
      <p className="text-[11px] sm:text-xs text-muted text-center mt-2.5 leading-relaxed max-w-md mx-auto">
        {sub}
      </p>
      <p className="text-[10px] text-muted/80 text-center mt-1.5 leading-relaxed max-w-sm mx-auto">
        One private practice week — never touches live picks or standings. Lock
        → we score it → you see how the room wakes up. Re-do anytime.
      </p>
      {note && (
        <p className="text-xs text-primary text-center mt-3 font-medium leading-relaxed">
          {note}
        </p>
      )}
    </section>
  );
}
