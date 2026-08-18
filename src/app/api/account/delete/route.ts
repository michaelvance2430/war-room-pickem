import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ACCOUNT_LIFECYCLE_PUBLIC } from "@/lib/account-lifecycle-contract";
import { runAccountDeletion } from "@/lib/account-deletion-orchestrator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CONFIRMATION = "BURN THE DOSSIER";

type RpcPayload = {
  ok?: boolean;
  blocked?: "commissioner";
  ownedRooms?: number;
  operationId?: string;
  stage?: string;
  errorCode?: string;
};

function configuredClients(): {
  anon: SupabaseClient;
  service: SupabaseClient;
} | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !anonKey || !serviceKey) return null;
  const auth = { persistSession: false, autoRefreshToken: false };
  return {
    anon: createClient(url, anonKey, { auth }),
    service: createClient(url, serviceKey, { auth }),
  };
}

function bearerToken(req: Request): string | null {
  return req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || null;
}

async function removeAllFiles(
  service: SupabaseClient,
  bucket: string,
  folder: string
): Promise<void> {
  const paths: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await service.storage.from(bucket).list(folder, {
      limit: 100,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    const files = (data || []).filter((item) => item.id !== null);
    paths.push(...files.map((item) => `${folder}/${item.name}`));
    if ((data || []).length < 100) break;
  }
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await service.storage.from(bucket).remove(paths.slice(i, i + 100));
    if (error) throw error;
  }
}

async function removeUserStorage(service: SupabaseClient, userId: string) {
  await removeAllFiles(service, "avatars", userId);

  // locker-media path: <league_id>/<user_id>/<file>. Enumerate only root
  // league folders, then remove the target user's child folder in each.
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await service.storage.from("locker-media").list("", {
      limit: 100,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    for (const entry of data || []) {
      if (entry.id === null) {
        await removeAllFiles(service, "locker-media", `${entry.name}/${userId}`);
      }
    }
    if ((data || []).length < 100) break;
  }
}

async function rpcPayload(
  service: SupabaseClient,
  name: string,
  args: Record<string, string>
): Promise<RpcPayload> {
  const { data, error } = await service.rpc(name, args);
  if (error) throw error;
  return (data || {}) as RpcPayload;
}

export async function POST(req: Request) {
  if (!ACCOUNT_LIFECYCLE_PUBLIC) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const clients = configuredClients();
  if (!clients) {
    return NextResponse.json({ error: "Account service unavailable" }, { status: 503 });
  }
  const token = bearerToken(req);
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  let body: { password?: string; confirmation?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (body.confirmation !== CONFIRMATION || !body.password) {
    return NextResponse.json({ error: "Confirmation and password are required" }, { status: 400 });
  }

  const { data: verified, error: verifyError } = await clients.anon.auth.getUser(token);
  const user = verified.user;
  if (verifyError || !user?.id || !user.email) {
    return NextResponse.json({ error: "Invalid or unsupported account session" }, { status: 401 });
  }

  // Password reauthentication occurs in an isolated, non-persisted client.
  const { data: reauth, error: reauthError } = await clients.anon.auth.signInWithPassword({
    email: user.email,
    password: body.password,
  });
  if (reauthError || reauth.user?.id !== user.id || !reauth.session?.access_token) {
    return NextResponse.json({ error: "Password verification failed" }, { status: 401 });
  }

  const operationId = crypto.randomUUID();
  try {
    const result = await runAccountDeletion(
      { userId: user.id, accessToken: reauth.session.access_token, operationId },
      {
        async begin(userId, id) {
          const data = await rpcPayload(clients.service, "begin_account_deletion", {
            p_user_id: userId,
            p_operation_id: id,
          });
          if (data.blocked === "commissioner") {
            return {
              ok: false,
              blocked: "commissioner",
              ownedRooms: Number(data.ownedRooms) || 1,
              operationId: data.operationId || id,
            };
          }
          if (!data.ok) throw new Error("Could not begin account deletion");
          return { ok: true, operationId: data.operationId || id };
        },
        async revokeSessions(accessToken) {
          const { error } = await clients.service.auth.admin.signOut(accessToken, "global");
          if (error) throw error;
        },
        deleteStorage: (userId) => removeUserStorage(clients.service, userId),
        async redactData(userId, id) {
          const data = await rpcPayload(clients.service, "redact_account_data", {
            p_user_id: userId,
            p_operation_id: id,
          });
          if (!data.ok || data.stage !== "deleting_auth_user") {
            throw new Error(`Redaction failed: ${data.errorCode || "unknown"}`);
          }
        },
        async deleteAuthUser(userId) {
          const { error } = await clients.service.auth.admin.deleteUser(userId);
          if (error) throw error;
        },
        async complete(userId, id) {
          const data = await rpcPayload(clients.service, "complete_account_deletion", {
            p_user_id: userId,
            p_operation_id: id,
          });
          if (!data.ok) throw new Error("Could not complete deletion receipt");
        },
        async markFailed(userId, id, errorCode) {
          await rpcPayload(clients.service, "fail_account_deletion", {
            p_user_id: userId,
            p_operation_id: id,
            p_error_code: errorCode,
          });
        },
      }
    );

    if (!result.ok) {
      return NextResponse.json(result, { status: 409 });
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Account deletion did not complete. No retry was hidden." },
      { status: 500 }
    );
  }
}
