"use client";

import { useEffect, useState } from "react";
import { loadBlockedPlayerIds, reportPlayer, setPlayerBlocked, type ReportCategory } from "@/lib/player-safety";

export default function PlayerSafetyControls({ playerId, playerName }: { playerId: string; playerName: string }) {
  const [blocked, setBlocked] = useState(false);
  const [category, setCategory] = useState<ReportCategory>("harassment");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => { void loadBlockedPlayerIds().then((ids) => setBlocked(ids.has(playerId))); }, [playerId]);

  async function toggleBlock() {
    const next = !blocked;
    if (next && !confirm(`Block ${playerName}? Their Locker posts will be hidden from you.`)) return;
    setBusy(true); setMessage(null);
    const result = await setPlayerBlocked(playerId, next);
    setBusy(false);
    if (!result.ok) return setMessage(result.error || "Could not update block.");
    setBlocked(next); setMessage(next ? `${playerName} is blocked.` : `${playerName} is unblocked.`);
  }

  async function submitReport() {
    if (!confirm(`Send this report about ${playerName} to league staff?`)) return;
    setBusy(true); setMessage(null);
    const result = await reportPlayer({ reportedId: playerId, category, details });
    setBusy(false);
    if (!result.ok) return setMessage(result.error || "Could not send report.");
    setDetails(""); setMessage("Report sent privately to league staff.");
  }

  return <details className="mb-6 rounded-xl border border-border bg-card p-4">
    <summary className="cursor-pointer text-xs font-bold text-muted">Safety · Report or block</summary>
    <div className="mt-4 space-y-3">
      <button type="button" disabled={busy} onClick={() => void toggleBlock()} className="min-h-11 w-full rounded-lg border border-border text-sm font-bold disabled:opacity-50">{blocked ? `Unblock ${playerName}` : `Block ${playerName}`}</button>
      <label className="block text-xs font-bold">Report reason<select value={category} onChange={(event) => setCategory(event.target.value as ReportCategory)} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3"><option value="harassment">Harassment</option><option value="hate">Hate or abuse</option><option value="threats">Threats</option><option value="spam">Spam</option><option value="other">Other</option></select></label>
      <label className="block text-xs font-bold">Details (optional)<textarea value={details} maxLength={500} onChange={(event) => setDetails(event.target.value)} className="mt-1 min-h-24 w-full rounded-lg border border-border bg-background p-3" /></label>
      <button type="button" disabled={busy} onClick={() => void submitReport()} className="min-h-11 w-full rounded-lg border border-danger/50 text-sm font-bold text-danger disabled:opacity-50">Report privately</button>
      {message && <p className="text-xs text-muted">{message}</p>}
    </div>
  </details>;
}
