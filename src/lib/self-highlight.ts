/**
 * Highlight the signed-in player's name/row for the current viewer only.
 * Uses session.playerId === player.id (Supabase auth user id).
 */

export function isSelfPlayer(
  playerId: string | null | undefined,
  selfId: string | null | undefined
): boolean {
  return Boolean(playerId && selfId && playerId === selfId);
}

/** Table row / list card background + left accent for "you". */
export function selfRowClass(isSelf: boolean, extra = ""): string {
  if (!isSelf) return extra;
  return ["bg-primary/12", "ring-1", "ring-inset", "ring-primary/35", extra]
    .filter(Boolean)
    .join(" ");
}

/** Player name text when it belongs to the current viewer. */
export function selfNameClass(isSelf: boolean, base = "font-medium"): string {
  return isSelf ? `${base} text-primary font-bold`.trim() : base;
}
