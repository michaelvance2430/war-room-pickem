"use client";

/**
 * First-time Commish: one-tap demo week, or full tools.
 * Shown when the active week has no published card yet.
 */

type Props = {
  weekLabel: string;
  hasDraftGames: boolean;
  hasProp: boolean;
  busy?: boolean;
  /** True after a successful publish this session for the week */
  cardPublished?: boolean;
  /** One tap: demo slate + prop + publish + bots */
  onDemoPublish: () => void;
  /** Load fake games only (power path) */
  onDemo?: () => void;
  /** Manual publish after draft selection */
  onPublish?: () => void;
  onDismiss?: () => void;
};

export default function FirstCardWizard({
  weekLabel,
  hasDraftGames,
  hasProp,
  busy,
  cardPublished,
  onDemoPublish,
  onDemo,
  onPublish,
  onDismiss,
}: Props) {
  return (
    <section className="rounded-xl border-2 border-primary/50 bg-primary/10 p-4 sm:p-5 mb-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            First card wizard
          </p>
          <h2 className="text-lg font-bold text-foreground mt-0.5">
            Get {weekLabel} live in one tap
          </h2>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            First time?{" "}
            <strong className="text-foreground">Publish demo week</strong>{" "}
            drops 5 fake games, a prop, and bot picks — zero odds credits. Real
            lines later when you want them.
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

      <button
        type="button"
        disabled={busy || cardPublished}
        onClick={onDemoPublish}
        className="w-full py-3.5 rounded-xl bg-primary text-black text-base font-bold disabled:opacity-50 min-h-[48px]"
      >
        {busy
          ? "Publishing demo…"
          : cardPublished
            ? `${weekLabel} live ✓`
            : "Publish demo week"}
      </button>
      <p className="text-[11px] text-muted text-center leading-relaxed">
        Then open <strong className="text-foreground">Enter Results</strong> →{" "}
        <strong className="text-foreground">Randomize &amp; score</strong>{" "}
        (also one tap).
      </p>

      {(onDemo || onPublish) && (
        <details className="rounded-lg border border-border bg-background/60 px-3 py-2">
          <summary className="text-[11px] font-semibold text-muted cursor-pointer select-none">
            Prefer manual steps?
          </summary>
          <div className="mt-2 space-y-2">
            {onDemo && (
              <button
                type="button"
                disabled={busy || hasDraftGames}
                onClick={onDemo}
                className="w-full px-3 py-2 rounded-lg border border-border text-sm font-medium disabled:opacity-50"
              >
                {hasDraftGames ? "Games loaded ✓" : "1. Generate demo slate only"}
              </button>
            )}
            {onPublish && (
              <button
                type="button"
                disabled={busy || !hasDraftGames}
                onClick={onPublish}
                className="w-full px-3 py-2 rounded-lg border border-primary/40 text-sm font-semibold disabled:opacity-50"
              >
                {hasProp ? "2. Publish card" : "2. Publish card (default prop)"}
              </button>
            )}
          </div>
        </details>
      )}
    </section>
  );
}
