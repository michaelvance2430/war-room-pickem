"use client";

/**
 * League Build wizard — runs right after create (any sport).
 * Sets Crystal Ball, cut line, open room, bots. Editable until opening week.
 *
 * Polish: skip name/open if already set · hero Use recommended · invite finish.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  getLeague,
  getSession,
  isActuallyCommissioner,
  updateLeagueName,
  updateLeagueSettings,
} from "@/lib/league";
import {
  LEAGUE_BUILD_RECOMMENDED,
  isEyesLeagueBuildForced,
  isLeagueBuildLocked,
  markLeagueBuildComplete,
  needsLeagueBuild,
  openingWeekLockLabel,
  pridePickWizardCopy,
} from "@/lib/league-build";
import { saveLeagueToCloud } from "@/lib/league-sync";
import BrandMark from "@/components/BrandMark";

type Step =
  | "welcome"
  | "name"
  | "crystal"
  | "cut"
  | "open"
  | "bots"
  | "confirm";

function buildStepList(opts: {
  skipName: boolean;
  skipOpen: boolean;
  /** Entry screen with Use recommended hero */
  showWelcome: boolean;
}): Step[] {
  const steps: Step[] = [];
  if (opts.showWelcome) steps.push("welcome");
  if (!opts.skipName) steps.push("name");
  steps.push("crystal", "cut");
  if (!opts.skipOpen) steps.push("open");
  steps.push("bots", "confirm");
  return steps;
}

function LeagueBuildInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNew = searchParams.get("new") === "1";
  const isEyes = searchParams.get("eyes") === "1" || isEyesLeagueBuildForced();
  const isReview = searchParams.get("review") === "1";

  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<Step>("welcome");
  const [steps, setSteps] = useState<Step[]>([
    "welcome",
    "crystal",
    "cut",
    "bots",
    "confirm",
  ]);
  const [name, setName] = useState("War Room");
  const [crystalBall, setCrystalBall] = useState(true);
  const [cutPercent, setCutPercent] = useState(50);
  const [openRoom, setOpenRoom] = useState(false);
  const [fillBots, setFillBots] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sportId, setSportId] = useState<string>("cfb");
  const [locked, setLocked] = useState(false);
  /** Name/open already chosen on create — don't re-ask */
  const [skipName, setSkipName] = useState(false);
  const [skipOpen, setSkipOpen] = useState(false);

  useEffect(() => {
    const session = getSession();
    const league = getLeague();
    if (!session?.leagueId || !league) {
      router.replace("/join?mode=create");
      return;
    }
    if (!isActuallyCommissioner() && !isEyes) {
      router.replace("/");
      return;
    }
    const lock = isLeagueBuildLocked(league.sportId);
    setLocked(lock);
    setSportId(league.sportId || "cfb");

    const leagueName = (league.name || "").trim() || "War Room";
    setName(leagueName);
    setCrystalBall(league.settings?.crystalBallEnabled !== false);
    setCutPercent(league.settings?.cutPercent ?? 50);

    // Open room from create (?open=1) or local league flag
    let openPrefill = false;
    try {
      if (searchParams.get("open") === "1") openPrefill = true;
      else {
        const raw = localStorage.getItem("warroom-league");
        if (raw) {
          const j = JSON.parse(raw) as { isOpen?: boolean };
          if (j.isOpen) openPrefill = true;
        }
      }
    } catch {
      /* ignore */
    }
    setOpenRoom(openPrefill);

    // Skip re-asking when create already set these (not on full review)
    // Name: always set on create → skip on new / first build
    // Open: decided on create form → skip on new / first build
    const firstBuild = isNew || needsLeagueBuild(league.id) || isEyes;
    const doSkipName =
      !isReview && firstBuild && !!leagueName && leagueName.length > 0;
    const doSkipOpen = !isReview && firstBuild;
    setSkipName(doSkipName);
    setSkipOpen(doSkipOpen);

    const showWelcome = !isReview && !lock;
    const list = buildStepList({
      skipName: doSkipName,
      skipOpen: doSkipOpen,
      showWelcome,
    });
    setSteps(list);
    setStep(list[0] || "crystal");

    if (
      !isReview &&
      !isEyes &&
      !needsLeagueBuild(league.id) &&
      !isNew
    ) {
      if (lock) {
        router.replace("/commissioner");
        return;
      }
    }
    setReady(true);
  }, [router, isNew, isReview, isEyes, searchParams]);

  const pride = useMemo(() => pridePickWizardCopy(sportId), [sportId]);
  const stepIndex = Math.max(0, steps.indexOf(step));
  const lockLabel = openingWeekLockLabel(sportId);

  function applyRecommended() {
    setCrystalBall(LEAGUE_BUILD_RECOMMENDED.crystalBallEnabled);
    setCutPercent(LEAGUE_BUILD_RECOMMENDED.cutPercent);
    // Keep open room if create already listed; else recommended private
    if (!skipOpen) {
      setOpenRoom(LEAGUE_BUILD_RECOMMENDED.openRoom);
    }
    setFillBots(LEAGUE_BUILD_RECOMMENDED.fillBots);
    setStep("confirm");
  }

  function next() {
    const i = steps.indexOf(step);
    if (i >= 0 && i < steps.length - 1) setStep(steps[i + 1]);
  }

  function back() {
    const i = steps.indexOf(step);
    if (i > 0) setStep(steps[i - 1]);
  }

  async function finish() {
    const league = getLeague();
    if (!league?.id) {
      setError("No league loaded.");
      return;
    }
    if (locked && !isEyes) {
      setError("League rules locked — opening week has started.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      updateLeagueName(name.trim() || league.name);
      updateLeagueSettings({
        crystalBallEnabled: crystalBall,
        cutPercent,
      });

      if (!isEyes) {
        const save = await saveLeagueToCloud({
          name: name.trim() || league.name,
          settings: {
            crystalBallEnabled: crystalBall,
            cutPercent,
            gamesPerWeek: 5,
          },
        });
        if (!save.ok) {
          console.warn("[league-build] cloud save", save.error);
        }

        try {
          const { setLeagueOpenListing } = await import("@/lib/open-room");
          await setLeagueOpenListing(league.id, openRoom);
        } catch {
          /* open-rooms.sql may be missing */
        }

        if (fillBots) {
          try {
            const { simpleFillEmptySeatsWithBots } = await import(
              "@/lib/simple-host"
            );
            await simpleFillEmptySeatsWithBots({ targetTotal: 16 });
          } catch {
            /* optional */
          }
        }
      }

      markLeagueBuildComplete(league.id);
      // Room is set → Home owns the next commissioner job (build card, etc.)
      try {
        sessionStorage.setItem(
          "warroom-league-build-just-done",
          JSON.stringify({
            at: Date.now(),
            name: name.trim() || league.name,
          })
        );
      } catch {
        /* ignore */
      }
      router.replace("/");
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not save league build");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted text-sm">
        Loading league build…
      </div>
    );
  }

  const progressSteps = steps.filter((s) => s !== "welcome");
  const progressIndex =
    step === "welcome"
      ? -1
      : Math.max(0, progressSteps.indexOf(step as Exclude<Step, "welcome">));

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="max-w-md w-full rounded-2xl border-2 border-primary/40 bg-card p-5 sm:p-6 space-y-4">
        <div className="flex justify-center">
      <BrandMark size={64} variant="force" />
        </div>
      <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            {isEyes ? "Foundry · new commish eyes" : "League build"}
          </p>
      <h1 className="text-xl sm:text-2xl font-bold text-foreground mt-1">
            {isReview
              ? "Review your room"
              : step === "welcome"
                ? "Set up your league"
                : "Set up your league"}
          </h1>
          {step !== "welcome" && (
            <p className="text-sm text-muted mt-1.5 leading-relaxed">
              How this room works — not the first card. Change anytime until{" "}
              <strong className="text-foreground">{lockLabel}</strong>, then it
              locks.
            </p>
          )}
        </div>

        {step !== "welcome" && (
          <>
            <div className="flex gap-1.5">
              {progressSteps.map((s, i) => (
                <div
                  key={s}
                  className={`h-1.5 flex-1 rounded-full ${
                    i <= progressIndex ? "bg-primary" : "bg-border"
                  }`}
                />
              ))}
            </div>
      <p className="text-xs font-semibold text-muted text-center tabular-nums">
              Step {progressIndex + 1} of {progressSteps.length}
              {skipName || skipOpen ? (
                <span className="font-normal">
                  {" "}
                  · using what you already set
                </span>
              ) : null}
            </p>
          </>
        )}

        {locked && !isEyes && (
          <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning leading-relaxed">
            Opening week has started — rules are locked. You can still run the
            card and score, but these settings stay put.
          </div>
        )}

        {error && (
          <p className="text-sm text-danger text-center">{error}</p>
        )}

        {/* ── Welcome: hero Use recommended ───────────────────────── */}
        {step === "welcome" && (
          <div className="space-y-4">
      <p className="text-sm text-muted leading-relaxed text-center">
              Pick how <strong className="text-foreground">{name}</strong> works
              — pride pick, Toilet Bowl split, seats. Takes about a minute. You
              can change it until{" "}
              <strong className="text-foreground">{lockLabel}</strong>.
            </p>
            {(skipName || skipOpen) && (
              <p className="text-xs text-muted text-center leading-relaxed rounded-lg border border-border bg-background px-3 py-2">
                {skipName && (
                  <>
                    Name: <strong className="text-foreground">{name}</strong>
                  </>
                )}
                {skipName && skipOpen ? " · " : null}
                {skipOpen && (
                  <>
                    Listing:{" "}
                    <strong className="text-foreground">
                      {openRoom ? "Open lobby" : "Private (invite only)"}
                    </strong>
                  </>
                )}
              </p>
            )}
            <button
              type="button"
              disabled={locked && !isEyes}
              onClick={applyRecommended}
              className="w-full py-4 min-h-[56px] rounded-xl bg-primary text-black text-base font-extrabold touch-manipulation disabled:opacity-50"
            >
              Use recommended defaults →
            </button>
      <p className="text-xs text-muted text-center leading-relaxed">
              Pride pick on · 50% Toilet Bowl cut ·{" "}
              {skipOpen
                ? openRoom
                  ? "open lobby (your choice)"
                  : "private (your choice)"
                : "private"}{" "}
              · no bots
            </p>
      <button
              type="button"
              onClick={next}
              className="w-full py-3.5 min-h-[52px] rounded-xl border-2 border-primary/40 bg-primary/10 text-primary text-sm font-bold touch-manipulation"
            >
              Customize step by step
            </button>
      </div>
        )}

        {step === "name" && (
          <div className="space-y-3">
      <label className="block text-sm font-semibold text-foreground">
              League name
            </label>
      <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={locked && !isEyes}
              className="w-full bg-background border border-border rounded-xl px-3 py-3 text-base"
              maxLength={48}
              autoFocus
            />
            <p className="text-sm text-muted">
              What the group chat will call this room.
            </p>
      </div>
        )}

        {step === "crystal" && (
          <div className="space-y-3">
      <h2 className="text-base font-bold text-foreground">{pride.title}</h2>
      <p className="text-sm font-semibold text-foreground leading-snug">
              {pride.oneLiner}
            </p>
      <p className="text-sm text-muted leading-relaxed">{pride.body}</p>
      <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                disabled={locked && !isEyes}
                onClick={() => setCrystalBall(true)}
                className={`w-full py-3.5 min-h-[52px] rounded-xl border-2 text-left px-4 ${
                  crystalBall
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border bg-background text-muted"
                }`}
              >
                <span className="font-bold block">{pride.onLabel}</span>
      <span className="text-xs opacity-80">
                  Recommended — tab shows for everyone
                </span>
      </button>
              <button
                type="button"
                disabled={locked && !isEyes}
                onClick={() => setCrystalBall(false)}
                className={`w-full py-3.5 min-h-[52px] rounded-xl border-2 text-left px-4 ${
                  !crystalBall
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border bg-background text-muted"
                }`}
              >
                <span className="font-bold block">Off — hide the tab</span>
      <span className="text-xs opacity-80">
                  Just weekly picks for this room
                </span>
      </button>
            </div>
      </div>
        )}

        {step === "cut" && (
          <div className="space-y-3">
      <h2 className="text-base font-bold text-foreground">
              Toilet Bowl cut line
            </h2>
      <p className="text-sm font-semibold text-foreground leading-snug">
              Bottom half of the standings play for the Toilet Bowl trophy
              (still a trophy). 50% is normal.
            </p>
      <p className="text-sm text-muted leading-relaxed">
              Bottom{" "}
              <strong className="text-foreground">{cutPercent}%</strong> of the
              standings go to the Toilet Bowl bracket. Everyone else chases the
              championship.
            </p>
      <input
              type="range"
              min={25}
              max={60}
              step={5}
              value={cutPercent}
              disabled={locked && !isEyes}
              onChange={(e) => setCutPercent(parseInt(e.target.value, 10) || 50)}
              className="w-full accent-[var(--primary,#ef4444)]"
            />
            <div className="flex justify-between text-xs text-muted">
      <span>25%</span>
      <span className="font-bold text-foreground">{cutPercent}%</span>
      <span>60%</span>
      </div>
            <button
              type="button"
              onClick={() => setCutPercent(50)}
              className="text-sm font-semibold text-primary"
            >
              Reset to 50% (recommended)
            </button>
      </div>
        )}

        {step === "open" && (
          <div className="space-y-3">
      <h2 className="text-base font-bold text-foreground">
              Private or open room?
            </h2>
      <p className="text-sm text-muted leading-relaxed">
              Private = invite code only. Open = people using Join open room can
              land here until full.
            </p>
      <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                disabled={locked && !isEyes}
                onClick={() => setOpenRoom(false)}
                className={`w-full py-3.5 min-h-[52px] rounded-xl border-2 text-left px-4 ${
                  !openRoom
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border bg-background text-muted"
                }`}
              >
                <span className="font-bold block">Private (recommended)</span>
      <span className="text-xs opacity-80">
                  Your group only — share the code
                </span>
      </button>
              <button
                type="button"
                disabled={locked && !isEyes}
                onClick={() => setOpenRoom(true)}
                className={`w-full py-3.5 min-h-[52px] rounded-xl border-2 text-left px-4 ${
                  openRoom
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border bg-background text-muted"
                }`}
              >
                <span className="font-bold block">Open lobby</span>
      <span className="text-xs opacity-80">
                  Strangers can fill empty seats
                </span>
      </button>
            </div>
      </div>
        )}

        {step === "bots" && (
          <div className="space-y-3">
      <h2 className="text-base font-bold text-foreground">
              Fill empty seats with bots?
            </h2>
      <p className="text-sm font-semibold text-foreground leading-snug">
              Fake players for practice. Friends replace them. You can delete
              anytime before kickoff.
            </p>
      <p className="text-sm text-muted leading-relaxed">
              Optional so the room doesn&apos;t feel empty while you wait on the
              group chat. Real people always take priority.
            </p>
      <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                disabled={locked && !isEyes}
                onClick={() => setFillBots(false)}
                className={`w-full py-3.5 min-h-[52px] rounded-xl border-2 text-left px-4 ${
                  !fillBots
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border bg-background text-muted"
                }`}
              >
                <span className="font-bold block">No bots (recommended)</span>
      <span className="text-xs opacity-80">
                  Wait for real humans
                </span>
      </button>
              <button
                type="button"
                disabled={locked && !isEyes}
                onClick={() => setFillBots(true)}
                className={`w-full py-3.5 min-h-[52px] rounded-xl border-2 text-left px-4 ${
                  fillBots
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border bg-background text-muted"
                }`}
              >
                <span className="font-bold block">Yes — pad empty seats</span>
      <span className="text-xs opacity-80">
                  Toward ~16 seats for practice energy
                </span>
      </button>
            </div>
      </div>
        )}

        {step === "confirm" && (
          <div className="space-y-3">
      <h2 className="text-base font-bold text-foreground">
              Your room is set
            </h2>
      <ul className="rounded-xl border border-border bg-background px-4 py-3 text-sm space-y-2">
              <li>
      <span className="text-muted">Name · </span>
      <strong>{name.trim() || "War Room"}</strong>
      </li>
              <li>
      <span className="text-muted">
                  {sportId === "nfl" ? "Super Bowl pick" : "Crystal Ball"} ·{" "}
                </span>
      <strong>{crystalBall ? "On" : "Off"}</strong>
      </li>
              <li>
      <span className="text-muted">Toilet Bowl cut · </span>
      <strong>{cutPercent}%</strong>
      </li>
              <li>
      <span className="text-muted">Listing · </span>
      <strong>{openRoom ? "Open lobby" : "Private"}</strong>
      </li>
              <li>
      <span className="text-muted">Bots · </span>
      <strong>{fillBots ? "Pad empty seats" : "None"}</strong>
      </li>
            </ul>
      <p className="text-sm text-muted leading-relaxed">
              You can change this until{" "}
              <strong className="text-foreground">{lockLabel}</strong>. After save, one job: put a live card up so friends can pick.
            </p>
      </div>
        )}

        {/* Actions (welcome has its own CTAs) */}
        {step !== "welcome" && (
          <div className="flex flex-col gap-2 pt-1">
            {step !== "confirm" ? (
              <button
                type="button"
                onClick={next}
                className="w-full py-4 min-h-[56px] rounded-xl bg-primary text-black text-base font-extrabold touch-manipulation"
              >
                Continue →
              </button>
            ) : (
              <button
                type="button"
                disabled={busy || (locked && !isEyes)}
                onClick={() => void finish()}
                className="w-full py-4 min-h-[56px] rounded-xl bg-primary text-black text-base font-extrabold touch-manipulation disabled:opacity-50"
              >
                {busy ? "Saving room…" : "Save room · build first card →"}
              </button>
            )}

            <div className="flex gap-2">
              {stepIndex > 0 && (
                <button
                  type="button"
                  onClick={back}
                  className="flex-1 py-3 min-h-[48px] rounded-xl border border-border text-sm font-semibold text-muted"
                >
                  Back
                </button>
              )}
              {step !== "confirm" && !(locked && !isEyes) && (
                <button
                  type="button"
                  onClick={applyRecommended}
                  className="flex-1 py-3 min-h-[48px] rounded-xl border border-primary/40 text-sm font-bold text-primary"
                >
                  Use recommended
                </button>
              )}
            </div>
      </div>
        )}
      </div>
      </div>
  );
}

export default function LeagueBuildPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-muted text-sm">
          Loading…
        </div>
      }
    >
      <LeagueBuildInner />
      </Suspense>
  );
}
