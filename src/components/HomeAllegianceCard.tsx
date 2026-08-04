"use client";

/**
 * Existing users who have never answered CFB allegiance.
 * Required to answer; "no team" is a valid answer (recorded).
 * Shows only when cloud row is absent — not when team_id is no-team.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { needsCfbAllegiance } from "@/lib/favorite-teams";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";

export default function HomeAllegianceCard() {
  const [show, setShow] = useState(false);
  const [ready, setReady] = useState(false);

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
        const need = await needsCfbAllegiance();
        if (!cancelled) {
          setShow(need);
          setReady(true);
        }
      } catch {
        if (!cancelled) setReady(true);
      }
    })();

    function onFav() {
      void needsCfbAllegiance().then((n) => {
        if (!cancelled) setShow(n);
      });
    }
    window.addEventListener("warroom-favorite-team-updated", onFav);
    return () => {
      cancelled = true;
      window.removeEventListener("warroom-favorite-team-updated", onFav);
    };
  }, []);

  if (!ready || !show) return null;

  return (
    <div className="mb-5 rounded-2xl border-2 border-primary/50 bg-primary/10 p-5 shadow-[0_0_32px_rgba(34,197,94,0.2)]">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-2">
        One thing before we continue
      </p>
      <h2 className="text-xl font-black text-foreground mb-1">
        Who do you ride with?
      </h2>
      <p className="text-sm text-muted leading-relaxed mb-4">
        Answer once so the room knows where your loyalty—and your bias—lives.
        You can say no team. Playing works either way after you answer.
      </p>
      <Link
        href="/declare-allegiance?next=/"
        className="flex w-full items-center justify-center min-h-[52px] px-4 py-3.5 rounded-xl bg-primary text-black text-base font-black touch-manipulation"
      >
        ANSWER NOW
      </Link>
      <p className="text-[11px] text-muted text-center mt-3 leading-snug">
        Required to answer · not required to pick a team
      </p>
    </div>
  );
}
