/**
 * League mode — single career-integrity axis.
 *
 * CONSTITUTION: Only production may permanently change a player's legacy.
 * Everything else is theater (rehearsal).
 *
 * Guest mode was removed from the product. Foundry is the only lab.
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
  | "demo";

export const LEAGUE_MODES: readonly LeagueMode[] = [
  "production",
  "sandbox",
  "foundry",
  "demo",
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
  // Stale guest residue: treat as non-production until purged at boot
  try {
    if (typeof window !== "undefined") {
      const sessRaw = localStorage.getItem("warroom-session");
      if (sessRaw) {
        const sess = JSON.parse(sessRaw) as {
          playerId?: string;
          leagueId?: string;
        };
        if (
          sess?.leagueId === "guest-demo-league" ||
          sess?.playerId === "guest-you" ||
          (typeof sess?.leagueId === "string" &&
            sess.leagueId.startsWith("guest-"))
        ) {
          return "demo";
        }
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
  // Map retired "guest" string from any stale storage → demo
  const rawMode = league?.mode ?? league?.settings?.mode;
  if (rawMode === "guest") return "demo";
  if (isLeagueMode(rawMode)) return rawMode;

  // Legacy boolean test flags
  if (
    league?.is_test === true ||
    league?.settings?.isTest === true ||
    league?.settings?.is_test === true
  ) {
    return "sandbox";
  }

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
    default:
      return mode;
  }
}
