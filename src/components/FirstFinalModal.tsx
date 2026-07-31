"use client";

import { weekTitle } from "@/lib/dates";

const RARE_HEX = "#3b82f6";

type Mode = "earned" | "forfeit";

export default function FirstFinalModal({
  mode,
  weekNumber,
  pointsRemoved,
  onClose,
}: {
  mode: Mode;
  weekNumber: number;
  /** Set on forfeit when career points were actually pulled */
  pointsRemoved?: number;
  onClose: () => void;
}) {
  const weekLabel = weekTitle(weekNumber);

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center bg-black/75 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-final-title"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow:
            mode === "earned"
              ? `0 0 40px ${RARE_HEX}33`
              : "0 0 40px rgba(239,68,68,0.2)",
        }}
      >
        {mode === "earned" ? (
          <>
            <div className="text-center mb-4">
              <div
                className="mx-auto w-20 h-20 rounded-full border-2 flex items-center justify-center text-4xl mb-3 bg-background"
                style={{
                  borderColor: RARE_HEX,
                  boxShadow: `0 0 20px ${RARE_HEX}66`,
                }}
              >
                🔒
              </div>
              <p
                className="text-[10px] font-bold uppercase tracking-widest mb-1"
                style={{ color: RARE_HEX }}
              >
                Rare achievement
              </p>
              <h2 id="first-final-title" className="text-xl font-bold">
                First &amp; Final
              </h2>
              <p className="text-sm text-muted mt-1">
                You locked <span className="text-foreground font-medium">{weekLabel}</span>{" "}
                before every other human in the league.
              </p>
              <p className="text-sm font-semibold mt-2" style={{ color: RARE_HEX }}>
                +25 season · +25 career
              </p>
            </div>

            <div className="rounded-xl border border-warning/50 bg-warning/10 px-4 py-3 mb-4">
              <p className="text-xs font-bold uppercase tracking-wide text-warning mb-1">
                ⚠ Don&apos;t touch the slip
              </p>
              <p className="text-sm text-foreground leading-relaxed">
                If you change <span className="font-semibold">anything</span> on
                this week&apos;s picks (side, confidence, Best Bet, or prop), you{" "}
                <span className="font-semibold">lose this achievement</span> —
                and the <span className="font-semibold">+25 points come off</span>{" "}
                your season and career totals.
              </p>
            </div>

            <p className="text-[11px] text-muted text-center mb-4">
              Same picks re-saved = fine. Any real change = void.
            </p>
          </>
        ) : (
          <>
            <div className="text-center mb-4">
              <div className="mx-auto w-20 h-20 rounded-full border-2 border-danger/60 flex items-center justify-center text-4xl mb-3 bg-background grayscale opacity-80">
                🔓
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-danger mb-1">
                Achievement voided
              </p>
              <h2 id="first-final-title" className="text-xl font-bold">
                First &amp; Final lost
              </h2>
              <p className="text-sm text-muted mt-1">
                You changed picks on{" "}
                <span className="text-foreground font-medium">{weekLabel}</span>{" "}
                after locking first.
              </p>
              {(pointsRemoved ?? 0) > 0 ? (
                <p className="text-sm font-semibold text-danger mt-2">
                  −{pointsRemoved} season · −{pointsRemoved} career
                </p>
              ) : (
                <p className="text-xs text-muted mt-2">
                  You still have another clean first-lock week, so the badge stays
                  — this week no longer counts.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 mb-4">
              <p className="text-sm text-foreground leading-relaxed">
                First &amp; Final only sticks if you lock first{" "}
                <span className="font-semibold">and never touch the card again</span>.
              </p>
            </div>
          </>
        )}

        <button
          type="button"
          onClick={onClose}
          className={`w-full py-2.5 rounded-lg text-sm font-semibold transition ${
            mode === "earned"
              ? "bg-primary text-black hover:opacity-90"
              : "border border-border hover:bg-card-hover"
          }`}
        >
          {mode === "earned" ? "Got it — hands off" : "Understood"}
        </button>
      </div>
    </div>
  );
}
