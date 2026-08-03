/**
 * Shared Moments presenter ownership — one full-screen Moment at a time.
 *
 * Prevents Cold Open → Gazette handoff races: the next presenter waits until
 * activePresenter is null and body-lock owners are clear (or only its own).
 */

export type PresenterId = "season-cold-open" | "gazette-reader" | string;

let activePresenter: PresenterId | null = null;

export const EVENT_PRESENTER_IDLE = "warroom-presenter-idle";
export const EVENT_PRESENTER_CHANGE = "warroom-presenter-change";

function notifyIdle() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(EVENT_PRESENTER_IDLE));
    window.dispatchEvent(
      new CustomEvent(EVENT_PRESENTER_CHANGE, {
        detail: { active: activePresenter },
      })
    );
  } catch {
    /* ok */
  }
}

export function getActivePresenter(): PresenterId | null {
  return activePresenter;
}

/** True when no Moment claims the viewport. */
export function isPresenterIdle(): boolean {
  return activePresenter == null;
}

/**
 * Claim the Moments stage. Fails if another presenter is active.
 * Same id may re-claim (idempotent).
 */
export function claimPresenter(id: PresenterId): boolean {
  if (activePresenter && activePresenter !== id) {
    try {
      console.log(
        `[WR-PRESENTER] claim DENIED id=${id} owner=${activePresenter}`
      );
    } catch {
      /* ok */
    }
    return false;
  }
  activePresenter = id;
  try {
    console.log(`[WR-PRESENTER] claim OK id=${id}`);
  } catch {
    /* ok */
  }
  notifyIdle();
  return true;
}

export function releasePresenter(id: PresenterId): void {
  if (activePresenter !== id) return;
  activePresenter = null;
  try {
    console.log(`[WR-PRESENTER] release id=${id}`);
  } catch {
    /* ok */
  }
  notifyIdle();
}

/**
 * Wait until no presenter is active (or maxWait elapses).
 * Does not steal ownership — callers should only open after idle.
 */
export function whenPresenterIdle(maxWaitMs = 2500): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (activePresenter == null) return Promise.resolve();

  return new Promise((resolve) => {
    const start = Date.now();
    function finish() {
      window.removeEventListener(EVENT_PRESENTER_IDLE, onIdle);
      window.clearInterval(poll);
      resolve();
    }
    function onIdle() {
      if (activePresenter == null) finish();
    }
    const poll = window.setInterval(() => {
      if (activePresenter == null) finish();
      else if (Date.now() - start >= maxWaitMs) {
        try {
          console.log(
            `[WR-PRESENTER] whenPresenterIdle timeout owner=${activePresenter}`
          );
        } catch {
          /* ok */
        }
        finish();
      }
    }, 40);
    window.addEventListener(EVENT_PRESENTER_IDLE, onIdle);
  });
}

/**
 * Wait until idle, then claim. On timeout after wait, still claims if previous
 * owner looks stuck (last resort — prefer proper release by the prior Moment).
 */
export async function claimPresenterWhenIdle(
  id: PresenterId,
  maxWaitMs = 2500
): Promise<boolean> {
  await whenPresenterIdle(maxWaitMs);
  if (claimPresenter(id)) return true;
  // One more brief wait for race between release + claim
  await new Promise((r) => setTimeout(r, 80));
  if (claimPresenter(id)) return true;
  // Force: prior presenter failed to release — take stage so Moments is not stuck
  try {
    console.log(
      `[WR-PRESENTER] force claim id=${id} clearing stuck owner=${activePresenter}`
    );
  } catch {
    /* ok */
  }
  activePresenter = id;
  notifyIdle();
  return true;
}
