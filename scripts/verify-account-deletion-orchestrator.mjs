import assert from "node:assert/strict";
import { runAccountDeletion } from "../src/lib/account-deletion-orchestrator.ts";

function dependencies(events, overrides = {}) {
  return {
    async begin(_userId, operationId) {
      events.push("begin");
      return { ok: true, operationId };
    },
    async revokeSessions() { events.push("revoke"); },
    async deleteStorage() { events.push("storage"); },
    async redactData() { events.push("redact"); },
    async deleteAuthUser() { events.push("auth"); },
    async complete() { events.push("complete"); },
    async markFailed(_userId, _operationId, code) { events.push(`failed:${code}`); },
    ...overrides,
  };
}

const input = { userId: "user-1", accessToken: "token-1", operationId: "op-1" };

{
  const events = [];
  const result = await runAccountDeletion(input, dependencies(events));
  assert.deepEqual(events, ["begin", "revoke", "storage", "redact", "auth", "complete"]);
  assert.deepEqual(result, { ok: true, operationId: "op-1", stage: "complete" });
}

{
  const events = [];
  const result = await runAccountDeletion(input, dependencies(events, {
    async begin() {
      events.push("begin");
      return { ok: false, blocked: "commissioner", ownedRooms: 2, operationId: "op-existing" };
    },
  }));
  assert.deepEqual(events, ["begin"]);
  assert.deepEqual(result, {
    ok: false,
    operationId: "op-existing",
    blocked: "commissioner",
    ownedRooms: 2,
  });
}

{
  const events = [];
  const original = new TypeError("storage unavailable");
  await assert.rejects(
    runAccountDeletion(input, dependencies(events, {
      async deleteStorage() {
        events.push("storage");
        throw original;
      },
    })),
    (error) => error === original
  );
  assert.deepEqual(events, ["begin", "revoke", "storage", "failed:deleting_storage:TypeError"]);
}

console.log("[account-deletion-orchestrator] PASS — order, commissioner gate, and durable failure receipt verified");
