import { getSportPack } from "@/lib/sports/registry";

type Props = {
  name: string;
  sportId: string;
  memberCount: number;
  maxMembers: number;
  featured?: boolean;
};

export default function RoomDiscoveryCard({
  name,
  sportId,
  memberCount,
  maxMembers,
  featured = false,
}: Props) {
  const pack = getSportPack(sportId);
  const seatsLeft = Math.max(0, maxMembers - memberCount);
  const fill = Math.max(4, Math.min(100, (memberCount / maxMembers) * 100));

  return (
    <article
      className={`overflow-hidden rounded-xl border p-4 ${
        featured
          ? "border-primary/60 bg-primary/10 shadow-[0_0_30px_rgba(34,197,94,0.08)]"
          : "border-border bg-background/45"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-primary">
            {featured ? "Next room filling" : "Open room"}
          </p>
          <h3 className="mt-1 truncate text-base font-black text-foreground">
            {name}
          </h3>
          <p className="mt-1 text-[11px] text-muted">{pack.rulesOneLiner}</p>
        </div>
        <span className="shrink-0 rounded-full border border-primary/35 bg-primary/10 px-2.5 py-1 text-[10px] font-black text-primary">
          {pack.emoji} {pack.shortLabel}
        </span>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold">
          <span className="text-foreground">
            {memberCount} player{memberCount === 1 ? "" : "s"} ready
          </span>
          <span className={seatsLeft <= 4 ? "text-amber-300" : "text-muted"}>
            {seatsLeft} seat{seatsLeft === 1 ? "" : "s"} left
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-black/60" aria-label={`${memberCount} of ${maxMembers} seats filled`}>
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary"
            style={{ width: `${fill}%` }}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-[10px] text-muted">
        <span>Private invite code stays hidden</span>
        <span className="font-bold text-foreground">Free to play</span>
      </div>
    </article>
  );
}
