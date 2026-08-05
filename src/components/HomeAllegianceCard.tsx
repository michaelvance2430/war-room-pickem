"use client";

/**
 * Required sport allegiance for the active room.
 * CFB: answer once (team or no-team).
 * NFL: real NFL club required (separate from Super Bowl Crystal Ball pick).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  needsCfbAllegiance,
  needsNflAllegiance,
} from "@/lib/favorite-teams";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";
import { getLeague } from "@/lib/league";
import { normalizeSportId } from "@/lib/sports/registry";

export default function HomeAllegianceCard() {
  const [show, setShow] = useState(false);
  const [ready, setReady] = useState(false);
  const [sportId, setSportId] = useState("cfb");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (!hasSupabaseConfig()) {
          if (!cancelled) setReady(true);
          return;
        }
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (!data.user) {
          if (!cancelled) setReady(true);
          return;
        }
        const sid = normalizeSportId(getLeague()?.sportId || "cfb");
        if (!cancelled) setSportId(sid);

        const need =
          sid === "nfl"
            ? await needsNflAllegiance()
            : sid === "cfb"
              ? await needsCfbAllegiance()
              : false;
        if (!cancelled) {
          setShow(need);
          setReady(true);
        }
      } catch {
        if (!cancelled) setReady(true);
      }
    })();

    function onFav() {
      void (async () => {
        const sid = normalizeSportId(getLeague()?.sportId || "cfb");
        const need =
          sid === "nfl"
            ? await needsNflAllegiance()
            : sid === "cfb"
              ? await needsCfbAllegiance()
              : false;
        if (!cancelled) {
          setSportId(sid);
          setShow(need);
        }
      })();
    }
    window.addEventListener("warroom-favorite-team-updated", onFav);
    return () => {
      cancelled = true;
      window.removeEventListener("warroom-favorite-team-updated", onFav);
    };
  }, []);

  if (!ready || !show) return null;

  const isNfl = sportId === "nfl";
  const href = isNfl
    ? "/declare-allegiance?sport=nfl&next=/"
    : "/declare-allegiance?sport=cfb&next=/";

  return (
    <div className="mb-5 rounded-2xl border-2 border-primary/50 bg-primary/10 p-5 shadow-[0_0_32px_rgba(34,197,94,0.2)]">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-2">
        One thing before we continue
      </p>
      <h2 className="text-xl font-black text-foreground mb-1">
        {isNfl ? "Pick your NFL team" : "Who do you ride with?"}
      </h2>
      <p className="text-sm text-muted leading-relaxed mb-4">
        {isNfl
          ? "Your team is who you identify with — not your Super Bowl prediction. That comes next if pride pick is on."
          : "Answer once so the room knows where your loyalty—and your bias—lives. You can say no team. Playing works either way after you answer."}
      </p>
      <Link
        href={href}
        className="flex w-full items-center justify-center min-h-[52px] px-4 py-3.5 rounded-xl bg-primary text-black text-base font-black touch-manipulation"
      >
        {isNfl ? "CHOOSE NFL TEAM" : "ANSWER NOW"}
      </Link>
      <p className="text-[11px] text-muted text-center mt-3 leading-snug">
        {isNfl
          ? "Required · separate from Super Bowl pick"
          : "Required to answer · not required to pick a team"}
      </p>
    </div>
  );
}
