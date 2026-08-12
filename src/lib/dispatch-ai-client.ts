import type { DispatchAiDraft, DispatchFactPacket } from "@/lib/dispatch-ai-contract";
import { createClient } from "@/lib/supabase/client";

export type DispatchNewsroomResult = {
  packet: DispatchFactPacket;
  draft: DispatchAiDraft;
  via: "ai" | "fallback";
};

/** Best-effort server rewrite. The already-filed factual edition remains the fallback. */
export async function requestDispatchNewsroom(
  packet: DispatchFactPacket
): Promise<DispatchNewsroomResult | null> {
  try {
    const { data } = await createClient().auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch("/api/dispatch/newsroom", {
        method: "POST",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ packet }),
      });
      if (!response.ok) return null;
      const body = (await response.json()) as Partial<DispatchNewsroomResult>;
      if (!body.packet || !body.draft || (body.via !== "ai" && body.via !== "fallback")) {
        return null;
      }
      return body as DispatchNewsroomResult;
    } finally {
      window.clearTimeout(timeout);
    }
  } catch {
    return null;
  }
}
