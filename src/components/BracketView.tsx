"use client";

import { Bracket, Matchup, roundLabel } from "@/lib/brackets";
import { isSelfPlayer, selfNameClass } from "@/lib/self-highlight";
import YouBadge from "@/components/YouBadge";

interface Props {
  bracket: Bracket;
  accent: "primary" | "toilet";
  /** Current viewer's user id — only their slots highlight. */
  selfId?: string | null;
}

function Slot({
  seed,
  name,
  playerId,
  isBye,
  isWinner,
  score,
  accent,
  selfId,
}: {
  seed: number | null;
  name: string | null;
  playerId: string | null;
  isBye: boolean;
  isWinner: boolean;
  score: number | null;
  accent: "primary" | "toilet";
  selfId?: string | null;
}) {
  if (isBye) {
    return (
      <div className="h-10 px-3 flex items-center text-xs text-muted/50 italic border border-dashed border-border rounded-md">
        BYE
      </div>
    );
  }

  const mine = isSelfPlayer(playerId, selfId);
  const accentBorder =
    accent === "toilet" ? "border-toilet/50" : "border-primary/50";
  const accentBg =
    accent === "toilet" ? "bg-toilet/10" : "bg-primary/10";
  const accentText =
    accent === "toilet" ? "text-toilet" : "text-primary";

  // "You" always uses primary so your identity is consistent in both brackets
  let boxClass = "border-border bg-card";
  if (mine && isWinner) {
    boxClass =
      "border-primary bg-primary/20 ring-1 ring-inset ring-primary/50";
  } else if (mine) {
    boxClass =
      "border-primary/60 bg-primary/15 ring-1 ring-inset ring-primary/40";
  } else if (isWinner) {
    boxClass = `${accentBorder} ${accentBg}`;
  }

  return (
    <div
      className={`h-10 px-3 flex items-center gap-2 rounded-md border text-sm transition ${boxClass}`}
    >
      {seed !== null && (
        <span
          className={`text-xs font-bold w-5 ${
            mine || isWinner ? accentText : "text-muted"
          } ${mine ? "text-primary" : ""}`}
        >
          {seed}
        </span>
      )}
      <span
        className={`flex-1 truncate ${selfNameClass(
          mine,
          isWinner && !mine ? "font-medium text-foreground" : "font-medium"
        )}`}
      >
        {name ?? "TBD"}
        {mine && <YouBadge />}
      </span>
      {score !== null && (
        <span
          className={`text-xs font-semibold ${
            mine ? "text-primary" : isWinner ? accentText : "text-muted"
          }`}
        >
          {score}
        </span>
      )}
    </div>
  );
}

function MatchCard({
  match,
  accent,
  selfId,
}: {
  match: Matchup;
  accent: "primary" | "toilet";
  selfId?: string | null;
}) {
  const aWin = match.winnerId && match.slotA.player?.id === match.winnerId;
  const bWin = match.winnerId && match.slotB.player?.id === match.winnerId;

  return (
    <div className="w-52 space-y-1">
      <Slot
        seed={match.slotA.seed}
        name={match.slotA.player?.name ?? null}
        playerId={match.slotA.player?.id ?? null}
        isBye={match.slotA.isBye}
        isWinner={!!aWin}
        score={match.scoreA}
        accent={accent}
        selfId={selfId}
      />
      <Slot
        seed={match.slotB.seed}
        name={match.slotB.player?.name ?? null}
        playerId={match.slotB.player?.id ?? null}
        isBye={match.slotB.isBye}
        isWinner={!!bWin}
        score={match.scoreB}
        accent={accent}
        selfId={selfId}
      />
    </div>
  );
}

export default function BracketView({ bracket, accent, selfId }: Props) {
  const totalRounds = bracket.rounds.length;

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-8 min-w-max px-2">
        {bracket.rounds.map((round, rIdx) => (
          <div key={rIdx} className="flex flex-col">
            <div
              className={`text-xs font-semibold uppercase tracking-wide mb-4 text-center ${
                accent === "toilet" ? "text-toilet" : "text-primary"
              }`}
            >
              {roundLabel(rIdx, totalRounds)}
            </div>
            <div
              className="flex flex-col justify-around flex-1 gap-4"
              style={{
                minHeight: `${Math.max(round.length * 96, 120)}px`,
              }}
            >
              {round.map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  accent={accent}
                  selfId={selfId}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
