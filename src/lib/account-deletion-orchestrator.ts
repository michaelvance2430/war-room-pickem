export type DeletionStage =
  | "revoking_sessions"
  | "deleting_storage"
  | "redacting_data"
  | "deleting_auth_user"
  | "complete";

export type BeginDeletionResult =
  | { ok: true; operationId: string }
  | {
      ok: false;
      blocked: "commissioner";
      ownedRooms: number;
      operationId: string;
    };

export type AccountDeletionDependencies = {
  begin(userId: string, operationId: string): Promise<BeginDeletionResult>;
  revokeSessions(accessToken: string): Promise<void>;
  deleteStorage(userId: string): Promise<void>;
  redactData(userId: string, operationId: string): Promise<void>;
  deleteAuthUser(userId: string): Promise<void>;
  complete(userId: string, operationId: string): Promise<void>;
  markFailed(
    userId: string,
    operationId: string,
    errorCode: string
  ): Promise<void>;
};

export type AccountDeletionResult =
  | { ok: true; operationId: string; stage: "complete" }
  | {
      ok: false;
      operationId: string;
      blocked: "commissioner";
      ownedRooms: number;
    };

function deletionErrorCode(stage: DeletionStage, error: unknown): string {
  const detail = error instanceof Error ? error.name : "unknown";
  return `${stage}:${detail}`.slice(0, 120);
}

/**
 * Irreversible server-only orchestration. Reauthentication happens before this
 * function. The database begin step flips the active-account RLS gate before
 * any external cleanup, so a still-valid JWT fails closed immediately.
 */
export async function runAccountDeletion(
  input: {
    userId: string;
    accessToken: string;
    operationId: string;
  },
  deps: AccountDeletionDependencies
): Promise<AccountDeletionResult> {
  const begun = await deps.begin(input.userId, input.operationId);
  if (!begun.ok) {
    return {
      ok: false,
      operationId: begun.operationId,
      blocked: "commissioner",
      ownedRooms: begun.ownedRooms,
    };
  }

  const operationId = begun.operationId;
  let stage: DeletionStage = "revoking_sessions";
  try {
    await deps.revokeSessions(input.accessToken);
    stage = "deleting_storage";
    await deps.deleteStorage(input.userId);
    stage = "redacting_data";
    await deps.redactData(input.userId, operationId);
    stage = "deleting_auth_user";
    await deps.deleteAuthUser(input.userId);
    stage = "complete";
    await deps.complete(input.userId, operationId);
    return { ok: true, operationId, stage: "complete" };
  } catch (error) {
    try {
      await deps.markFailed(
        input.userId,
        operationId,
        deletionErrorCode(stage, error)
      );
    } catch {
      // Preserve the original failure. The operation ledger can be repaired by
      // Foundry using its id and current durable profile state.
    }
    throw error;
  }
}
