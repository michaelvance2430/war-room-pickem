/**
 * Visible ownership / copyright line.
 * Documents authorship for War Room Pick'Em (Mike Vance).
 * Not a trademark registration — consult an attorney for IP strategy.
 */

type Props = {
  /** compact = one line; full = slightly more formal */
  variant?: "compact" | "full";
  className?: string;
};

const OWNER = "Mike Vance";
const PRODUCT = "War Room Pick'Em";
const YEAR = 2026;

export function ownershipText(variant: "compact" | "full" = "compact"): string {
  if (variant === "full") {
    return `© ${YEAR} ${OWNER}. ${PRODUCT}. All rights reserved. Owned by ${OWNER}.`;
  }
  return `© ${YEAR} ${OWNER} · Owned by ${OWNER}`;
}

export default function OwnershipNotice({
  variant = "compact",
  className = "",
}: Props) {
  return (
    <p
      className={`text-[10px] leading-relaxed text-muted/80 text-center ${className}`}
      role="contentinfo"
    >
      {variant === "full" ? (
        <>
          © {YEAR} <span className="text-muted">{OWNER}</span>. {PRODUCT}.
          All rights reserved.
          <br />
          <span className="font-semibold text-muted">Owned by {OWNER}</span>
        </>
      ) : (
        <>
          © {YEAR} {OWNER} ·{" "}
          <span className="font-semibold text-muted">Owned by {OWNER}</span>
        </>
      )}
    </p>
  );
}

export const OWNERSHIP = {
  owner: OWNER,
  product: PRODUCT,
  year: YEAR,
} as const;
