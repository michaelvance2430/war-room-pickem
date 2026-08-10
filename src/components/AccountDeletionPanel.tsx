"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ACCOUNT_EXITS,
  PERMANENT_DELETION_WARNING,
} from "@/lib/account-lifecycle-contract";
import type { LeagueMembership } from "@/lib/session-restore";
import { signOutFully, switchToLeague } from "@/lib/session-restore";
import { createClient } from "@/lib/supabase/client";

const CONFIRMATION = "BURN THE DOSSIER";

type PreviewState = "eligible" | "commissioner" | "failed";

export default function AccountDeletionPanel({
  memberships = [],
  userId,
  previewState,
}: {
  memberships?: LeagueMembership[];
  userId?: string | null;
  previewState?: PreviewState;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!!previewState);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverOwnedRooms, setServerOwnedRooms] = useState(0);

  const ownedRooms = useMemo(
    () =>
      memberships.filter(
        (room) =>
          room.role === "commissioner" ||
          (!!userId && room.commissionerId === userId)
      ),
    [memberships, userId]
  );
  const isPreview = !!previewState;
  const blocked = previewState === "commissioner" || ownedRooms.length > 0 || serverOwnedRooms > 0;
  const failed = previewState === "failed";

  async function passKeys(room: LeagueMembership) {
    setBusy(true);
    setError(null);
    const switched = await switchToLeague(room.leagueId);
    setBusy(false);
    if (!switched) {
      setError("Could not open that room. Switch to it from Your Leagues first.");
      return;
    }
    router.push("/commissioner");
  }

  async function destroyAccount() {
    if (isPreview) return;
    if (confirmation !== CONFIRMATION || !password) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Log in again before deleting your account.");
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password, confirmation }),
      });
      const payload = (await response.json()) as {
        error?: string;
        blocked?: "commissioner";
        ownedRooms?: number;
      };
      if (response.status === 409 && payload.blocked === "commissioner") {
        setServerOwnedRooms(Math.max(1, Number(payload.ownedRooms) || 1));
        setPassword("");
        return;
      }
      if (!response.ok) throw new Error(payload.error || "Account deletion did not complete.");
      await signOutFully();
      router.replace("/login?account=deleted");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Account deletion did not complete.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <section className="rounded-xl border border-danger/35 bg-danger/5 p-5">
        <h2 className="font-semibold">Delete account</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Permanently remove your login and private identity. Competitive receipts remain anonymous.
        </p>
        <button type="button" onClick={() => setOpen(true)} className="mt-3 min-h-11 w-full rounded-lg border border-danger text-sm font-bold text-danger hover:bg-danger/10">
          Review permanent deletion
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-xl border-2 border-danger/50 bg-danger/5 p-5" aria-label="Permanent account deletion">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-danger">Danger zone · permanent</p>
      <h2 className="mt-1 text-lg font-black">{ACCOUNT_EXITS.deletion.action}</h2>
      <p className="mt-2 text-sm leading-relaxed text-foreground/90">{PERMANENT_DELETION_WARNING}</p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Receipt title="Destroyed" body="Login, sessions, avatar, private uploads, private messages, birthday, and account identity." />
        <Receipt title="Receipts remain" body="Picks, standings, trophies, brackets, awards, and league history under [REDACTED]." />
      </div>

      {blocked && (
        <div className="mt-4 rounded-xl border border-amber-400/45 bg-amber-400/10 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">Pass the Keys first</p>
          <h3 className="mt-1 font-black">A commissioner cannot disappear with the room.</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Transfer every room to another player, then return here. Nothing has been deleted.
          </p>
          <div className="mt-3 space-y-2">
            {ownedRooms.map((room) => (
              <button key={room.leagueId} type="button" disabled={busy || isPreview} onClick={() => void passKeys(room)} className="flex min-h-11 w-full items-center justify-between rounded-lg border border-amber-300/35 px-3 text-left text-xs font-bold disabled:opacity-60">
                <span className="truncate">{room.leagueName}</span><span>Pass the Keys →</span>
              </button>
            ))}
            {!ownedRooms.length && (
              <p className="rounded-lg border border-border bg-background p-3 text-xs text-muted">
                {isPreview ? "Foundry fixture · 2 blocking rooms" : `${serverOwnedRooms} blocking room${serverOwnedRooms === 1 ? "" : "s"}. Refresh Your Leagues to identify them.`}
              </p>
            )}
          </div>
        </div>
      )}

      {failed && (
        <div className="mt-4 rounded-xl border border-danger/40 bg-background p-4 text-xs">
          <p className="font-black text-danger">Operation needs repair</p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted">
            <dt>Operation</dt><dd className="font-mono text-foreground">foundry-fixture-7C</dd>
            <dt>Stopped at</dt><dd className="text-foreground">deleting_storage</dd>
            <dt>Identity</dt><dd className="text-foreground">fail-closed</dd>
          </dl>
          <p className="mt-2 leading-relaxed">No retry is hidden. Foundry records the failed stage for a server-side repair before the user is told deletion completed.</p>
        </div>
      )}

      {!blocked && !failed && (
        <div className="mt-4 space-y-3">
          <label className="block text-xs font-bold">
            Current password
            <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy || isPreview} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal" />
          </label>
          <label className="block text-xs font-bold">
            Type <span className="text-danger">{CONFIRMATION}</span>
            <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={busy || isPreview} autoCapitalize="characters" autoComplete="off" className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm font-black uppercase" />
          </label>
          <button type="button" disabled={busy || isPreview || !password || confirmation !== CONFIRMATION} onClick={() => void destroyAccount()} className="min-h-[52px] w-full rounded-xl bg-danger px-4 text-sm font-black text-white disabled:opacity-35">
            {busy ? "Destroying dossier…" : "Permanently delete my account"}
          </button>
          <p className="text-center text-[10px] font-bold text-danger">NO UNDO · NO HISTORY RECLAIM · NO SILENT RETRY</p>
        </div>
      )}

      {error && <p role="alert" className="mt-3 rounded-lg border border-danger/40 bg-danger/10 p-3 text-xs text-danger">{error}</p>}
      {!isPreview && <button type="button" disabled={busy} onClick={() => { setOpen(false); setError(null); setPassword(""); setConfirmation(""); }} className="mt-4 min-h-11 w-full rounded-lg border border-border text-xs font-bold">Keep my account</button>}
    </section>
  );
}

function Receipt({ title, body }: { title: string; body: string }) {
  return <div className="rounded-lg border border-border bg-background p-3"><strong className="block text-xs">{title}</strong><span className="mt-1 block text-[11px] leading-relaxed text-muted">{body}</span></div>;
}

