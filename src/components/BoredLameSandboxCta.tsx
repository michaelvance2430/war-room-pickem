"use client";

/**
 * I’m Bored — temporary fun lobby (social).
 * Not Practice Mode. Not picks. Not a second league.
 * Opens a random mess-around room with the same friends.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/league";
import { pickRandomFunRoom } from "@/lib/fun-lobby";

export default function BoredLameSandboxCta() {
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Members + guests (guests can peek, post gated on /bored)
        setShow(!!getSession()?.playerId);

    // Retire sticky Practice Mode if anything left over
    void import("@/lib/bored-practice").then((m) => {
      try {
        if (m.isBoredPracticeActive()) m.exitBoredPracticeToLive();
      } catch {
        /* ok */
      }
    });
  }, []);

  if (!show) return null;

  function goBored() {
    const room = pickRandomFunRoom(
      `${getSession()?.playerId || "x"}:${Date.now()}`
    );
    router.push(`/bored?room=${room.id}`);
  }

  return (
    <section className="mb-5 rounded-2xl border-2 border-dashed border-muted/40 bg-black/30 px-4 py-5 sm:px-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted mb-2 text-center">
        Nothing on the card · make your own fun
      </p>
      <button
        type="button"
        onClick={goBored}
        className="w-full py-5 sm:py-6 min-h-[64px] rounded-2xl bg-primary text-black text-lg sm:text-xl font-black tracking-tight shadow-[0_0_40px_rgba(34,197,94,0.2)] active:scale-[0.99] transition"
      >
        I&apos;m Bored
      </button>
      <p className="text-[11px] sm:text-xs text-muted text-center mt-2.5 leading-relaxed max-w-md mx-auto">
        Random lobby with the room. Trash talk, memes, coffee — leave whenever.
        Not your weekly league chat.
      </p>
    </section>
  );
}
