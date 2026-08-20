import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const CONFIRMATION = "BURN THE DOSSIER";
const headers = { "Content-Type": "application/json" };

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

async function removeAllFiles(service: SupabaseClient, bucket: string, folder: string) {
  const paths: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await service.storage.from(bucket).list(folder, {
      limit: 100,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    const rows = data ?? [];
    paths.push(...rows.filter((item) => item.id !== null).map((item) => `${folder}/${item.name}`));
    if (rows.length < 100) break;
  }
  for (let index = 0; index < paths.length; index += 100) {
    const { error } = await service.storage.from(bucket).remove(paths.slice(index, index + 100));
    if (error) throw error;
  }
}

async function removeUserStorage(service: SupabaseClient, userId: string) {
  await removeAllFiles(service, "avatars", userId);
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await service.storage.from("locker-media").list("", {
      limit: 100,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    const rows = data ?? [];
    for (const entry of rows) {
      if (entry.id === null) await removeAllFiles(service, "locker-media", `${entry.name}/${userId}`);
    }
    if (rows.length < 100) break;
  }
}

async function rpc(service: SupabaseClient, name: string, args: Record<string, string>) {
  const { data, error } = await service.rpc(name, args);
  if (error) throw error;
  return (data ?? {}) as Record<string, unknown>;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return json({ error: "Account service unavailable" }, 503);

  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return json({ error: "Authentication required" }, 401);

  let body: { password?: string; confirmation?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
  if (!body.password || body.confirmation !== CONFIRMATION) {
    return json({ error: "Confirmation and password are required" }, 400);
  }

  const authOptions = { auth: { persistSession: false, autoRefreshToken: false } };
  const anon = createClient(url, anonKey, authOptions);
  const service = createClient(url, serviceKey, authOptions);

  const { data: verified, error: verificationError } = await anon.auth.getUser(token);
  const user = verified.user;
  if (verificationError || !user?.id || !user.email) {
    return json({ error: "Invalid or unsupported account session" }, 401);
  }

  const { data: reauthenticated, error: reauthError } = await anon.auth.signInWithPassword({
    email: user.email,
    password: body.password,
  });
  if (reauthError || reauthenticated.user?.id !== user.id || !reauthenticated.session?.access_token) {
    return json({ error: "Password verification failed" }, 401);
  }

  const operationId = crypto.randomUUID();
  let stage = "begin";
  try {
    const begun = await rpc(service, "begin_account_deletion", {
      p_user_id: user.id,
      p_operation_id: operationId,
    });
    if (begun.blocked === "commissioner") {
      return json({
        ok: false,
        blocked: "commissioner",
        ownedRooms: Number(begun.ownedRooms ?? 1),
        operationId: String(begun.operationId ?? operationId),
      }, 409);
    }
    if (!begun.ok) throw new Error("Could not begin account deletion");

    stage = "revoke_sessions";
    const { error: signOutError } = await service.auth.admin.signOut(reauthenticated.session.access_token, "global");
    if (signOutError) throw signOutError;

    stage = "delete_storage";
    await removeUserStorage(service, user.id);

    stage = "redact_data";
    const redacted = await rpc(service, "redact_account_data", {
      p_user_id: user.id,
      p_operation_id: operationId,
    });
    if (!redacted.ok || redacted.stage !== "deleting_auth_user") throw new Error("Account redaction failed");

    stage = "delete_auth_user";
    const { error: deleteError } = await service.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    stage = "complete";
    const completed = await rpc(service, "complete_account_deletion", {
      p_user_id: user.id,
      p_operation_id: operationId,
    });
    if (!completed.ok) throw new Error("Could not complete deletion receipt");

    return json({ ok: true, operationId, stage: "complete" });
  } catch (error) {
    try {
      await rpc(service, "fail_account_deletion", {
        p_user_id: user.id,
        p_operation_id: operationId,
        p_error_code: `${stage}:${error instanceof Error ? error.name : "unknown"}`.slice(0, 120),
      });
    } catch {
      // Preserve the original failure for the client; the durable operation can be repaired separately.
    }
    return json({ error: "Account deletion did not complete. No retry was hidden." }, 500);
  }
});
