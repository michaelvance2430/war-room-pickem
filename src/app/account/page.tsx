"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Nav from "@/components/Nav";
import { getSession, getLeague } from "@/lib/league";
import {
  fetchMyMemberships,
  switchToLeague,
  signOutFully,
  LeagueMembership,
} from "@/lib/session-restore";

export default function AccountPage() {
  const router = useRouter();
  const [memberships, setMemberships] = useState<LeagueMembership[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const session = getSession();
      const league = getLeague();
      setName(session?.playerName || "");
      setActiveId(league?.id || session?.leagueId || null);
      const list = await fetchMyMemberships();
      setMemberships(list);
      setLoading(false);
    }
    load();
  }, []);

  async function onSwitch(leagueId: string) {
    setMessage(null);
    const ok = await switchToLeague(leagueId);
    if (!ok) {
      setMessage("Could not switch leagues");
      return;
    }
    setActiveId(leagueId);
    setMessage("Switched league");
    router.push("/");
    router.refresh();
  }

  async function onSignOut() {
    await signOutFully();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-8">
        <h1 className="text-2xl font-bold mb-1">Account</h1>
        <p className="text-sm text-muted mb-6">
          {name ? `Signed in as ${name}` : "Manage leagues and sign out"}
        </p>

        {message && (
          <div className="mb-4 text-sm text-primary border border-primary/40 rounded-lg px-3 py-2">
            {message}
          </div>
        )}

        <section className="rounded-xl border border-border bg-card p-5 mb-6">
          <h2 className="font-semibold mb-3">Your leagues</h2>
          {loading && <p className="text-sm text-muted">Loading…</p>}
          {!loading && memberships.length === 0 && (
            <p className="text-sm text-muted">No leagues yet.</p>
          )}
          <div className="space-y-2">
            {memberships.map((m) => {
              const active = m.leagueId === activeId;
              return (
                <div
                  key={m.leagueId}
                  className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-3 ${
                    active ? "border-primary bg-primary/10" : "border-border"
                  }`}
                >
                  <div>
                    <div className="font-medium text-sm">{m.leagueName}</div>
                    <div className="text-xs text-muted">
                      {m.code}
                      {m.role === "commissioner" ? " · Commissioner" : ""}
                      {active ? " · Active" : ""}
                    </div>
                  </div>
                  {!active && (
                    <button
                      onClick={() => onSwitch(m.leagueId)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-primary text-black font-medium"
                    >
                      Switch
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <Link
              href="/join"
              className="text-center text-sm py-2 rounded-lg border border-border hover:bg-card-hover"
            >
              Create or join another league
            </Link>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold mb-2">Account</h2>
          <p className="text-xs text-muted mb-3">
            Sign out on this device. You can log back in with the same email and
            your leagues will still be there.
          </p>
          <button
            onClick={onSignOut}
            className="w-full py-2.5 rounded-lg border border-danger text-danger text-sm hover:bg-danger/10"
          >
            Sign out / switch account
          </button>
        </section>
      </main>
    </div>
  );
}
