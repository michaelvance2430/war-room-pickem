"use client";

/**
 * Creator-only Test Mode — flight simulator for features + progressive UI.
 * No fake leagues, bots seed, or cleanup. Local knobs + jump buttons.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/league";
import { isAppCreator } from "@/lib/creator";
import {
  clearCreatorSandbox,
  derivePhase,
  EVENT_CREATOR_SANDBOX,
  jumpCardPublished,
  jumpGazetteShelfReveal,
  jumpOpenGazette,
  jumpOpenHome,
  jumpOpenLocker,
  jumpOpenPicks,
  jumpRingCeremony,
  loadCreatorSandbox,
  phaseLabel,
  saveCreatorSandbox,
  type CreatorSandboxState,
  type SandboxPhase,
} from "@/lib/creator-sandbox";
import { weekTitle } from "@/lib/dates";

export default function FounderTestModePage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [state, setState] = useState<CreatorSandboxState>(() =>
    typeof window !== "undefined" ? loadCreatorSandbox() : loadCreatorSandbox()
  );
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setState(loadCreatorSandbox());
  }, []);

  useEffect(() => {
    const uid = getSession()?.playerId || null;
    if (!isAppCreator(uid)) {
      setAllowed(false);
      return;
    }
    setAllowed(true);
    refresh();
    function onSb() {
      refresh();
    }
    window.addEventListener(EVENT_CREATOR_SANDBOX, onSb);
    return () => window.removeEventListener(EVENT_CREATOR_SANDBOX, onSb);
  }, [refresh]);

  function patch(p: Partial<CreatorSandboxState>) {
    const next = saveCreatorSandbox(p);
    setState(next);
    setNote("Saved · progressive UI will use these knobs while Test mode is ON");
  }

  if (allowed === null) {
    return (
      <div className="min-h-screen flex flex-col">
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-10">
          <p className="text-sm text-muted">Checking access…</p>
      </main>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen flex flex-col">
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-10 space-y-3">
          <h1 className="text-xl font-bold">Test Mode</h1>
      <p className="text-sm text-muted">
            Creator only — not for commissioners or players.
          </p>
      <Link href="/" className="text-sm text-primary underline">
            ← Home
          </Link>
      </main>
      </div>
    );
  }

  const phase = derivePhase(state);
  const phaseText = phaseLabel(phase);

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 max-w-lg mx-auto w-full px-3 sm:px-4 py-6 sm:py-8 space-y-5">
        <div>
      <Link
            href="/founder"
            className="text-xs text-primary font-semibold hover:underline"
          >
            ← Founder Dashboard
          </Link>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400 mt-3">
            Creator only
          </p>
      <h1 className="text-xl font-bold mt-0.5">Test Mode</h1>
      <p className="text-xs text-muted mt-1 leading-relaxed">
            Flight simulator. Fake week + progressive phase. Jump buttons fire
            real UI without bots, scoring, or deleting leagues. Turns off when
            you disable the switch.
          </p>
      </div>

        {state.enabled && (
          <div className="rounded-xl border-2 border-amber-500/50 bg-amber-500/10 px-4 py-3 text-xs text-amber-100 leading-relaxed">
      <strong className="text-amber-50">TEST MODE ON</strong> — Home,
            nav, and progressive chrome follow the knobs below (this browser
            only). Friends never see this.
          </div>
        )}

        {/* Master switch + knobs */}
        <section className="rounded-xl border border-border bg-card p-4 space-y-4">
      <label className="flex items-center justify-between gap-3 cursor-pointer">
            <span className="text-sm font-semibold text-foreground">
              Test mode active
            </span>
      <input
              type="checkbox"
              className="h-5 w-5 rounded border-border"
              checked={state.enabled}
              onChange={(e) => patch({ enabled: e.target.checked })}
            />
          </label>
      <label className="block text-xs text-muted">
            Sport flavor (labels only for now)
            <select
              value={state.sportId}
              onChange={(e) =>
                patch({ sportId: e.target.value === "nfl" ? "nfl" : "cfb" })
              }
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="cfb">CFB</option>
      <option value="nfl">NFL</option>
      </select>
          </label>
      <label className="block text-xs text-muted">
            Fake active week
            <input
              type="number"
              min={0}
              max={22}
              value={state.weekNumber}
              onChange={(e) =>
                patch({ weekNumber: parseInt(e.target.value, 10) || 0 })
              }
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
            <span className="block mt-1 text-[11px] text-muted">
              {weekTitle(state.weekNumber, state.sportId)}
            </span>
      </label>

          <label className="block text-xs text-muted">
            Fake scored weeks (how far season has gone)
            <input
              type="number"
              min={0}
              max={22}
              value={state.scoredCount}
              onChange={(e) =>
                patch({ scoredCount: Math.max(0, parseInt(e.target.value, 10) || 0) })
              }
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
      <label className="block text-xs text-muted">
            Progressive phase
            <select
              value={state.phase}
              onChange={(e) =>
                patch({ phase: e.target.value as SandboxPhase })
              }
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="auto">Auto from week / scored</option>
      <option value="onboarding">Onboarding (minimal)</option>
      <option value="core">Core (after first lock)</option>
      <option value="deepening">Deepening (~week 3 shelf)</option>
      <option value="full">Full room</option>
      </select>
          </label>
      <div className="rounded-lg border border-border/60 bg-background/60 px-3 py-2.5 text-xs leading-relaxed">
            <p className="font-bold text-foreground">Now showing</p>
      <p className="text-muted mt-1">{phaseText}</p>
      <ul className="mt-2 space-y-0.5 text-muted">
              <li>
                Gazette nav:{" "}
                <span className="text-foreground">
                  {phase === "deepening" || phase === "full" ? "ON" : "OFF"}
                </span>
      </li>
              <li>
                Deep tiles (trophies / brackets):{" "}
                <span className="text-foreground">
                  {phase === "onboarding" ? "OFF" : "ON"}
                </span>
      </li>
              <li>
                First-week quiet Home:{" "}
                <span className="text-foreground">
                  {phase === "onboarding" ? "ON" : "OFF"}
                </span>
      </li>
            </ul>
      </div>

          <button
            type="button"
            onClick={() => {
              clearCreatorSandbox();
              refresh();
              setNote("Test mode cleared — real league progress again");
            }}
            className="w-full py-2.5 rounded-lg border border-border text-xs font-semibold text-muted hover:text-foreground"
          >
            Clear test mode completely
          </button>
      </section>

        {/* Jump buttons */}
        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <h2 className="text-sm font-semibold">Jump · show me</h2>
      <p className="text-[11px] text-muted leading-relaxed">
            Fires real modals / routes. Stay on a page that mounts Nav (most of
            the app) so overlays can open.
          </p>
      <div className="grid grid-cols-1 gap-2">
            <JumpBtn
              label="Ring ceremony"
              detail="Opening hardware splash"
              onClick={() => {
                void jumpRingCeremony().then(() => {
                  setNote("Ring ceremony preview fired — check overlay");
                  jumpOpenHome();
                });
              }}
            />
            <JumpBtn
              label="Card published"
              detail="Commish just posted the slate"
              onClick={() => {
                void jumpCardPublished().then(() => {
                  setNote("Card published modal fired");
                  // Stay here a beat then home so Nav mounts modal
                  window.setTimeout(() => jumpOpenHome(), 100);
                });
              }}
            />
            <JumpBtn
              label="Gazette shelf unlock (week 3 popup)"
              detail="Progressive reveal explainer"
              onClick={() => {
                jumpGazetteShelfReveal();
                setNote("Gazette shelf popup forced");
                window.setTimeout(() => jumpOpenHome(), 100);
              }}
            />
            <JumpBtn
              label="Open Home (with knobs)"
              detail="See progressive chrome"
              onClick={() => {
                if (!state.enabled) {
                  patch({ enabled: true });
                }
                jumpOpenHome();
              }}
            />
            <JumpBtn
              label="Open Picks"
              detail="My Picks route"
              onClick={() => jumpOpenPicks()}
            />
            <JumpBtn
              label="Open Locker"
              detail="Shit talk room"
              onClick={() => jumpOpenLocker()}
            />
            <JumpBtn
              label="Open Gazette page"
              detail="Paper shelf route"
              onClick={() => jumpOpenGazette()}
            />
          </div>
      </section>

        {/* Coming next */}
        <section className="rounded-xl border border-dashed border-border bg-card/50 p-4 space-y-2">
      <h2 className="text-sm font-semibold text-muted">Coming next</h2>
      <ul className="text-xs text-muted space-y-1.5 list-disc pl-4 leading-relaxed">
            <li>Fake full roster of bots (no Supabase seed)</li>
      <li>Fake Locker thread that looks busy</li>
      <li>Fake Board / standings snapshot</li>
      <li>More jumps: season open, finale, badge unlock, Chaos</li>
      </ul>
        </section>

        {note && (
          <p className="text-xs text-primary leading-relaxed sticky bottom-20 md:bottom-4 bg-background/90 border border-primary/30 rounded-lg px-3 py-2">
            {note}
          </p>
        )}

        <button
          type="button"
          onClick={() => router.push("/founder")}
          className="w-full py-2 text-xs text-muted"
        >
          Back to Founder Dashboard
        </button>
      </main>
    </div>
  );
}

function JumpBtn({
  label,
  detail,
  onClick,
}: {
  label: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-xl border border-border bg-background hover:border-primary/40 hover:bg-primary/5 px-3 py-3 min-h-[52px] transition"
    >
      <span className="block text-sm font-semibold text-foreground">{label}</span>
      <span className="block text-[11px] text-muted mt-0.5">{detail}</span>
      </button>
  );
}
