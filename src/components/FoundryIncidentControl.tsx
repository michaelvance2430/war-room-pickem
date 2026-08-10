"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_INCIDENT_MESSAGE, loadPlatformIncident, setPlatformIncident, type PlatformIncident } from "@/lib/platform-status";
import { createClient } from "@/lib/supabase/client";

export default function FoundryIncidentControl() {
  const [incident, setIncident] = useState<PlatformIncident | null>(null);
  const [message, setMessage] = useState(DEFAULT_INCIDENT_MESSAGE);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const current = await loadPlatformIncident();
    setIncident(current);
    setMessage(current.message || DEFAULT_INCIDENT_MESSAGE);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function update(active: boolean) {
    setBusy(true);
    setNote(null);
    const { data } = await createClient().auth.getSession();
    const result = await setPlatformIncident({ active, message, userId: data.session?.user.id || null });
    setBusy(false);
    setNote(result.error ? `Saved locally only: ${result.error}` : active ? "Incident banner is live." : "Incident banner cleared.");
    await load();
  }

  return <section className="rounded-xl border border-border bg-card p-4">
    <div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-bold">Emergency banner</h2><p className="mt-1 text-xs text-muted">Publish one clear platform message when something breaks.</p></div><span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase ${incident?.active ? "border-amber-400/50 text-amber-300" : "border-emerald-400/40 text-emerald-300"}`}>{incident?.active ? "Live" : "Off"}</span></div>
    <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={3} className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" aria-label="Emergency banner message" />
    <div className="mt-2 grid grid-cols-2 gap-2"><button type="button" disabled={busy} onClick={() => void update(true)} className="min-h-11 rounded-lg border border-amber-400/50 bg-amber-400/10 text-xs font-bold text-amber-200 disabled:opacity-50">Turn banner on</button><button type="button" disabled={busy} onClick={() => void update(false)} className="min-h-11 rounded-lg border border-border text-xs font-bold disabled:opacity-50">Clear banner</button></div>
    {note && <p className="mt-2 text-[11px] text-muted">{note}</p>}
  </section>;
}
