"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createLeague,
  joinLeague,
  getLeague,
  getSession,
} from "@/lib/league";

export default function JoinPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [leagueName, setLeagueName] = useState("War Room");
  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  useEffect(() => {
    const session = getSession();
    const league = getLeague();
    if (session && league) {
      router.replace("/");
    }
  }, [router]);

  function handleCreate() {
    setError(null);
    if (!displayName.trim()) {
      setError("Enter your name.");
      return;
    }
    const { league } = createLeague(leagueName, displayName);
    setCreatedCode(league.code);
  }

  function handleJoin() {
    setError(null);
    const result = joinLeague(code, displayName);
    if (!result.ok) {
      setError(result.error || "Could not join.");
      return;
    }
    router.push("/");
  }

  if (createdCode) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-xl border border-border bg-card p-6 text-center">
          <h1 className="text-2xl font-bold mb-2">League created</h1>
          <p className="text-sm text-muted mb-4">
            You&apos;re the commissioner. Share this code with friends:
          </p>
          <div className="text-3xl font-bold tracking-[0.3em] text-primary mb-6">
            {createdCode}
          </div>
          <button
            onClick={() => router.push("/")}
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
            Create a league or join with a code
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
                placeholder="Commissioner"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button
              onClick={handleCreate}
              className="w-full py-3 rounded-xl bg-primary text-black font-semibold"
            >
              Create & get code
            </button>
            <button
              onClick={() => setMode("choose")}
              className="w-full text-sm text-muted"
            >
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
                placeholder="Display name"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <p className="text-xs text-muted">
              Demo note: join works on the same device/browser that created the league (shared local data). Real multi-device needs a backend later.
            </p>
            <button
              onClick={handleJoin}
              className="w-full py-3 rounded-xl bg-primary text-black font-semibold"
            >
              Join
            </button>
            <button
              onClick={() => setMode("choose")}
              className="w-full text-sm text-muted"
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
