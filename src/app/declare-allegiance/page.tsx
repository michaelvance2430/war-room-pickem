"use client";

/**
 * DECLARE YOUR ALLEGIANCE — CFB favorite team (Phase 1).
 * Required to answer; not required to pick a real team.
 * Real auth only. Supabase source of truth.
 */

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BrandMark from "@/components/BrandMark";
import TeamAllegiancePicker from "@/components/TeamAllegiancePicker";
import {
  getMyFavoriteTeamId,
  NO_TEAM_ID,
  safeNextPath,
  setMyFavoriteTeam,
} from "@/lib/favorite-teams";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";
import type { CanonicalTeam } from "@/lib/teams/cfb-catalog";
import { peekPendingJoinCode } from "@/lib/commish-onboarding";

type Choice =
  | { kind: "team"; team: CanonicalTeam }
  | { kind: "no-team" }
  | null;

function DeclareInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checking, setChecking] = useState(true);
  const [choice, setChoice] = useState<Choice>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"pick" | "recorded">("pick");

  const next = safeNextPath(searchParams.get("next"));

  function continueNext() {
    const code = peekPendingJoinCode();
    if (next && next !== "/") {
      router.replace(next);
      return;
    }
    if (code) {
      router.replace(`/join?code=${encodeURIComponent(code)}`);
      return;
    }
    router.replace("/");
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!hasSupabaseConfig()) {
        router.replace("/login");
        return;
      }
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (!data.user) {
          router.replace("/login?mode=signup");
          return;
        }
        // Any answer (team or no-team) skips the ceremony
        const existing = await getMyFavoriteTeamId("cfb");
        if (cancelled) return;
        if (existing) {
          continueNext();
          return;
        }
        setChecking(false);
      } catch {
        if (!cancelled) router.replace("/login");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, [router]);

  async function confirm() {
    if (!choice || busy) return;
    setBusy(true);
    setError(null);
    const teamId = choice.kind === "no-team" ? NO_TEAM_ID : choice.team.id;
    const res = await setMyFavoriteTeam("cfb", teamId);
    setBusy(false);
    if (!res.ok) {
      setError(res.error || "Could not save.");
      return;
    }
    setPhase("recorded");
    window.setTimeout(() => continueNext(), 1400);
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted text-sm">
        Loading…
      </div>
    );
  }

  const selectedTeam = choice?.kind === "team" ? choice.team : null;
  const noTeamSelected = choice?.kind === "no-team";
  const canConfirm = choice !== null && !busy;

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="flex justify-center mb-4">
          <BrandMark size={64} variant="force" className="rounded-xl" />
        </div>

        {phase === "recorded" ? (
          <div className="text-center space-y-3 pt-8">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">
              Allegiance recorded
            </p>
            <h1 className="text-2xl font-black text-foreground">
              {choice?.kind === "no-team"
                ? "No team"
                : choice?.kind === "team"
                  ? choice.team.name
                  : ""}
            </h1>
            <p className="text-sm text-muted leading-relaxed">
              {choice?.kind === "no-team"
                ? "Neutrality noted. You can claim a side later in Account."
                : "Your objectivity is now officially questionable."}
            </p>
          </div>
        ) : (
          <>
            <div className="text-center mb-6 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">
                Declare your allegiance
              </p>
              <h1 className="text-xl sm:text-2xl font-black text-foreground leading-tight">
                Who do you ride with?
              </h1>
              <p className="text-sm text-muted leading-relaxed max-w-sm mx-auto">
                Every pick tells us what you think. This one tells us who you
                are. You have to answer — but &quot;no team&quot; is a real
                answer.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setChoice({ kind: "no-team" })}
              className={`w-full mb-4 rounded-xl border px-4 py-3.5 min-h-[52px] text-left transition touch-manipulation ${
                noTeamSelected
                  ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                  : "border-border bg-card hover:border-muted"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="block text-sm font-bold text-foreground">
                  No team declared
                </span>
                {noTeamSelected && (
                  <span className="text-primary text-xs font-black shrink-0">
                    ✓
                  </span>
                )}
              </span>
              <span className="block text-xs text-muted mt-0.5 leading-snug">
                Stay neutral. Picks, leagues, and scores work the same. You can
                pick a team later in Account.
              </span>
            </button>

            <TeamAllegiancePicker
              selectedId={selectedTeam?.id ?? null}
              onSelect={(team) => setChoice({ kind: "team", team })}
            />

            {error && (
              <p className="text-sm text-danger text-center mt-3">{error}</p>
            )}

            <button
              type="button"
              disabled={!canConfirm}
              onClick={() => void confirm()}
              className="mt-5 w-full py-4 min-h-[56px] rounded-2xl bg-primary text-black text-base font-black tracking-tight disabled:opacity-40 touch-manipulation"
              style={
                selectedTeam
                  ? {
                      boxShadow: `0 0 28px ${selectedTeam.colors.primary}55`,
                    }
                  : undefined
              }
            >
              {busy
                ? "…"
                : noTeamSelected
                  ? "CONFIRM — NO TEAM"
                  : selectedTeam
                    ? "THIS IS MY TEAM"
                    : "CHOOSE AN ANSWER"}
            </button>
          </>
        )}
      </main>
    </div>
  );
}

export default function DeclareAllegiancePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-muted">
          Loading…
        </div>
      }
    >
      <DeclareInner />
    </Suspense>
  );
}
