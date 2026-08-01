/**
 * Shared platform flags (incident banner, etc.).
 * Source of truth: Supabase platform_status row id=1.
 * Local fallback only if table missing / offline — founder smoke test still works.
 */

import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";

const LOCAL_KEY = "warroom-platform-incident-v1";

export const DEFAULT_INCIDENT_MESSAGE =
  "We're aware of today's issue. The team is working on it. Thank you for your patience.";

export type PlatformIncident = {
  active: boolean;
  message: string;
  /** cloud | local — so founder knows if friends will see it */
  source: "cloud" | "local";
  updatedAt?: string | null;
};

function readLocal(): PlatformIncident {
  if (typeof window === "undefined") {
    return { active: false, message: DEFAULT_INCIDENT_MESSAGE, source: "local" };
  }
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) {
      return {
        active: false,
        message: DEFAULT_INCIDENT_MESSAGE,
        source: "local",
      };
    }
    const j = JSON.parse(raw) as { active?: boolean; message?: string };
    return {
      active: !!j.active,
      message: (j.message || DEFAULT_INCIDENT_MESSAGE).trim() || DEFAULT_INCIDENT_MESSAGE,
      source: "local",
    };
  } catch {
    return {
      active: false,
      message: DEFAULT_INCIDENT_MESSAGE,
      source: "local",
    };
  }
}

function writeLocal(active: boolean, message: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      LOCAL_KEY,
      JSON.stringify({ active, message: message.trim() || DEFAULT_INCIDENT_MESSAGE })
    );
  } catch {
    /* ignore */
  }
}

/** Load incident state for banner / founder cockpit. */
export async function loadPlatformIncident(): Promise<PlatformIncident> {
  if (!hasSupabaseConfig()) return readLocal();
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("platform_status")
      .select("incident_active, incident_message, updated_at")
      .eq("id", 1)
      .maybeSingle();

    if (error || !data) {
      // Table missing or RLS — local fallback
      return readLocal();
    }

    const msg =
      (data.incident_message as string)?.trim() || DEFAULT_INCIDENT_MESSAGE;
    return {
      active: !!data.incident_active,
      message: msg,
      source: "cloud",
      updatedAt: (data.updated_at as string) || null,
    };
  } catch {
    return readLocal();
  }
}

/** Founder toggle — prefers cloud; always mirrors to local. */
export async function setPlatformIncident(opts: {
  active: boolean;
  message?: string;
  userId?: string | null;
}): Promise<{ ok: boolean; source: "cloud" | "local"; error?: string }> {
  const message =
    (opts.message || DEFAULT_INCIDENT_MESSAGE).trim() || DEFAULT_INCIDENT_MESSAGE;
  writeLocal(opts.active, message);

  if (!hasSupabaseConfig()) {
    return { ok: true, source: "local" };
  }

  try {
    const supabase = createClient();
    const { error } = await supabase
      .from("platform_status")
      .update({
        incident_active: opts.active,
        incident_message: message,
        updated_at: new Date().toISOString(),
        updated_by: opts.userId || null,
      })
      .eq("id", 1);

    if (error) {
      return {
        ok: true,
        source: "local",
        error:
          error.message.includes("does not exist") ||
          error.code === "42P01" ||
          /schema cache|relation/i.test(error.message)
            ? "Run supabase/platform-status.sql so friends see the banner."
            : error.message,
      };
    }
    return { ok: true, source: "cloud" };
  } catch (e) {
    return {
      ok: true,
      source: "local",
      error: e instanceof Error ? e.message : "Cloud update failed",
    };
  }
}
