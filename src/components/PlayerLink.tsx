"use client";

import Link from "next/link";

/** Name → /profile/[id]. Nothing fancy. */
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
      className={`font-medium underline decoration-primary/40 underline-offset-2 hover:text-primary ${className}`.trim()}
    >
      {label}
      {showYou && (
        <span className="ml-1.5 text-xs text-primary no-underline">(You)</span>
      )}
    </Link>
  );
}
