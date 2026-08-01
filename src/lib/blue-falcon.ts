/**
 * Blue Falcon Count — how many times a player quit a league before
 * finishing the season (not bracket knockout — walking out of the room).
 *
 * Named for the military slang: screwing over the rest of the unit.
 * Public on profile so the room can see who ghosted.
 */

const KEY = "warroom-blue-falcon-v1";

type Store = Record<string, number>;

function canUse() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readAll(): Store {
  if (!canUse()) return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as Store;
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

function writeAll(map: Store) {
  if (!canUse()) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function getBlueFalconCount(playerId: string | null | undefined): number {
  if (!playerId) return 0;
  const n = readAll()[playerId];
  return typeof n === "number" && n > 0 ? Math.floor(n) : 0;
}

/** Set absolute count (e.g. after cloud hydrate). */
export function setBlueFalconCountLocal(
  playerId: string,
  count: number
): void {
  if (!playerId) return;
  const map = readAll();
  const n = Math.max(0, Math.floor(count));
  if (n === 0) delete map[playerId];
  else map[playerId] = n;
  writeAll(map);
}

/**
 * +1 early leave. Returns new count.
 * Also best-effort cloud sync to profiles.blue_falcon_count.
 */
export async function incrementBlueFalconCount(
  playerId: string
): Promise<number> {
  if (!playerId) return 0;
  const next = getBlueFalconCount(playerId) + 1;
  setBlueFalconCountLocal(playerId, next);

  try {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ blue_falcon_count: next })
      .eq("id", playerId);
    if (error && /blue_falcon|column|schema cache/i.test(error.message || "")) {
      // SQL not applied yet — local still works
    }
  } catch {
    /* local only */
  }

  return next;
}

/** Pull cloud count into local (self or peer profile). */
export async function hydrateBlueFalconFromCloud(
  playerId: string
): Promise<number> {
  if (!playerId) return 0;
  try {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("blue_falcon_count")
      .eq("id", playerId)
      .maybeSingle();
    if (error || !data) return getBlueFalconCount(playerId);
    const cloud = Number(
      (data as { blue_falcon_count?: number | null }).blue_falcon_count
    );
    if (Number.isFinite(cloud) && cloud >= 0) {
      const local = getBlueFalconCount(playerId);
      // Keep the higher truth (offline increments may not have synced)
      const best = Math.max(local, Math.floor(cloud));
      setBlueFalconCountLocal(playerId, best);
      if (best > cloud) {
        try {
          await supabase
            .from("profiles")
            .update({ blue_falcon_count: best })
            .eq("id", playerId);
        } catch {
          /* ignore */
        }
      }
      return best;
    }
  } catch {
    /* ignore */
  }
  return getBlueFalconCount(playerId);
}

/** Short label for UI */
export function blueFalconLabel(count: number): string {
  if (count <= 0) return "Blue Falcon Count: 0";
  if (count === 1) return "Blue Falcon Count: 1";
  return `Blue Falcon Count: ${count}`;
}

export function blueFalconBlurb(count: number): string {
  if (count <= 0) {
    return "Clean record — never quit a room mid-season.";
  }
  if (count === 1) {
    return "Left 1 league before the season finished. The unit noticed.";
  }
  return `Left ${count} leagues before finishing. High risk of ghosting the room.`;
}
