"use client";

/**
 * First-time Commish: live path only (Pull Odds → pick 5 → publish).
 * Demo/fake week tools live in Foundry for the shop — not here.
 */

type Props = {
  weekLabel: string;
  hasDraftGames: boolean;
  hasProp: boolean;
  busy?: boolean;
  /** True after a successful publish this session for the week */
  cardPublished?: boolean;
  /** Manual publish after draft selection */
  onPublish?: () => void;
  /** Jump past wizard to full Build Card tools */
  onDismiss?: () => void;
  /** Optional Foundry-only demo publish (hidden for real hosts) */
  showLabDemo?: boolean;
  onDemoPublish?: () => void;
  onDemo?: () => void;
};

export default function FirstCardWizard({
  weekLabel,
  hasDraftGames,
  hasProp,
  busy,
  cardPublished,
  onPublish,
  onDismiss,
  showLabDemo,
  onDemoPublish,
  onDemo,
}: Props) {
  return (
    <section className="rounded-xl border-2 border-primary/50 bg-primary/10 p-4 sm:p-5 mb-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            First card wizard
          </p>
          <h2 className="text-lg font-bold text-foreground mt-0.5">
            Get {weekLabel} live
          </h2>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            Three real steps:{" "}
            <strong className="text-foreground">Pull Odds</strong>
            {" → "}
            <strong className="text-foreground">pick 5 games</strong>
            {" → "}
            <strong className="text-foreground">Publish</strong>
            . Friends pick on My Picks. You score when the games die.
          </p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-[11px] text-muted hover:text-foreground shrink-0"
          >
            Open full tools
          </button>
        )}
      </div>

      <ol className="text-sm text-foreground/90 space-y-2 list-decimal list-inside leading-relaxed">
        <li>
          Tap <strong className="text-primary">Pull Odds</strong> for this week
        </li>
        <li>Select 5 games (and a prop if you want one)</li>
        <li>
          Hit <strong className="text-primary">Publish</strong> so the room can
          lock picks
        </li>
      </ol>

      {onPublish && (
        <button
          type="button"
          disabled={busy || cardPublished || !hasDraftGames}
          onClick={onPublish}
          className="w-full py-3.5 rounded-xl bg-primary text-black text-base font-bold disabled:opacity-50 min-h-[48px]"
        >
          {busy
            ? "Publishing…"
            : cardPublished
              ? `${weekLabel} live ✓`
              : hasDraftGames
                ? hasProp
                  ? `Publish ${weekLabel} card`
                  : `Publish ${weekLabel} (default prop)`
                : "Pull Odds & pick 5 first"}
        </button>
      )}
      <p className="text-[11px] text-muted text-center leading-relaxed">
        After kickoffs, open <strong className="text-foreground">Enter Results</strong>{" "}
        → Sync final scores → Save &amp; Score.
      </p>

      {showLabDemo && (onDemoPublish || onDemo) && (
        <details className="rounded-lg border border-warning/40 bg-warning/5 px-3 py-2">
          <summary className="text-[11px] font-semibold text-warning cursor-pointer select-none">
            Foundry lab · fake week tools
          </summary>
          <div className="mt-2 space-y-2">
            {onDemoPublish && (
              <button
                type="button"
                disabled={busy || cardPublished}
                onClick={onDemoPublish}
                className="w-full px-3 py-2 rounded-lg bg-warning text-black text-sm font-bold disabled:opacity-50"
              >
                {busy ? "Publishing demo…" : "Publish demo week"}
              </button>
            )}
            {onDemo && (
              <button
                type="button"
                disabled={busy || hasDraftGames}
                onClick={onDemo}
                className="w-full px-3 py-2 rounded-lg border border-warning text-warning text-sm font-medium disabled:opacity-50"
              >
                {hasDraftGames ? "Games loaded ✓" : "Generate demo slate only"}
              </button>
            )}
          </div>
        </details>
      )}
    </section>
  );
}
