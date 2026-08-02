/**
 * App open / tab-switch safety — kill stuck body locks, race hanging promises.
 * Phone testing is blocked until open is boring and reliable.
 */

/** Clear overflow/position traps left by modals, menus, sheets. */
export function unlockDocumentChrome() {
  if (typeof document === "undefined") return;
  try {
    document.body.style.overflow = "";
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    document.body.style.height = "";
    document.body.style.touchAction = "";
    document.documentElement.style.overflow = "";
    document.documentElement.style.touchAction = "";
    document.body.classList.remove(
      "overflow-hidden",
      "modal-open",
      "ReactModal__Body--open"
    );
  } catch {
    /* ignore */
  }
}

/** Race a promise so cold boot never spins forever on flaky mobile. */
export function raceTimeout<T>(
  p: Promise<T>,
  ms: number,
  fallback: T
): Promise<T> {
  return new Promise((resolve) => {
    let done = false;
    const t = setTimeout(() => {
      if (done) return;
      done = true;
      resolve(fallback);
    }, ms);
    p.then(
      (v) => {
        if (done) return;
        done = true;
        clearTimeout(t);
        resolve(v);
      },
      () => {
        if (done) return;
        done = true;
        clearTimeout(t);
        resolve(fallback);
      }
    );
  });
}

/**
 * Page-level "never spin forever" arm. Call on mount; clear on unmount or when
 * load finishes. Default 5s is enough for look-around; cloud can fill in later.
 */
export function armLoadingFailSafe(
  setLoading: (v: boolean) => void,
  ms = 5_000
): () => void {
  if (typeof window === "undefined") return () => {};
  const t = window.setTimeout(() => {
    try {
      setLoading(false);
    } catch {
      /* ok */
    }
  }, ms);
  return () => window.clearTimeout(t);
}
