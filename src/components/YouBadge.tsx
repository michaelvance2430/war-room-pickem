/** Tiny pill next to the current viewer's name only. */
export default function YouBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center ml-1.5 align-middle text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/20 text-primary shrink-0 ${className}`}
    >
      You
    </span>
  );
}
