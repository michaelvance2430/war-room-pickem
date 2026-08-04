/**
 * League mode — single career-integrity axis.
 *
 * CONSTITUTION: Only production may permanently change a player's legacy.
 * Everything else is theater (rehearsal).
 *
 * Prefer explicit `league.mode`. Until DB column is universal, resolveMode()
 * derives from known signals so one rule stays true:
 *
 *   if (resolveLeagueMode() !== "production") → no permanent career write
 */

export type LeagueMode =
  | "production"
  | "sandbox"
  | "foundry"
  | "demo"
  | "guest";

export const LEAGUE_MODES: readonly LeagueMode[] = [
  "production",
  "sandbox",
  "foundry",
  "demo",
  "guest",
] as const;

export function isLeagueMode(v: unknown): v is LeagueMode {
  return (
    typeof v === "string" &&
    (LEAGUE_MODES as readonly string[]).includes(v)
  );
}

/**
 * Resolve effective mode for career / hardware writes.
 * Explicit league.mode wins. Otherwise derive (backfill) — never invent
 * a new exception list at each call site.
 */
export function resolveLeagueMode(league?: {
  id?: string;
  mode?: unknown;
  is_test?: unknown;
  settings?: {
    mode?: unknown;
    isTest?: unknown;
    is_test?: unknown;
  } | null;
} | null): LeagueMode {
  // Session theater (no league row, or overlay on any room)
  try {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem("warroom-guest-mode-v1");
      if (raw) {
        const g = JSON.parse(raw) as { active?: boolean };
        if (g?.active) return "guest";
      }
    }
  } catch {
    /* ignore */
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const eyes = require("./creator-eyes") as typeof import("./creator-eyes");
    if (eyes.isEyesLocalPlayActive()) return "foundry";
  } catch {
    /* ignore */
  }

  // Explicit on league object (future: leagues.mode column)
  if (isLeagueMode(league?.mode)) return league.mode;
  if (isLeagueMode(league?.settings?.mode)) return league.settings.mode;

  // Legacy boolean test flags
  if (
    league?.is_test === true ||
    league?.settings?.isTest === true ||
    league?.settings?.is_test === true
  ) {
    return "sandbox";
  }

  // Known guest demo league id
  if (league?.id === "guest-demo-league") return "guest";

  // Active league from storage when caller omitted league
  let active = league;
  if (!active) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getLeague } = require("./league") as typeof import("./league");
      active = getLeague();
      if (active && active !== league) {
        return resolveLeagueMode(active);
      }
    } catch {
      /* ignore */
    }
  }

  // Preseason dry-run calendar → sandbox until real season open
  // (explicit mode: "production" above already short-circuited)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { isSandboxMode } = require("./season-mode") as typeof import("./season-mode");
    if (isSandboxMode()) return "sandbox";
  } catch {
    /* ignore */
  }

  return "production";
}

/** The only mode that may engrave permanent history. */
export function isProductionMode(
  league?: Parameters<typeof resolveLeagueMode>[0]
): boolean {
  return resolveLeagueMode(league) === "production";
}

export function leagueModeLabel(mode: LeagueMode): string {
  switch (mode) {
    case "production":
      return "Production (reality)";
    case "sandbox":
      return "Sandbox (rehearsal)";
    case "foundry":
      return "Foundry (lab)";
    case "demo":
      return "Demo";
    case "guest":
      return "Guest tour";
    default:
      return mode;
  }
}
