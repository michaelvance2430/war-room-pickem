import type { SuccessCondition } from "./types";

export function isSuccessConditionMet(
  condition: SuccessCondition,
  ctx: { pathname: string | null }
): boolean {
  switch (condition.type) {
    case "always":
      return true;
    case "manual":
      return false;
    case "pathname":
      return !!ctx.pathname?.includes(condition.includes);
    case "sessionFlag": {
      if (typeof window === "undefined") return false;
      try {
        const v = sessionStorage.getItem(condition.key);
        if (condition.value != null) return v === condition.value;
        return v === "1" || v === "true";
      } catch {
        return false;
      }
    }
    case "localFlag": {
      if (typeof window === "undefined") return false;
      try {
        return localStorage.getItem(condition.key) === "1";
      } catch {
        return false;
      }
    }
    case "event":
      // Event-driven success is handled by listeners in the host
      return false;
    default:
      return false;
  }
}

export function clearSessionFlag(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ok */
  }
}
