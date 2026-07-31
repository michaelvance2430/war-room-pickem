/**
 * Equipped profile border (local + profiles.equipped_border_id).
 */

import { createClient } from "@/lib/supabase/client";
import { getSession } from "@/lib/league";
import {
  defaultProfileBorderId,
  getProfileBorderDef,
} from "./profile-borders";

const LOCAL_KEY = "warroom-equipped-border-v1";

type LocalMap = Record<string, string | null>;

type Store = {
  byUser: Map<string, string>;
};

const store: Store = { byUser: new Map() };
const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
}

function canUse() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readLocal(): LocalMap {
  if (!canUse()) return {};
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as LocalMap;
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

function writeLocal(map: LocalMap) {
  if (!canUse()) return;
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function subscribeProfileBorders(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getEquippedBorderId(
  userId: string | null | undefined
): string | null {
  if (!userId) return null;
  return store.byUser.get(userId) || null;
}

export function getLocalEquippedBorderId(userId: string): string | null {
  if (!userId) return null;
  return readLocal()[userId] || null;
}

function setStoreBorder(userId: string, borderId: string | null) {
  if (!userId) return;
  if (borderId) store.byUser.set(userId, borderId);
  else store.byUser.delete(userId);
  notify();
}

export function hydrateProfileBorders(
  rows: { userId: string; borderId?: string | null }[]
) {
  const session = getSession();
  const selfId = session?.playerId || "";

  for (const r of rows) {
    if (!r.userId) continue;
    if (selfId && r.userId === selfId) {
      const local = getLocalEquippedBorderId(selfId);
      const id = local || r.borderId || defaultProfileBorderId();
      if (getProfileBorderDef(id)) setStoreBorder(selfId, id);
      continue;
    }
    if (r.borderId && getProfileBorderDef(r.borderId)) {
      setStoreBorder(r.userId, r.borderId);
    }
  }
  notify();
}

export async function setMyEquippedBorder(
  borderId: string | null
): Promise<{ ok: boolean; error?: string }> {
  const session = getSession();
  const userId = session?.playerId;
  if (!userId) return { ok: false, error: "Not signed in" };

  const id = borderId || defaultProfileBorderId();
  if (!getProfileBorderDef(id)) {
    return { ok: false, error: "Unknown border" };
  }

  const local = readLocal();
  local[userId] = id;
  writeLocal(local);
  setStoreBorder(userId, id);

  try {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id || userId;
    await supabase
      .from("profiles")
      .update({ equipped_border_id: id })
      .eq("id", uid);
  } catch {
    /* local only */
  }

  return { ok: true };
}

export async function syncMyBorderFromCloud(): Promise<string | null> {
  const session = getSession();
  const userId = session?.playerId;
  if (!userId) return null;

  const local = getLocalEquippedBorderId(userId);
  if (local && getProfileBorderDef(local)) {
    setStoreBorder(userId, local);
    return local;
  }

  try {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id || userId;
    const { data, error } = await supabase
      .from("profiles")
      .select("equipped_border_id")
      .eq("id", uid)
      .maybeSingle();
    if (error || !data) {
      setStoreBorder(userId, defaultProfileBorderId());
      return defaultProfileBorderId();
    }
    const id =
      (data.equipped_border_id as string | null) || defaultProfileBorderId();
    if (getProfileBorderDef(id)) {
      const map = readLocal();
      map[userId] = id;
      writeLocal(map);
      setStoreBorder(userId, id);
      return id;
    }
  } catch {
    /* ignore */
  }
  setStoreBorder(userId, defaultProfileBorderId());
  return defaultProfileBorderId();
}
