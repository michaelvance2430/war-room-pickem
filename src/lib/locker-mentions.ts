/**
 * @mention helpers for Locker Room.
 */

export type MentionMember = {
  userId: string;
  name: string;
};

/** Active @query at caret, e.g. "@mi" → { start, query }. */
export function getActiveMention(
  text: string,
  caret: number
): { start: number; query: string } | null {
  if (caret < 0 || caret > text.length) return null;
  const before = text.slice(0, caret);
  // @ then letters/numbers/spaces up to 32 chars (display names)
  const m = before.match(/@([A-Za-z0-9 .'_-]{0,32})$/);
  if (!m) return null;
  // Don't treat email mid-word as mention: require start or whitespace before @
  const atIndex = before.length - m[0].length;
  if (atIndex > 0) {
    const prev = before[atIndex - 1];
    if (prev && !/\s/.test(prev)) return null;
  }
  return { start: atIndex, query: m[1] || "" };
}

export function filterMentionMembers(
  members: MentionMember[],
  query: string,
  limit = 6
): MentionMember[] {
  const q = query.trim().toLowerCase();
  const sorted = [...members].sort((a, b) => a.name.localeCompare(b.name));
  if (!q) return sorted.slice(0, limit);
  return sorted
    .filter((m) => m.name.toLowerCase().includes(q))
    .slice(0, limit);
}

/** Insert @Name (with trailing space) replacing the active @query. */
export function applyMention(
  text: string,
  caret: number,
  member: MentionMember
): { text: string; caret: number } {
  const active = getActiveMention(text, caret);
  if (!active) {
    const insert = `@${member.name} `;
    const next = text.slice(0, caret) + insert + text.slice(caret);
    return { text: next, caret: caret + insert.length };
  }
  const insert = `@${member.name} `;
  const next =
    text.slice(0, active.start) + insert + text.slice(caret);
  return { text: next, caret: active.start + insert.length };
}

/**
 * Split body into text / mention segments for rendering.
 * Matches @Name against roster names (longest first to avoid partials).
 */
export function splitMentions(
  body: string,
  members: MentionMember[]
): { type: "text" | "mention"; value: string; userId?: string }[] {
  if (!body) return [{ type: "text", value: "" }];
  const names = [...members]
    .map((m) => m.name)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (!names.length) return [{ type: "text", value: body }];

  const escaped = names.map((n) =>
    n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  const re = new RegExp(`@(${escaped.join("|")})(?![\\w])`, "g");
  const out: { type: "text" | "mention"; value: string; userId?: string }[] =
    [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    if (match.index > last) {
      out.push({ type: "text", value: body.slice(last, match.index) });
    }
    const name = match[1];
    const mem = members.find(
      (m) => m.name.toLowerCase() === name.toLowerCase()
    );
    out.push({
      type: "mention",
      value: match[0],
      userId: mem?.userId,
    });
    last = match.index + match[0].length;
  }
  if (last < body.length) {
    out.push({ type: "text", value: body.slice(last) });
  }
  return out.length ? out : [{ type: "text", value: body }];
}
