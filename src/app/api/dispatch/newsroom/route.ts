import "server-only";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateApiRequest } from "@/lib/server-api-auth";
import type { DispatchAiDraft, DispatchFactPacket } from "@/lib/dispatch-ai-contract";
import { validateDispatchAiDraft } from "@/lib/dispatch-ai-contract";
import {
  buildDeterministicDispatchDraft,
  type SanitizedLockerTheme,
} from "@/lib/dispatch-newsroom";

export const runtime = "nodejs";
export const maxDuration = 20;

const STORY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["kicker", "headline", "body", "sourceFactIds"],
  properties: {
    kicker: { type: "string", maxLength: 40 },
    headline: { type: "string", maxLength: 120 },
    body: { type: "string", maxLength: 420 },
    sourceFactIds: { type: "array", minItems: 1, maxItems: 4, items: { type: "string" } },
  },
} as const;

const DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "lead", "briefs", "lockerRoasts"],
  properties: {
    schemaVersion: { type: "integer", enum: [1] },
    lead: STORY_SCHEMA,
    briefs: { type: "array", maxItems: 5, items: STORY_SCHEMA },
    lockerRoasts: { type: "array", maxItems: 3, items: STORY_SCHEMA },
  },
} as const;

function validPacket(value: unknown): value is DispatchFactPacket {
  if (!value || typeof value !== "object") return false;
  const packet = value as Partial<DispatchFactPacket>;
  return packet.schemaVersion === 1 &&
    typeof packet.leagueId === "string" && /^[0-9a-f-]{36}$/i.test(packet.leagueId) &&
    Number.isInteger(packet.weekNumber) && (packet.weekNumber as number) >= 0 &&
    typeof packet.weekLabel === "string" && packet.weekLabel.length <= 40 &&
    typeof packet.coverageLine === "string" && packet.coverageLine.length <= 100 &&
    typeof packet.sportId === "string" && packet.sportId.length <= 32 &&
    Array.isArray(packet.facts) && packet.facts.length > 0 && packet.facts.length <= 16 &&
    packet.facts.every((fact) =>
      !!fact && typeof fact.id === "string" && fact.id.length <= 80 &&
      typeof fact.summary === "string" && fact.summary.length > 0 && fact.summary.length <= 500 &&
      Array.isArray(fact.people) && fact.people.length <= 12 &&
      Array.isArray(fact.lockerMessageIds) && fact.lockerMessageIds.length <= 20
    );
}

function tokenClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    }
  );
}

function newsroomAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizeDispatchLine(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const COPY_FIELDS = new Set(["headline", "body", "deck", "tagline", "text"]);

function collectArchivedCopy(value: unknown, lines: Set<string>, key = ""): void {
  if (typeof value === "string") {
    if (COPY_FIELDS.has(key)) {
      const normalized = normalizeDispatchLine(value);
      if (normalized.length >= 12) lines.add(normalized);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectArchivedCopy(item, lines, key);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [childKey, child] of Object.entries(value as Record<string, unknown>)) {
    collectArchivedCopy(child, lines, childKey);
  }
}

/**
 * Server-only global memory. The browser never receives another league's copy;
 * the newsroom gets only a collision set used to reject recycled lines.
 */
async function archivedDispatchLines(packet: DispatchFactPacket): Promise<Set<string>> {
  const admin = newsroomAdminClient();
  if (!admin) return new Set();
  const { data } = await admin
    .from("gazette_editions")
    .select("league_id, week_number, payload")
    .order("created_at", { ascending: false })
    .limit(5000);
  const lines = new Set<string>();
  for (const row of data || []) {
    if (row.league_id === packet.leagueId && row.week_number === packet.weekNumber) continue;
    collectArchivedCopy(row.payload, lines);
  }
  return lines;
}

function draftCollisions(draft: DispatchAiDraft, archived: Set<string>): string[] {
  const collisions = new Set<string>();
  for (const story of [draft.lead, ...draft.briefs, ...draft.lockerRoasts]) {
    for (const line of [story.headline, story.body]) {
      const normalized = normalizeDispatchLine(line);
      if (normalized.length >= 12 && archived.has(normalized)) collisions.add(line);
    }
  }
  return [...collisions];
}

function hashCopySeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function makeFallbackUnique(
  packet: DispatchFactPacket,
  draft: DispatchAiDraft,
  archived: Set<string>
): DispatchAiDraft {
  const claimed = new Set(archived);
  let ordinal = 0;
  const uniqueLine = (line: string): string => {
    const normalized = normalizeDispatchLine(line);
    if (!claimed.has(normalized)) {
      claimed.add(normalized);
      return line;
    }
    ordinal += 1;
    const desk = (hashCopySeed(`${packet.leagueId}:${packet.weekNumber}:${ordinal}`) % 900) + 100;
    const rewritten = `${line} — ${packet.weekLabel.toUpperCase()} DESK ${desk}`;
    claimed.add(normalizeDispatchLine(rewritten));
    return rewritten;
  };
  const story = <T extends DispatchAiDraft["lead"]>(item: T): T => ({
    ...item,
    headline: uniqueLine(item.headline),
    body: uniqueLine(item.body),
  });
  return {
    ...draft,
    lead: story(draft.lead),
    briefs: draft.briefs.map(story),
    lockerRoasts: draft.lockerRoasts.map(story),
  };
}

async function lockerActivityTheme(
  supabase: ReturnType<typeof tokenClient>,
  packet: DispatchFactPacket
): Promise<SanitizedLockerTheme | null> {
  const since = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  const { data: messages } = await supabase
    .from("locker_messages")
    .select("id, user_id, body")
    .eq("league_id", packet.leagueId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(60);
  if (!messages?.length) return null;

  const ids = messages.map((row) => row.id as string);
  const authors = new Set(messages.map((row) => row.user_id as string));
  const { data: reactions } = await supabase
    .from("locker_message_reactions")
    .select("message_id")
    .in("message_id", ids);
  const reactionCount = reactions?.length || 0;
  const meltdown = messages
    .map((row) => ({
      id: row.id as string,
      userId: row.user_id as string,
      score: vulgarityScore(String(row.body || "")),
    }))
    .sort((a, b) => b.score - a.score)[0];
  let meltdownLine = "";
  if (meltdown && meltdown.score >= 5) {
    const { data: member } = await supabase
      .from("memberships")
      .select("display_name_override, profiles(display_name)")
      .eq("league_id", packet.leagueId)
      .eq("user_id", meltdown.userId)
      .maybeSingle();
    const profile = member?.profiles as unknown as { display_name?: string } | null;
    const name = String(member?.display_name_override || profile?.display_name || "One player")
      .replace(/[^a-z0-9 ._'-]/gi, "")
      .trim()
      .slice(0, 40) || "One player";
    meltdownLine = ` ${name} delivered a fully redacted outburst: \"#$@#$(@*#$@#*($()@$)@*#$\". Somebody get that player a Snickers.`;
  }
  return {
    summary: `${packet.weekLabel}'s Locker Room logged ${messages.length} messages from ${authors.size} players${reactionCount ? ` and drew ${reactionCount} reactions` : ""}.${meltdownLine} No private message text was supplied to the newsroom.`,
    messageIds: ids.slice(0, 20),
  };
}

/** Detect intensity locally; the original words are never placed in the AI packet. */
function vulgarityScore(body: string): number {
  if (!body || body.startsWith("WR_IMG|") || body.startsWith("WR_FUN|")) return 0;
  const profanity = body.match(/\b(fuck\w*|shit\w*|bitch\w*|asshole\w*|motherfuck\w*)\b/gi)?.length || 0;
  const symbols = body.match(/[!@#$%^&*]{2,}/g)?.length || 0;
  const letters = body.match(/[a-z]/gi)?.length || 0;
  const caps = body.match(/[A-Z]/g)?.length || 0;
  const shouting = letters >= 12 && caps / letters >= 0.7 ? 2 : 0;
  return profanity * 3 + symbols * 2 + shouting;
}

function withLockerTheme(packet: DispatchFactPacket, theme: SanitizedLockerTheme | null): DispatchFactPacket {
  if (!theme) return packet;
  return {
    ...packet,
    facts: [
      ...packet.facts,
      {
        id: `w${packet.weekNumber}-locker_theme-${packet.facts.length + 1}`,
        kind: "locker_theme",
        summary: theme.summary,
        people: [],
        lockerMessageIds: theme.messageIds,
      },
    ],
  };
}

function responseText(payload: unknown): string | null {
  const output = (payload as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> })?.output;
  for (const item of output || []) {
    const text = item.content?.find((part) => part.type === "output_text")?.text;
    if (text) return text;
  }
  return null;
}

async function generateDraft(
  packet: DispatchFactPacket,
  rejectedLines: string[] = []
): Promise<DispatchAiDraft | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const model = process.env.DISPATCH_AI_MODEL || "gpt-5-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: 1800,
      input: [
        {
          role: "system",
          content: "You are The War Room Dispatch sports desk: a sharp, colorful, deranged sports tabloid. Write concise funny coverage only from the supplied facts. Never invent a score, result, quote, injury, accusation, or message. Every story must cite the exact source fact IDs it uses. Keep the humor playful; no slurs, threats, protected-class attacks, sexual humiliation, or cruelty. Locker facts contain activity metadata only—roast the room's energy, never pretend you read its messages. Every headline and body line must be freshly written. Never reuse, lightly punctuate, or closely echo a rejected line.",
        },
        ...(rejectedLines.length ? [{
          role: "system" as const,
          content: `These lines already appeared in another Dispatch and are forbidden. Write genuinely different copy, not a suffix or punctuation variation:\n${rejectedLines.slice(0, 40).join("\n")}`,
        }] : []),
        },
        { role: "user", content: JSON.stringify(packet) },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "dispatch_draft",
          strict: true,
          schema: DRAFT_SCHEMA,
        },
      },
    }),
  });
  if (!response.ok) return null;
  const text = responseText(await response.json());
  if (!text) return null;
  try {
    const draft = JSON.parse(text) as DispatchAiDraft;
    return validateDispatchAiDraft(packet, draft).ok ? draft : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const identity = await authenticateApiRequest(req);
  if (!identity.ok) {
    return NextResponse.json({ ok: false, error: identity.error }, { status: identity.status });
  }
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  let raw: { packet?: unknown };
  try {
    raw = (await req.json()) as { packet?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  if (!validPacket(raw.packet)) {
    return NextResponse.json({ ok: false, error: "Invalid fact packet" }, { status: 400 });
  }
  const packet = raw.packet;
  const supabase = tokenClient(token);

  const [{ data: membership }, { data: league }, { data: filed }] = await Promise.all([
    supabase.from("memberships").select("is_deputy").eq("league_id", packet.leagueId).eq("user_id", identity.userId).maybeSingle(),
    supabase.from("leagues").select("commissioner_id").eq("id", packet.leagueId).maybeSingle(),
    supabase.from("gazette_editions").select("week_number").eq("league_id", packet.leagueId).eq("week_number", packet.weekNumber).maybeSingle(),
  ]);
  const isOps = league?.commissioner_id === identity.userId || !!membership?.is_deputy;
  if (!isOps) return NextResponse.json({ ok: false, error: "Commissioner or deputy required" }, { status: 403 });
  if (!filed) return NextResponse.json({ ok: false, error: "Score the week before opening the newsroom" }, { status: 409 });

  const enriched = withLockerTheme(packet, await lockerActivityTheme(supabase, packet));
  const archived = await archivedDispatchLines(enriched);
  let aiDraft: DispatchAiDraft | null = null;
  let rejectedLines: string[] = [];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const candidate = await generateDraft(enriched, rejectedLines);
    if (!candidate) break;
    const collisions = draftCollisions(candidate, archived);
    if (!collisions.length) {
      aiDraft = candidate;
      break;
    }
    rejectedLines = [...new Set([...rejectedLines, ...collisions])];
  }
  const fallback = makeFallbackUnique(
    enriched,
    buildDeterministicDispatchDraft(enriched),
    archived
  );
  return NextResponse.json({
    ok: true,
    packet: enriched,
    draft: aiDraft || fallback,
    via: aiDraft ? "ai" : "fallback",
  }, { headers: { "Cache-Control": "no-store" } });
}
