"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";
import {
  MAX_LEAGUE_PLAYERS,
  isLeagueFull,
  leagueFullMessage,
} from "@/lib/league-limits";
import Link from "next/link";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default function JoinPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [leagueName, setLeagueName] = useState("War Room");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [hostCopied, setHostCopied] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (!hasSupabaseConfig()) {
        setError("Supabase is not configured.");
        setChecking(false);
        return;
      }
      const supabase = createClient();
      supabase.auth.getSession().then(({ data: sessionData }) => {
        const data = { user: sessionData.session?.user ?? null };
        if (!data.user) {
          router.replace("/login");
          return;
        }
        setUserId(data.user.id);
        const metaName = data.user.user_metadata?.display_name as string | undefined;
        setDisplayName(metaName || data.user.email?.split("@")[0] || "Player");
        setChecking(false);
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setChecking(false);
    }
  }, [router]);

  async function handleCreate() {
    if (!userId) return;
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const newCode = generateCode();
    try {
      await supabase.from("profiles").upsert({
        id: userId,
        display_name: displayName.trim() || "Commissioner",
      });
      const { data: league, error: leagueError } = await supabase
        .from("leagues")
        .insert({
          name: leagueName.trim() || "War Room",
          code: newCode,
          commissioner_id: userId,
        })
        .select()
        .single();
      if (leagueError) throw leagueError;
      const { error: memError } = await supabase.from("memberships").insert({
        league_id: league.id,
        user_id: userId,
        role: "commissioner",
        division: "North",
      });
      if (memError) throw memError;
      try {
        const { recordLeagueFirstJoin } = await import("@/lib/cloud");
        await recordLeagueFirstJoin(league.id);
      } catch {
        /* optional until join-order.sql is run */
      }
      localStorage.setItem(
        "warroom-session",
        JSON.stringify({
          playerId: userId,
          playerName: displayName.trim() || "Commissioner",
          isCommissioner: true,
          leagueId: league.id,
        })
      );
      localStorage.setItem(
        "warroom-league",
        JSON.stringify({
          id: league.id,
          name: league.name,
          code: league.code,
          commissionerId: userId,
          createdAt: league.created_at,
          settings: {
            cutPercent: league.cut_percent ?? 50,
            regularSeasonWeeks: 18, // fixed CFB calendar (app weeks 0–18)
            gamesPerWeek: league.games_per_week ?? 5,
            crystalBallEnabled: true,
            homeTaglineId: "good-teams",
            homeTaglineCustom: "",
            seasonThemeId: "default",
          },
        })
      );
      setCreatedCode(newCode);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create league");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!userId) return;
    setError(null);
    setLoading(true);
    const supabase = createClient();
    try {
      await supabase.from("profiles").upsert({
        id: userId,
        display_name: displayName.trim() || "Player",
      });
      const { data: league, error: findError } = await supabase
        .from("leagues")
        .select("*")
        .eq("code", code.trim().toUpperCase())
        .single();
      if (findError || !league) throw new Error("Invalid league code");

      // Already in league → re-enter only (do NOT overwrite division/role)
      const { data: existingMem } = await supabase
        .from("memberships")
        .select("id, role, division")
        .eq("league_id", league.id)
        .eq("user_id", userId)
        .maybeSingle();

      if (existingMem) {
        // Ensure first-join stamp exists (idempotent)
        try {
          const { recordLeagueFirstJoin } = await import("@/lib/cloud");
          await recordLeagueFirstJoin(league.id);
        } catch {
          /* optional */
        }
      }

      if (!existingMem) {
        const { count, error: countErr } = await supabase
          .from("memberships")
          .select("id", { count: "exact", head: true })
          .eq("league_id", league.id);
        if (countErr) throw countErr;
        if (isLeagueFull(count ?? 0)) {
          throw new Error(leagueFullMessage(count ?? MAX_LEAGUE_PLAYERS));
        }

        // Auto-balance: put new players in the least-populated division
        const { data: divRows } = await supabase
          .from("memberships")
          .select("division")
          .eq("league_id", league.id);
        const counts = { North: 0, South: 0, East: 0, West: 0 } as Record<
          string,
          number
        >;
        for (const r of divRows || []) {
          const d = (r as { division?: string }).division || "North";
          counts[d] = (counts[d] || 0) + 1;
        }
        let division: "North" | "South" | "East" | "West" = "North";
        let best = Infinity;
        for (const d of ["North", "South", "East", "West"] as const) {
          if ((counts[d] || 0) < best) {
            best = counts[d] || 0;
            division = d;
          }
        }

        const { error: memError } = await supabase.from("memberships").insert({
          league_id: league.id,
          user_id: userId,
          role: "player",
          division,
        });
        if (memError) {
          if (/full|max 32|check_violation/i.test(memError.message || "")) {
            throw new Error(leagueFullMessage());
          }
          throw memError;
        }
        // Permanent first-join stamp — leave/rejoin cannot reset title rank
        try {
          const { recordLeagueFirstJoin } = await import("@/lib/cloud");
          await recordLeagueFirstJoin(league.id);
        } catch {
          /* optional until join-order.sql is run */
        }
      }
      localStorage.setItem(
        "warroom-session",
        JSON.stringify({
          playerId: userId,
          playerName: displayName.trim() || "Player",
          isCommissioner: league.commissioner_id === userId,
          leagueId: league.id,
        })
      );
      // Full settings from cloud so season theme paints immediately for joiners
      const seasonThemeId =
        typeof league.season_theme_id === "string" && league.season_theme_id
          ? league.season_theme_id
          : "default";
      localStorage.setItem(
        "warroom-league",
        JSON.stringify({
          id: league.id,
          name: league.name,
          code: league.code,
          commissionerId: league.commissioner_id,
          createdAt: league.created_at,
          settings: {
            cutPercent: league.cut_percent ?? 50,
            regularSeasonWeeks: 18, // fixed CFB calendar (app weeks 0–18)
            gamesPerWeek: league.games_per_week ?? 5,
            crystalBallEnabled: league.crystal_ball_enabled !== false,
            homeTaglineId: league.home_tagline_id || "good-teams",
            homeTaglineCustom: league.home_tagline_custom || "",
            seasonThemeId,
          },
        })
      );
      try {
        const { applySeasonTheme } = await import("@/lib/season-theme");
        applySeasonTheme(seasonThemeId);
      } catch {
        /* ignore */
      }
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not join");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted">Loading…</div>
    );
  }

  if (createdCode) {
    const leagueLabel = leagueName.trim() || "War Room";
    const inviteText = [
      `You're in the War Room: ${leagueLabel}`,
      `Join code: ${createdCode}`,
      typeof window !== "undefined" ? `App: ${window.location.origin}` : null,
      "",
      "Make an account, enter the code, lock picks before first kickoff.",
      "Don't ghost Saturday.",
    ]
      .filter(Boolean)
      .join("\n");

    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10">
        <div className="max-w-md w-full rounded-xl border-2 border-primary/40 bg-card p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-2 text-center">
            You&apos;re the host
          </p>
          <h1 className="text-2xl font-bold mb-1 text-center">League created</h1>
          <p className="text-sm text-muted mb-4 text-center">
            {leagueLabel} — share the code, then build the first card.
          </p>
          <div className="text-3xl font-bold tracking-[0.3em] text-primary text-center mb-2 font-mono">
            {createdCode}
          </div>
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(createdCode);
                  setHostCopied("Code copied");
                } catch {
                  setHostCopied("Copy failed — select the code manually");
                }
              }}
              className="flex-1 py-2 rounded-lg border border-primary/40 text-primary text-sm font-semibold"
            >
              Copy code
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(inviteText);
                  setHostCopied("Invite text copied — paste in the group chat");
                  try {
                    const { markInviteCopied, markHostScreenSeen } = await import(
                      "@/lib/commish-onboarding"
                    );
                    const raw = localStorage.getItem("warroom-league");
                    const id = raw
                      ? (JSON.parse(raw) as { id?: string }).id
                      : null;
                    if (id) {
                      markInviteCopied(id);
                      markHostScreenSeen(id);
                    }
                  } catch {
                    /* ignore */
                  }
                } catch {
                  setHostCopied("Copy failed");
                }
              }}
              className="flex-1 py-2 rounded-lg bg-primary/15 border border-primary/40 text-primary text-sm font-semibold"
            >
              Copy invite text
            </button>
          </div>
          {hostCopied && (
            <p className="text-xs text-primary text-center mb-4">{hostCopied}</p>
          )}
          {!hostCopied && <div className="mb-3" />}

          <ol className="text-left text-sm space-y-2 mb-6 rounded-lg border border-border bg-background/50 px-4 py-3">
            <li>
              <span className="font-semibold text-primary">1.</span> Text the
              code to your friends
            </li>
            <li>
              <span className="font-semibold text-primary">2.</span> Build &amp;
              publish a card (demo slate is fine first time)
            </li>
            <li>
              <span className="font-semibold text-primary">3.</span> After games,
              score the week
            </li>
          </ol>

          <button
            type="button"
            onClick={() => {
              try {
                const raw = localStorage.getItem("warroom-league");
                const id = raw
                  ? (JSON.parse(raw) as { id?: string }).id
                  : null;
                if (id) {
                  void import("@/lib/commish-onboarding").then((m) =>
                    m.markHostScreenSeen(id)
                  );
                }
              } catch {
                /* ignore */
              }
              router.push("/commissioner?tab=card&first=1");
              router.refresh();
            }}
            className="w-full py-3 rounded-xl bg-primary text-black font-bold mb-2"
          >
            Go build the first card →
          </button>
          <button
            type="button"
            onClick={() => {
              router.push("/");
              router.refresh();
            }}
            className="w-full py-2.5 rounded-xl border border-border text-sm text-muted hover:text-foreground"
          >
            Enter the War Room
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-lg bg-primary text-black font-bold text-lg flex items-center justify-center mx-auto mb-3">
            WR
          </div>
          <h1 className="text-2xl font-bold">War Room Pick&apos;Em</h1>
          <p className="text-sm text-muted mt-1">Signed in as {displayName}</p>
        </div>

        {mode === "choose" && (
          <div className="space-y-3">
            <button onClick={() => setMode("create")} className="w-full py-3 rounded-xl bg-primary text-black font-semibold">
              Create league (you&apos;re commissioner)
            </button>
            <button onClick={() => setMode("join")} className="w-full py-3 rounded-xl border border-border bg-card font-semibold">
              Join with code
            </button>
            <p className="text-center text-[11px] text-muted pt-1">
              Leagues cap at {MAX_LEAGUE_PLAYERS} players so Championship + Toilet
              Bowl both finish in the CFP weeks.
            </p>
            <Link href="/login" className="block text-center text-xs text-muted mt-4">Switch account</Link>
          </div>
        )}

        {mode === "create" && (
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h2 className="font-semibold">Create league</h2>
            <p className="text-xs text-muted">
              Up to {MAX_LEAGUE_PLAYERS} players. Top half → Championship, bottom
              half → Toilet Bowl.
            </p>
            <input value={leagueName} onChange={(e) => setLeagueName(e.target.value)} placeholder="League name" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm" />
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm" />
            {error && <p className="text-sm text-danger">{error}</p>}
            <button onClick={handleCreate} disabled={loading} className="w-full py-3 rounded-xl bg-primary text-black font-semibold disabled:opacity-50">
              {loading ? "Creating…" : "Create & get code"}
            </button>
            <button onClick={() => setMode("choose")} className="w-full text-sm text-muted">Back</button>
          </div>
        )}

        {mode === "join" && (
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h2 className="font-semibold">Join league</h2>
            <p className="text-xs text-muted">
              If the league already has {MAX_LEAGUE_PLAYERS} players, you&apos;ll
              need another code or a free seat.
            </p>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CODE" maxLength={6} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm tracking-widest uppercase" />
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm" />
            {error && <p className="text-sm text-danger">{error}</p>}
            <button onClick={handleJoin} disabled={loading} className="w-full py-3 rounded-xl bg-primary text-black font-semibold disabled:opacity-50">
              {loading ? "Joining…" : "Join"}
            </button>
            <button onClick={() => setMode("choose")} className="w-full text-sm text-muted">Back</button>
          </div>
        )}
      </div>
    </div>
  );
}
