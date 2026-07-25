"use client";

import { Bracket, Matchup, roundLabel } from "@/lib/brackets";

interface Props {
  bracket: Bracket;
  accent: "primary" | "toilet";
}

function Slot({
  seed,
  name,
  isBye,
  isWinner,
  score,
  accent,
}: {
  seed: number | null;
  name: string | null;
  isBye: boolean;
  isWinner: boolean;
  score: number | null;
  accent: "primary" | "toilet";
}) {
  if (isBye) {
    return (
      <div className="h-10 px-3 flex items-center text-xs text-muted/50 italic border border-dashed border-border rounded-md">
        BYE
      </div>
    );
  }

  const accentBorder =
    accent === "toilet" ? "border-toilet/50" : "border-primary/50";
  const accentBg =
    accent === "toilet" ? "bg-toilet/10" : "bg-primary/10";
  const accentText =
    accent === "toilet" ? "text-toilet" : "text-primary";

  return (
    <div
      className={`h-10 px-3 flex items-center gap-2 rounded-md border text-sm transition ${
        isWinner
          ? `${accentBorder} ${accentBg}`
          : "border-border bg-card"
      }`}
    >
      {seed !== null && (
        <span className={`text-xs font-bold w-5 ${isWinner ? accentText : "text-muted"}`}>
          {seed}
        </span>
      )}
      <span className={`flex-1 truncate font-medium ${isWinner ? "" : "text-foreground"}`}>
        {name ?? "TBD"}
      </span>
      {score !== null && (
        <span className={`text-xs font-semibold ${isWinner ? accentText : "text-muted"}`}>
          {score}
        </span>
      )}
    </div>
  );
}

function MatchCard({
  match,
  accent,
}: {
  match: Matchup;
  accent: "primary" | "toilet";
}) {
  const aWin = match.winnerId && match.slotA.player?.id === match.winnerId;
  const bWin = match.winnerId && match.slotB.player?.id === match.winnerId;

  return (
    <div className="w-52 space-y-1">
      <Slot
        seed={match.slotA.seed}
        name={match.slotA.player?.name ?? null}
        isBye={match.slotA.isBye}
        isWinner={!!aWin}
        score={match.scoreA}
        accent={accent}
      />
      <Slot
        seed={match.slotB.seed}
        name={match.slotB.player?.name ?? null}
        isBye={match.slotB.isBye}
        isWinner={!!bWin}
        score={match.scoreB}
        accent={accent}
      />
    </div>
  );
}

export default function BracketView({ bracket, accent }: Props) {
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
                // Space matchups so lines would connect visually
                minHeight: `${Math.max(round.length * 96, 120)}px`,
              }}
            >
              {round.map((m) => (
                <MatchCard key={m.id} match={m} accent={accent} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
