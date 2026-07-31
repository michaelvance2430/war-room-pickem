"use client";

import {
  BIG_GAME_KINDS,
  HARDWARE_KIND_META,
  splitHardwareCases,
  type ProfileTrophy,
  type ProfileTrophyKind,
} from "@/lib/profile-hardware";

function Plaque({ item }: { item: ProfileTrophy }) {
  const meta = HARDWARE_KIND_META[item.kind];
  return (
    <div
      className={`rounded-xl border ${meta.border} bg-gradient-to-b from-card to-black/40 p-4 min-h-[120px] relative`}
    >
      <div className="text-2xl mb-1" aria-hidden>
        {meta.emoji}
      </div>
      <div className={`text-[10px] uppercase tracking-wide font-semibold ${meta.accent}`}>
        {item.seasonYear} · {item.title}
      </div>
      {item.division && (
        <div className="text-sm font-bold mt-1">{item.division} Division</div>
      )}
      {item.subtitle && (
        <p className="text-xs text-muted mt-1">{item.subtitle}</p>
      )}
      {item.notes && (
        <p className="text-[11px] text-muted/80 mt-2 italic leading-snug">
          {item.notes}
        </p>
      )}
      {item.source === "legacy" && (
        <span className="absolute top-2 right-2 text-[9px] uppercase tracking-wider text-muted">
          Legacy
        </span>
      )}
    </div>
  );
}

function EmptySlot({ kind }: { kind: ProfileTrophyKind }) {
  const meta = HARDWARE_KIND_META[kind];
  return (
    <div className="rounded-xl border border-dashed border-border/70 bg-card/30 p-4 min-h-[120px] flex flex-col justify-center opacity-50">
      <div className="text-2xl mb-1 grayscale" aria-hidden>
        {meta.emoji}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-muted">
        {kind === "championship"
          ? "Championship"
          : kind === "toilet_bowl"
            ? "Toilet Bowl"
            : kind === "crystal_ball"
              ? "Village Nerd"
              : "Division"}
      </div>
      <p className="text-xs text-muted mt-1">{meta.emptyLabel}</p>
    </div>
  );
}

export default function ProfileTrophyCase({
  items,
  playerName,
}: {
  items: ProfileTrophy[];
  playerName: string;
}) {
  const { bigGame, division } = splitHardwareCases(items);

  const byKind = (kind: ProfileTrophyKind) =>
    bigGame.filter((i) => i.kind === kind);

  const hasAny = items.length > 0;

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 mb-6">
      <div className="mb-4">
        <h2 className="font-semibold text-lg">Trophy case</h2>
        <p className="text-xs text-muted mt-0.5">
          Championship &amp; Toilet hardware, Village Nerd, and division titles —
          career flex for {playerName.split(/\s+/)[0] || "this player"}.
        </p>
      </div>

      {/* Big game hardware */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300/90">
            Championship hardware
          </h3>
          <div className="flex-1 h-px bg-border" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {BIG_GAME_KINDS.map((kind) => {
            const won = byKind(kind);
            if (won.length === 0) {
              return <EmptySlot key={kind} kind={kind} />;
            }
            return (
              <div key={kind} className="space-y-2">
                {won.map((item) => (
                  <Plaque key={item.id} item={item} />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Division case */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
            Division titles
          </h3>
          <div className="flex-1 h-px bg-border" />
        </div>
        {division.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <EmptySlot kind="division" />
            <div className="rounded-xl border border-dashed border-border/50 bg-card/20 p-4 min-h-[120px] flex flex-col justify-center opacity-40">
              <p className="text-xs text-muted">
                Win your division to put a shield here. Commissioner can engrave
                division hardware after the season (coming with Trophy Room
                division awards).
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {division.map((item) => (
              <Plaque key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>

      {!hasAny && (
        <p className="text-[11px] text-muted mt-4 text-center">
          Empty shelves — win a championship, toilet, nerd award, or division.
        </p>
      )}
    </section>
  );
}
