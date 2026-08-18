const BLOCKED_PHRASES = [
  "kill yourself",
  "kys",
  "go die",
  "nigger",
  "nigga",
  "faggot",
  "retard",
] as const;

function normalizedWords(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[0@]/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/[3]/g, "e")
    .replace(/[4]/g, "a")
    .replace(/[5$]/g, "s")
    .replace(/[7+]/g, "t")
    .replace(/[^a-z]+/g, " ")
    .trim();
}

/**
 * A deliberately narrow launch filter for explicit slurs and self-harm abuse.
 * Reporting, blocking, and staff removal remain the backstop for context that
 * cannot be judged safely by a word list.
 */
export function objectionableLockerReason(value: string): string | null {
  const words = normalizedWords(value);
  if (!words) return null;
  const padded = ` ${words} `;
  for (const phrase of BLOCKED_PHRASES) {
    if (padded.includes(` ${phrase} `)) {
      return "That message contains language that is not allowed in the Locker.";
    }
  }
  return null;
}

export const LOCKER_SAFETY_COPY =
  "Keep it competitive, not abusive. Slurs, threats, targeted harassment, and sexual exploitation are removed. Report or block a player from their profile.";
