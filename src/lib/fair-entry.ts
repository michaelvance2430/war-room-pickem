/**
 * Fair Entry — mid-season join starting position.
 *
 * Goal (product):
 *  - Day-one players keep the advantage they earned.
 *  - Late joiners still have a meaningful climb.
 *
 * Bands freeze when the window's end week is scored (or on first need
 * if someone joins mid-window before the freeze trigger). Everyone who
 * joins in the same window gets the same stored value — no day-to-day drift.
 *
 * Never surface the raw points math to players.
 */

import { createClient } from "@/lib/supabase/client";
import { getSession } from "@/lib/league";

export type FairEntryBandId =
  | "1-2"
  | "3-4"
  | "5-6"
  | "7-8"
  | "9+"
  | "deployment";

export type FairEntryBandDef = {
  id: FairEntryBandId;
  /** Inclusive latest-scored-week range for join window */
  minScored: number;
  maxScored: number; // Infinity for 9+
  /** Percentile of human standings (0–100) */
  percentile: number;
  /** Freeze (or reaffirm) after this week is scored */
  freezeAfterWeek: number;
};

/** Fixed product table — do not invent alternate bands at call sites */
export const FAIR_ENTRY_BANDS: readonly FairEntryBandDef[] = [
  { id: "1-2", minScored: 1, maxScored: 2, percentile: 75, freezeAfterWeek: 2 },
  { id: "3-4", minScored: 3, maxScored: 4, percentile: 60, freezeAfterWeek: 4 },
  { id: "5-6", minScored: 5, maxScored: 6, percentile: 50, freezeAfterWeek: 6 },
  { id: "7-8", minScored: 7, maxScored: 8, percentile: 30, freezeAfterWeek: 8 },
  {
    id: "9+",
    minScored: 9,
    maxScored: Number.POSITIVE_INFINITY,
    percentile: 15,
    freezeAfterWeek: 9,
  },
] as const;

export const FAIR_ENTRY_COPY = {
  title: "Deployment Credit",
  body:
    "Your standings include conservative credit based on each completed week's bottom 15%. It is shown separately from points you earn and cannot create retroactive wins, streaks, records, or cheevos.",
} as const;

type FairEntryStore = {
  /** bandId → frozen points (integer) */
  frozen: Partial<Record<FairEntryBandId, number>>;
  /** bandId → ISO when frozen */
  frozenAt: Partial<Record<FairEntryBandId, string>>;
};

const LS_KEY = "warroom-fair-entry-v1";
const APPLIED_KEY = "warroom-fair-entry-applied-v1";

function canUse() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function storeKey(leagueId: string) {
  return `${LS_KEY}:${leagueId}`;
}

function appliedKey(leagueId: string, userId: string) {
  return `${APPLIED_KEY}:${leagueId}:${userId}`;
}

function readStore(leagueId: string): FairEntryStore {
  if (!canUse() || !leagueId) return { frozen: {}, frozenAt: {} };
  try {
    const raw = localStorage.getItem(storeKey(leagueId));
    if (!raw) return { frozen: {}, frozenAt: {} };
    const p = JSON.parse(raw) as FairEntryStore;
    return {
      frozen: p.frozen || {},
      frozenAt: p.frozenAt || {},
    };
  } catch {
    return { frozen: {}, frozenAt: {} };
  }
}

function writeStore(leagueId: string, store: FairEntryStore) {
  if (!canUse() || !leagueId) return;
  try {
    localStorage.setItem(storeKey(leagueId), JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

/** Nearest-rank percentile on sorted ascending values */
export function percentileValue(values: number[], percentile: number): number {
  if (!values.length) return 0;
  const s = [...values].map((v) => Number(v) || 0).sort((a, b) => a - b);
  if (s.length === 1) return Math.round(s[0]!);
  const p = Math.min(100, Math.max(0, percentile));
  const rank = (p / 100) * (s.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return Math.round(s[lo]!);
  const v = s[lo]! + (s[hi]! - s[lo]!) * (rank - lo);
  return Math.round(v);
}

export function bandForLatestScoredWeek(
  latestScoredWeek: number | null
): FairEntryBandDef | null {
  if (latestScoredWeek == null || !Number.isFinite(latestScoredWeek)) {
    return null;
  }
  if (latestScoredWeek < 1) return null;
  for (const b of FAIR_ENTRY_BANDS) {
    if (latestScoredWeek >= b.minScored && latestScoredWeek <= b.maxScored) {
      return b;
    }
  }
  return FAIR_ENTRY_BANDS[FAIR_ENTRY_BANDS.length - 1]!;
}

/** Humans only — bots never define Fair Entry freezes */
export async function loadHumanStandingsPoints(
  leagueId: string
): Promise<number[]> {
  if (!leagueId) return [];
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("memberships")
      .select("total_points, is_bot")
      .eq("league_id", leagueId);
    if (error || !data?.length) return [];
    return (data as { total_points?: number | null; is_bot?: boolean | null }[])
      .filter((r) => !r.is_bot)
      .map((r) => Number(r.total_points) || 0);
  } catch {
    return [];
  }
}

/**
 * Freeze a band if missing. Idempotent — never overwrite an existing freeze.
 */
export function freezeBandIfNeeded(
  leagueId: string,
  bandId: FairEntryBandId,
  points: number
): boolean {
  const store = readStore(leagueId);
  if (store.frozen[bandId] != null) return false;
  store.frozen[bandId] = Math.max(0, Math.round(points));
  store.frozenAt[bandId] = new Date().toISOString();
  writeStore(leagueId, store);
  // Best-effort cloud mirror (sport_settings.fair_entry)
  void persistFairEntryToCloud(leagueId, store);
  return true;
}

async function persistFairEntryToCloud(
  leagueId: string,
  store: FairEntryStore
): Promise<void> {
  try {
    const supabase = createClient();
    const { data: row } = await supabase
      .from("leagues")
      .select("sport_settings")
      .eq("id", leagueId)
      .maybeSingle();
    const prev =
      row && typeof row.sport_settings === "object" && row.sport_settings
        ? (row.sport_settings as Record<string, unknown>)
        : {};
    const next = {
      ...prev,
      fair_entry: {
        frozen: store.frozen,
        frozenAt: store.frozenAt,
      },
    };
    await supabase
      .from("leagues")
      .update({ sport_settings: next })
      .eq("id", leagueId);
  } catch {
    /* column missing or RLS — local freeze still holds for this device */
  }
}

/** Hydrate freezes from cloud into local (joiners on another device) */
export async function hydrateFairEntryFromCloud(
  leagueId: string
): Promise<void> {
  if (!leagueId) return;
  try {
    const supabase = createClient();
    const { data: row } = await supabase
      .from("leagues")
      .select("sport_settings")
      .eq("id", leagueId)
      .maybeSingle();
    const fe = (row?.sport_settings as { fair_entry?: FairEntryStore } | null)
      ?.fair_entry;
    if (!fe?.frozen) return;
    const local = readStore(leagueId);
    let changed = false;
    for (const id of Object.keys(fe.frozen) as FairEntryBandId[]) {
      if (local.frozen[id] == null && fe.frozen[id] != null) {
        local.frozen[id] = fe.frozen[id];
        local.frozenAt[id] = fe.frozenAt?.[id] || new Date().toISOString();
        changed = true;
      }
    }
    if (changed) writeStore(leagueId, local);
  } catch {
    /* ignore */
  }
}

/**
 * After an official week is scored: freeze any bands whose freezeAfterWeek
 * is this week (and still missing).
 */
export async function freezeFairEntryAfterScore(
  weekNumber: number,
  leagueId?: string | null
): Promise<void> {
  const session = getSession();
  const lid = leagueId || session?.leagueId;
  if (!lid || !Number.isFinite(weekNumber)) return;
  if (weekNumber < 1) return;

  const points = await loadHumanStandingsPoints(lid);
  if (!points.length) return;

  for (const band of FAIR_ENTRY_BANDS) {
    if (weekNumber < band.freezeAfterWeek) continue;
    // Only freeze when we've reached the freeze week (idempotent)
    if (weekNumber === band.freezeAfterWeek || weekNumber > band.freezeAfterWeek) {
      const store = readStore(lid);
      if (store.frozen[band.id] != null) continue;
      const val = percentileValue(points, band.percentile);
      freezeBandIfNeeded(lid, band.id, val);
    }
  }
}

export type FairEntryResolve = {
  /** Points to put on membership at join (0 = no mid-season entry) */
  points: number;
  band: FairEntryBandDef | null;
  /** True when Fair Entry applied a non-zero (or intentional mid-season) placement */
  midSeason: boolean;
  title: string;
  body: string;
};

/**
 * Resolve starting points for a new member joining now.
 * Hydrates cloud freezes first; freezes provisional band if needed.
 */
export async function resolveFairEntryForJoin(
  leagueId: string
): Promise<FairEntryResolve> {
  const empty: FairEntryResolve = {
    points: 0,
    band: null,
    midSeason: false,
    title: FAIR_ENTRY_COPY.title,
    body: FAIR_ENTRY_COPY.body,
  };
  if (!leagueId) return empty;

  await hydrateFairEntryFromCloud(leagueId);

  let scored: number[] = [];
  try {
    const { listScoredWeekNumbers } = await import("@/lib/cloud");
    scored = await listScoredWeekNumbers();
  } catch {
    scored = [];
  }
  const latest =
    scored.length > 0 ? Math.max(...scored.filter((w) => w >= 0)) : null;

  // No official score yet — day-one / preseason style entry
  if (latest == null || latest < 1) {
    return empty;
  }

  const band = bandForLatestScoredWeek(latest);
  if (!band) return empty;

  let store = readStore(leagueId);
  let pts = store.frozen[band.id];

  if (pts == null) {
    const humans = await loadHumanStandingsPoints(leagueId);
    if (!humans.length) return empty;
    pts = percentileValue(humans, band.percentile);
    freezeBandIfNeeded(leagueId, band.id, pts);
    store = readStore(leagueId);
    pts = store.frozen[band.id] ?? pts;
  }

  const points = Math.max(0, Math.round(pts || 0));
  return {
    points,
    band,
    midSeason: true,
    title: FAIR_ENTRY_COPY.title,
    body: FAIR_ENTRY_COPY.body,
  };
}

/** Mark that this user should see Fair Entry explanation once */
export function markFairEntryPendingNotice(
  leagueId: string,
  userId: string,
  payload: { points: number; bandId: FairEntryBandId }
) {
  if (!canUse() || !leagueId || !userId) return;
  try {
    localStorage.setItem(
      appliedKey(leagueId, userId),
      JSON.stringify({
        ...payload,
        at: new Date().toISOString(),
        noticeSeen: false,
      })
    );
  } catch {
    /* ignore */
  }
}

export function peekFairEntryNotice(
  leagueId: string,
  userId: string
): { title: string; body: string } | null {
  if (!canUse() || !leagueId || !userId) return null;
  try {
    const raw = localStorage.getItem(appliedKey(leagueId, userId));
    if (!raw) return null;
    const p = JSON.parse(raw) as { noticeSeen?: boolean; midSeason?: boolean };
    // Only show if we have a record and not dismissed
    if (p.noticeSeen) return null;
    // Stored means Fair Entry applied at join
    return { title: FAIR_ENTRY_COPY.title, body: FAIR_ENTRY_COPY.body };
  } catch {
    return null;
  }
}

export function dismissFairEntryNotice(leagueId: string, userId: string) {
  if (!canUse() || !leagueId || !userId) return;
  try {
    const raw = localStorage.getItem(appliedKey(leagueId, userId));
    if (!raw) return;
    const p = JSON.parse(raw) as Record<string, unknown>;
    p.noticeSeen = true;
    localStorage.setItem(appliedKey(leagueId, userId), JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

/**
 * Apply Fair Entry points to a just-inserted membership (or update if 0).
 *
 * D1B-B: Ordinary join RPCs set total_points server-side via d1b_b_fair_entry_points.
 * Do not call this from ordinary create/join-by-code/open-join after cutover.
 * Retained for sport-pool / legacy privileged seating until those paths migrate.
 */
export async function applyFairEntryToMembership(opts: {
  leagueId: string;
  userId: string;
}): Promise<FairEntryResolve> {
  const resolved = await resolveFairEntryForJoin(opts.leagueId);
  if (!resolved.midSeason || resolved.points <= 0) {
    return resolved;
  }

  try {
    const supabase = createClient();
    await supabase
      .from("memberships")
      .update({ total_points: resolved.points })
      .eq("league_id", opts.leagueId)
      .eq("user_id", opts.userId);
  } catch {
    /* join already inserted 0 — best effort */
  }

  if (resolved.band) {
    markFairEntryPendingNotice(opts.leagueId, opts.userId, {
      points: resolved.points,
      bandId: resolved.band.id,
    });
  }
  return resolved;
}
