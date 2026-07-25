"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
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

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setUserId(data.user.id);
      const metaName = data.user.user_metadata?.display_name as string | undefined;
      setDisplayName(metaName || data.user.email?.split("@")[0] || "Player");
      setChecking(false);
    });
  }, [router]);

  async function handleCreate() {
    if (!userId) return;
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const newCode = generateCode();

    try {
      // Ensure profile exists
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
            cutPercent: league.cut_percent,
            regularSeasonWeeks: league.regular_season_weeks,
            gamesPerWeek: league.games_per_week,
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

      if (findError || !league) {
        throw new Error("Invalid league code");
      }

      const { error: memError } = await supabase.from("memberships").upsert(
        {
          league_id: league.id,
          user_id: userId,
          role: "player",
          division: "North",
        },
        { onConflict: "league_id,user_id" }
      );
      if (memError) throw memError;

      localStorage.setItem(
        "warroom-session",
        JSON.stringify({
          playerId: userId,
          playerName: displayName.trim() || "Player",
          isCommissioner: league.commissioner_id === userId,
          leagueId: league.id,
        })
      );
      localStorage.setItem(
        "warroom-league",
        JSON.stringify({
          id: league.id,
          name: league.name,
          code: league.code,
          commissionerId: league.commissioner_id,
          createdAt: league.created_at,
          settings: {
            cutPercent: league.cut_percent,
            regularSeasonWeeks: league.regular_season_weeks,
            gamesPerWeek: league.games_per_week,
          },
        })
      );

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
      <div className="min-h-screen flex items-center justify-center text-muted">
        Loading…
      </div>
    );
  }

  if (createdCode) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-xl border border-border bg-card p-6 text-center">
          <h1 className="text-2xl font-bold mb-2">League created</h1>
          <p className="text-sm text-muted mb-4">
            Share this code with your friend:
          </p>
          <div className="text-3xl font-bold tracking-[0.3em] text-primary mb-6">
            {createdCode}
          </div>
          <button
            onClick={() => {
              router.push("/");
              router.refresh();
            }}
            className="w-full py-3 rounded-xl bg-primary text-black font-semibold"
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
          <p className="text-sm text-muted mt-1">
            Signed in as {displayName}
          </p>
        </div>

        {mode === "choose" && (
          <div className="space-y-3">
            <button
              onClick={() => setMode("create")}
              className="w-full py-3 rounded-xl bg-primary text-black font-semibold"
            >
              Create league (you&apos;re commissioner)
            </button>
            <button
              onClick={() => setMode("join")}
              className="w-full py-3 rounded-xl border border-border bg-card font-semibold hover:bg-card-hover"
            >
              Join with code
            </button>
            <Link href="/login" className="block text-center text-xs text-muted mt-4">
              Switch account
            </Link>
          </div>
        )}

        {mode === "create" && (
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h2 className="font-semibold">Create league</h2>
            <div>
              <label className="text-xs text-muted block mb-1">League name</label>
              <input
                value={leagueName}
                onChange={(e) => setLeagueName(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Your name</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-primary text-black font-semibold disabled:opacity-50"
            >
              {loading ? "Creating…" : "Create & get code"}
            </button>
            <button onClick={() => setMode("choose")} className="w-full text-sm text-muted">
              Back
            </button>
          </div>
        )}

        {mode === "join" && (
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h2 className="font-semibold">Join league</h2>
            <div>
              <label className="text-xs text-muted block mb-1">League code</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={6}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm tracking-widest uppercase focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Your name</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button
              onClick={handleJoin}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-primary text-black font-semibold disabled:opacity-50"
            >
              {loading ? "Joining…" : "Join"}
            </button>
            <button onClick={() => setMode("choose")} className="w-full text-sm text-muted">
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
