"use client";

/**
 * First-time Commish: Demo → Prop tip → Publish.
 * Shown when the active week has no published card yet.
 */

type Props = {
  weekLabel: string;
  hasDraftGames: boolean;
  hasProp: boolean;
  busy?: boolean;
  onDemo: () => void;
  onPublish: () => void;
  onDismiss?: () => void;
};

export default function FirstCardWizard({
  weekLabel,
  hasDraftGames,
  hasProp,
  busy,
  onDemo,
  onPublish,
  onDismiss,
}: Props) {
  const step = !hasDraftGames ? 1 : !hasProp ? 2 : 3;

  return (
    <section className="rounded-xl border-2 border-primary/50 bg-primary/10 p-4 sm:p-5 mb-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            First card wizard
          </p>
          <h2 className="text-lg font-bold text-foreground mt-0.5">
            Get {weekLabel} live in 3 steps
          </h2>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            First time? Use a <strong className="text-foreground">demo slate</strong>{" "}
            — zero odds credits, five fake games. You can pull real lines later.
          </p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-[11px] text-muted hover:text-foreground shrink-0"
          >
            Use full tools
          </button>
        )}
      </div>

      <ol className="space-y-2">
        <li
          className={`rounded-lg border px-3 py-2.5 ${
            step === 1
              ? "border-primary bg-background"
              : hasDraftGames
                ? "border-primary/30 bg-primary/10"
                : "border-border bg-background/50"
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">
                1. Load games {hasDraftGames ? "✓" : ""}
              </p>
              <p className="text-[11px] text-muted">
                Why: no games = friends have nothing to pick.
              </p>
            </div>
            {!hasDraftGames && (
              <button
                type="button"
                disabled={busy}
                onClick={onDemo}
                className="shrink-0 px-4 py-2 rounded-lg bg-primary text-black text-sm font-bold disabled:opacity-50"
              >
                Generate demo slate
              </button>
            )}
          </div>
        </li>

        <li
          className={`rounded-lg border px-3 py-2.5 ${
            step === 2
              ? "border-primary bg-background"
              : hasProp
                ? "border-primary/30 bg-primary/10"
                : "border-border bg-background/50"
          }`}
        >
          <p className="text-sm font-semibold">
            2. Weekly prop {hasProp ? "✓" : "(optional)"}
          </p>
          <p className="text-[11px] text-muted">
            Why: bonus points + locker room arguments. Use a preset below or
            skip — Publish works with a simple default.
          </p>
        </li>

        <li
          className={`rounded-lg border px-3 py-2.5 ${
            step === 3
              ? "border-primary bg-background"
              : "border-border bg-background/50"
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">3. Publish the card</p>
              <p className="text-[11px] text-muted">
                Why: until you publish, My Picks stays empty and they think the
                app is broken.
              </p>
            </div>
            <button
              type="button"
              disabled={busy || !hasDraftGames}
              onClick={onPublish}
              className="shrink-0 px-4 py-2 rounded-lg bg-primary text-black text-sm font-bold disabled:opacity-50"
            >
              {busy ? "Publishing…" : "Publish card"}
            </button>
          </div>
        </li>
      </ol>
    </section>
  );
}
