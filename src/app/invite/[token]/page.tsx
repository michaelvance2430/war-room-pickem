"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";

const APP_STORE_URL = "https://apps.apple.com/app/id6802751064";

type InvitePreview = {
  ok: boolean;
  status: "available" | "full" | "invalid" | "expired" | "unavailable";
  league_name?: string;
  sport_id?: string;
  commissioner_name?: string;
  member_count?: number;
  max_members?: number;
  code?: string;
};

export default function LeagueInviteLandingPage() {
  const params = useParams<{ token: string }>();
  const token = useMemo(() => String(params?.token || "").toLowerCase(), [params]);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      if (!hasSupabaseConfig() || !/^[a-f0-9]{64}$/.test(token)) {
        if (!cancelled) setPreview({ ok: false, status: "invalid" });
        if (!cancelled) setLoading(false);
        return;
      }
      const { data, error } = await createClient().rpc("preview_league_invite", { p_token: token });
      if (!cancelled) {
        setPreview(error ? { ok: false, status: "unavailable" } : (data as InvitePreview));
        setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [token]);

  async function copyCode() {
    if (!preview?.code) return;
    await navigator.clipboard.writeText(preview.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  const failure = preview?.status === "expired"
    ? "This invitation has expired. Ask the commissioner for a new link."
    : preview?.status === "unavailable"
      ? "This room is not available right now."
      : "This invitation is not valid. Ask the commissioner for a new link.";

  return (
    <main className="min-h-screen bg-black px-5 py-12 text-white">
      <section className="mx-auto max-w-md overflow-hidden rounded-3xl border border-emerald-500/50 bg-zinc-950 shadow-2xl shadow-emerald-950/50">
        <div className="border-b border-emerald-500/30 bg-[radial-gradient(circle_at_top,#123c26,transparent_68%)] px-6 py-8 text-center">
          <p className="text-xs font-black tracking-[0.28em] text-emerald-400">WAR ROOM // INCOMING</p>
          <h1 className="mt-3 text-4xl font-black uppercase leading-none">You’ve been called in</h1>
        </div>

        <div className="space-y-5 p-6">
          {loading ? (
            <p className="py-12 text-center font-bold text-zinc-400">Opening your invitation…</p>
          ) : preview?.ok ? (
            <>
              <div>
                <p className="text-xs font-black tracking-[0.22em] text-emerald-400">{preview.sport_id?.toUpperCase() || "FOOTBALL"} LEAGUE</p>
                <h2 className="mt-2 text-3xl font-black">{preview.league_name}</h2>
                <p className="mt-2 text-sm font-bold text-zinc-400">Commissioner {preview.commissioner_name || "Commissioner"}</p>
              </div>
              <div className="rounded-2xl border border-zinc-700 bg-black p-4">
                <p className={`font-black ${preview.status === "full" ? "text-red-400" : "text-emerald-400"}`}>
                  {preview.member_count} / {preview.max_members} in the room
                </p>
                {preview.status === "full" && <p className="mt-1 text-sm text-zinc-400">This room is full. Ask the commissioner to open a seat.</p>}
              </div>
              <a className="block rounded-2xl bg-yellow-400 px-5 py-4 text-center text-lg font-black text-black" href={APP_STORE_URL}>
                DOWNLOAD WAR ROOM
              </a>
              {preview.code && (
                <button onClick={copyCode} className="w-full rounded-2xl border border-emerald-500/50 px-5 py-4 text-left">
                  <span className="block text-[10px] font-black tracking-[0.2em] text-zinc-500">FALLBACK INVITE CODE</span>
                  <span className="mt-1 flex items-center justify-between text-2xl font-black tracking-[0.18em] text-yellow-300">
                    {preview.code}<span className="text-xs tracking-normal text-emerald-400">{copied ? "COPIED" : "COPY"}</span>
                  </span>
                </button>
              )}
              <p className="text-center text-xs leading-5 text-zinc-500">After installing, return to the message and tap the invitation again.</p>
            </>
          ) : (
            <p className="py-10 text-center text-lg font-bold text-zinc-300">{failure}</p>
          )}
        </div>
      </section>
    </main>
  );
}
