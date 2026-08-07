import "server-only";

import { createClient } from "@supabase/supabase-js";
import { isAppCreator } from "@/lib/creator";

export type ApiIdentity =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403 | 503; error: string };

/** Validate the bearer token with Supabase Auth; never trust client IDs. */
export async function authenticateApiRequest(req: Request): Promise<ApiIdentity> {
  const auth = req.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) {
    return { ok: false, status: 401, error: "Authentication required" };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!url || !key) {
    return { ok: false, status: 503, error: "Authentication unavailable" };
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(match[1].trim());
  if (error || !data.user?.id) {
    return { ok: false, status: 401, error: "Invalid or expired session" };
  }
  return { ok: true, userId: data.user.id };
}

export async function authenticateCreatorApiRequest(
  req: Request
): Promise<ApiIdentity> {
  const identity = await authenticateApiRequest(req);
  if (!identity.ok) return identity;
  if (!isAppCreator(identity.userId)) {
    return { ok: false, status: 403, error: "Creator only" };
  }
  return identity;
}
