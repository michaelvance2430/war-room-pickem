"use client";

/**
 * DECLARE YOUR ALLEGIANCE — favorite team by sport.
 * CFB: real team or explicit no-team.
 * NFL: real NFL club required (not Super Bowl pick — separate Crystal Ball).
 * Real auth only. Supabase profile_favorite_teams (user_id, sport_id).
 */

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BrandMark from "@/components/BrandMark";
import TeamAllegiancePicker from "@/components/TeamAllegiancePicker";
import {
  getMyFavoriteTeamId,
  isRealTeamId,
  NO_TEAM_ID,
  safeNextPath,
  setMyFavoriteTeam,
} from "@/lib/favorite-teams";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";
import type { CanonicalTeam } from "@/lib/teams/cfb-catalog";
import { peekPendingJoinCode } from "@/lib/commish-onboarding";
import type { SportId } from "@/lib/sports/types";
import { normalizeSportId } from "@/lib/sports/registry";

type Choice =
  | { kind: "team"; team: CanonicalTeam }
  | { kind: "no-team" }
  | null;

function DeclareInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sportRaw = searchParams.get("sport");
  // Require explicit sport — never invent CFB as a universal default.
  const sportId = (normalizeSportId(sportRaw || "") || "") as SportId | "";
  const isNfl = sportId === "nfl";
  const isCbb = sportId === "cbb";
  const sportKnown = sportId === "nfl" || sportId === "cfb" || isCbb;

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
      // No sport context → join/home; do not force CFB allegiance.
      if (!sportKnown) {
        continueNext();
        return;
      }
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (!data.user) {
          router.replace("/login?mode=signup");
          return;
        }
        const existing = await getMyFavoriteTeamId(sportId as SportId);
        if (cancelled) return;
        // CFB: any row (team or no-team) skips. NFL: real catalog team only.
        const done = isNfl
          ? isRealTeamId(existing)
          : !!existing;
        if (done) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sport from URL
  }, [router, sportId, isNfl, sportKnown]);

  async function confirm() {
    if (!choice || busy || !sportKnown) return;
    if (isNfl && choice.kind !== "team") {
      setError("Pick an NFL team you ride with.");
      return;
    }
    setBusy(true);
    setError(null);
    const teamId = choice.kind === "no-team" ? NO_TEAM_ID : choice.team.id;
    const res = await setMyFavoriteTeam(sportId as SportId, teamId);
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
  const canConfirm =
    choice !== null &&
    !busy &&
    (!isNfl || choice.kind === "team");

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
                : isNfl
                  ? "Your team is locked in. Super Bowl pick is a separate question."
                  : "Your objectivity is now officially questionable."}
            </p>
          </div>
        ) : (
          <>
            <div className="text-center mb-6 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">
                {isNfl ? "Your NFL team" : isCbb ? "Your college hoops team" : "Declare your allegiance"}
              </p>
              <h1 className="text-xl sm:text-2xl font-black text-foreground leading-tight">
                {isNfl ? "Who do you ride with?" : "Who do you ride with?"}
              </h1>
              <p className="text-sm text-muted leading-relaxed max-w-sm mx-auto">
                {isNfl
                  ? "Pick the NFL club you identify with. This is not your Super Bowl prediction — that comes next if pride pick is on."
                  : isCbb
                    ? "Pick the college basketball program you ride with. This is your allegiance — your Crystal Ball national champion pick is separate."
                    : "Every pick tells us what you think. This one tells us who you are. You have to answer — but \"no team\" is a real answer."}
              </p>
            </div>

            {!isNfl && (
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
            )}

            <TeamAllegiancePicker
              sportId={sportId as SportId}
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
                    : isNfl
                      ? "PICK YOUR TEAM"
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
