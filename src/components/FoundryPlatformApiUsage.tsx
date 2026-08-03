"use client";

/**
 * Foundry Hub — Platform API Usage (creator-only ops dashboard).
 * Data from GET /api/founder/odds-usage with Bearer auth.
 */

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Summary = {
  credits_remaining: number | null;
  credits_used: number | null;
  last_request_cost: number | null;
  total_requests: number;
  pull_odds_requests: number;
  score_sync_requests: number;
  failed_requests: number;
  last_success_at: string | null;
  last_failure_at: string | null;
  usage_today_est: number;
  usage_week_est: number;
  usage_month_est: number;
  estimated_credits_window: number;
};

type LeagueRow = {
  league_id: string | null;
  league_name: string;
  sport: string | null;
  pull_odds: number;
  score_sync: number;
  failed: number;
  estimated_credits: number;
  last_api_use: string | null;
};

type Payload = {
  ok: boolean;
  migrationRequired?: boolean;
  error?: string;
  trackingSince: string | null;
  timezone?: string;
  summary: Summary | null;
  byDay: { date: string; requests: number; estimated: number; failed: number }[];
  byAction: { action: string; requests: number; failed: number; estimated: number }[];
  bySport: { sport: string; requests: number; failed: number; estimated: number }[];
  leagues: LeagueRow[];
  recentFailures: {
    created_at: string;
    league_name: string;
    action: string;
    sport: string | null;
    error_code: string | null;
    http_status: number | null;
  }[];
};

function fmtWhen(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function Card({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5 min-w-0">
      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted truncate">
        {label}
      </p>
      <p className="text-lg font-black text-foreground tabular-nums leading-tight mt-0.5">
        {value}
      </p>
      {hint && (
        <p className="text-[10px] text-muted mt-0.5 leading-snug">{hint}</p>
      )}
    </div>
  );
}

export default function FoundryPlatformApiUsage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const { data: auth } = await createClient().auth.getSession();
      const token = auth.session?.access_token;
      if (!token) {
        setError("Sign in required");
        setData(null);
        return;
      }
      const res = await fetch("/api/founder/odds-usage", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as Payload & { error?: string };
      if (!res.ok) {
        setError(json.error || `HTTP ${res.status}`);
        setData(null);
        return;
      }
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const s = data?.summary;
  const trackingLabel = data?.trackingSince
    ? fmtWhen(data.trackingSince)
    : "— (no rows yet)";

  // Last 7 / 30 day spark as simple bars from byDay
  const byDay = data?.byDay || [];
  const last7 = byDay.slice(-7);
  const last30 = byDay.slice(-30);
  const max7 = Math.max(1, ...last7.map((d) => d.requests));
  const max30 = Math.max(1, ...last30.map((d) => d.requests));

  return (
    <section
      id="platform-api-usage"
      className="rounded-2xl border-2 border-violet-400/40 bg-violet-500/5 p-4 space-y-3 scroll-mt-24"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-300">
            Platform operations
          </p>
          <h2 className="text-base font-bold text-foreground mt-0.5">
            Platform API Usage
          </h2>
          <p className="text-[11px] text-muted mt-1 leading-relaxed">
            Odds provider account + War Room call log. Creator only.{" "}
            <strong className="text-foreground">
              Tracking since {trackingLabel}
            </strong>
            . No invented history before that date.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={busy}
          className="shrink-0 text-xs font-semibold px-3 py-2 rounded-lg border border-border bg-card hover:bg-card-hover min-h-[40px] disabled:opacity-50"
        >
          {busy ? "…" : "Refresh"}
        </button>
      </div>

      {error && (
        <p className="text-xs text-danger border border-danger/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {data?.migrationRequired && (
        <p className="text-xs text-warning border border-warning/40 rounded-lg px-3 py-2 leading-relaxed">
          Migration required: run{" "}
          <code className="text-[10px]">supabase/platform-odds-api-usage.sql</code>{" "}
          in Supabase SQL Editor. Logging is live in code; rows appear after the
          table exists.
        </p>
      )}

      {s && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Card
              label="Credits remaining"
              value={s.credits_remaining ?? "—"}
              hint="Provider account (latest call)"
            />
            <Card
              label="Credits used"
              value={s.credits_used ?? "—"}
              hint="Provider period total"
            />
            <Card
              label="Last request cost"
              value={s.last_request_cost ?? "—"}
              hint="Provider x-requests-last"
            />
            <Card label="Total requests" value={s.total_requests} hint="Logged window" />
            <Card label="Pull Odds" value={s.pull_odds_requests} />
            <Card label="Score sync" value={s.score_sync_requests} />
            <Card label="Failed" value={s.failed_requests} />
            <Card
              label="Usage today (est)"
              value={s.usage_today_est}
              hint={data.timezone || "America/New_York"}
            />
            <Card label="Usage 7d (est)" value={s.usage_week_est} />
            <Card label="Usage 30d (est)" value={s.usage_month_est} />
            <Card
              label="Last success"
              value={fmtWhen(s.last_success_at)}
            />
            <Card
              label="Last failure"
              value={fmtWhen(s.last_failure_at)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted mb-2">
                7-day request trend
              </p>
              <div className="flex items-end gap-1 h-16">
                {last7.length === 0 && (
                  <p className="text-xs text-muted">No data yet</p>
                )}
                {last7.map((d) => (
                  <div
                    key={d.date}
                    className="flex-1 flex flex-col items-center justify-end h-full"
                    title={`${d.date}: ${d.requests} req`}
                  >
                    <div
                      className="w-full rounded-t bg-violet-400/80 min-h-[2px]"
                      style={{
                        height: `${Math.max(4, (d.requests / max7) * 100)}%`,
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted mb-2">
                30-day request trend
              </p>
              <div className="flex items-end gap-0.5 h-16">
                {last30.length === 0 && (
                  <p className="text-xs text-muted">No data yet</p>
                )}
                {last30.map((d) => (
                  <div
                    key={d.date}
                    className="flex-1 flex flex-col items-center justify-end h-full"
                    title={`${d.date}: ${d.requests} req`}
                  >
                    <div
                      className="w-full rounded-t bg-violet-300/70 min-h-[2px]"
                      style={{
                        height: `${Math.max(3, (d.requests / max30) * 100)}%`,
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted mb-2">
                By action
              </p>
              <ul className="space-y-1 text-xs">
                {(data.byAction || []).map((a) => (
                  <li key={a.action} className="flex justify-between gap-2">
                    <span className="font-semibold text-foreground">
                      {a.action}
                    </span>
                    <span className="text-muted tabular-nums">
                      {a.requests} · est {a.estimated} · fail {a.failed}
                    </span>
                  </li>
                ))}
                {!data.byAction?.length && (
                  <li className="text-muted">No data yet</li>
                )}
              </ul>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted mb-2">
                By sport
              </p>
              <ul className="space-y-1 text-xs">
                {(data.bySport || []).map((a) => (
                  <li key={a.sport} className="flex justify-between gap-2">
                    <span className="font-semibold text-foreground uppercase">
                      {a.sport}
                    </span>
                    <span className="text-muted tabular-nums">
                      {a.requests} · est {a.estimated} · fail {a.failed}
                    </span>
                  </li>
                ))}
                {!data.bySport?.length && (
                  <li className="text-muted">No data yet</li>
                )}
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-3 overflow-x-auto">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted mb-2">
              Top leagues (est. credits)
            </p>
            <table className="w-full text-[11px] text-left min-w-[520px]">
              <thead>
                <tr className="text-muted border-b border-border">
                  <th className="py-1 pr-2 font-semibold">League</th>
                  <th className="py-1 pr-2 font-semibold">Sport</th>
                  <th className="py-1 pr-2 font-semibold tabular-nums">Odds</th>
                  <th className="py-1 pr-2 font-semibold tabular-nums">Sync</th>
                  <th className="py-1 pr-2 font-semibold tabular-nums">Fail</th>
                  <th className="py-1 pr-2 font-semibold tabular-nums">Est</th>
                  <th className="py-1 font-semibold">Last use</th>
                </tr>
              </thead>
              <tbody>
                {(data.leagues || []).slice(0, 25).map((lg) => (
                  <tr
                    key={lg.league_id || lg.league_name}
                    className="border-b border-border/50 text-foreground"
                  >
                    <td className="py-1.5 pr-2 font-medium max-w-[9rem] truncate">
                      {lg.league_name}
                      {lg.league_id && (
                        <span className="block text-[9px] text-muted font-mono truncate">
                          {lg.league_id}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 pr-2 uppercase text-muted">
                      {lg.sport || "—"}
                    </td>
                    <td className="py-1.5 pr-2 tabular-nums">{lg.pull_odds}</td>
                    <td className="py-1.5 pr-2 tabular-nums">{lg.score_sync}</td>
                    <td className="py-1.5 pr-2 tabular-nums">{lg.failed}</td>
                    <td className="py-1.5 pr-2 tabular-nums font-semibold">
                      {lg.estimated_credits}
                    </td>
                    <td className="py-1.5 text-muted whitespace-nowrap">
                      {fmtWhen(lg.last_api_use)}
                    </td>
                  </tr>
                ))}
                {!data.leagues?.length && (
                  <tr>
                    <td colSpan={7} className="py-2 text-muted">
                      No attributed calls yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted mb-2">
              Recent failures
            </p>
            <ul className="space-y-1.5 text-[11px]">
              {(data.recentFailures || []).map((f, i) => (
                <li
                  key={`${f.created_at}-${i}`}
                  className="flex flex-wrap gap-x-2 gap-y-0.5 border-b border-border/40 pb-1"
                >
                  <span className="text-muted">{fmtWhen(f.created_at)}</span>
                  <span className="font-semibold">{f.league_name}</span>
                  <span className="text-muted">{f.action}</span>
                  <span className="text-danger">
                    {f.error_code || "error"}
                    {f.http_status != null ? ` · ${f.http_status}` : ""}
                  </span>
                </li>
              ))}
              {!data.recentFailures?.length && (
                <li className="text-muted">No failures logged</li>
              )}
            </ul>
          </div>
        </>
      )}

      {!s && !error && !data?.migrationRequired && (
        <p className="text-xs text-muted">
          {busy ? "Loading…" : "No summary yet — pull odds once after migration."}
        </p>
      )}
    </section>
  );
}
