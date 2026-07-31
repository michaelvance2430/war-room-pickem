"use client";

import Link from "next/link";

/**
 * Name → /profile/[id].
 * Styled as an obvious tappable link (phones have no hover).
 */
export default function PlayerLink({
  id,
  name,
  className = "",
  showYou = false,
}: {
  id: string | null | undefined;
  name: string | null | undefined;
  className?: string;
  showYou?: boolean;
}) {
  const label = name?.trim() || "TBD";
  if (!id) {
    return <span className={`text-muted ${className}`.trim()}>{label}</span>;
  }

  return (
    <Link
      href={`/profile/${id}`}
      title={`View ${label}'s profile`}
      aria-label={`View ${label}'s profile`}
      className={[
        "inline-flex items-center gap-1 max-w-full",
        "font-semibold text-primary",
        "underline decoration-primary decoration-2 underline-offset-[3px]",
        "active:opacity-80 touch-manipulation",
        // Comfortable tap without blowing up dense tables
        "py-0.5 -my-0.5",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="truncate">{label}</span>
      <span
        className="shrink-0 text-[10px] font-bold opacity-80 no-underline leading-none"
        aria-hidden
      >
        ↗
      </span>
      {showYou && (
        <span className="ml-0.5 text-xs text-primary/90 no-underline shrink-0">
          (You)
        </span>
      )}
    </Link>
  );
}
