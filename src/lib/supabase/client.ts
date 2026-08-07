import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client — SINGLETON.
 * Creating a new client on every loadWeekCard / roster / badge call spawned
 * multiple GoTrue/auth listeners and made every screen feel sticky on phone.
 */
let browserClient: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel."
    );
  }

  // SSR/prerender: no window — don't pin a long-lived instance to the server process
  if (typeof window === "undefined") {
    return createBrowserClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }) as unknown as SupabaseClient;
  }

  if (!browserClient) {
    browserClient = createBrowserClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // League invites intentionally use ?code=XXXXXX. Automatic URL
        // detection mistakes those invite codes for PKCE auth codes. Recovery
        // is exchanged explicitly on /reset-password instead.
        detectSessionInUrl: false,
        storage: window.localStorage,
        storageKey: "warroom-auth",
      },
    }) as unknown as SupabaseClient;
  }
  return browserClient;
}

export function hasSupabaseConfig() {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
