import { useId } from "react";

export type ArsenalIconKind = "maps" | "nuke" | "jdam" | "hellfire" | "dead_hand";

/**
 * Profile-grade arsenal insignias. These are intentionally vector-native so
 * the same earned mark stays sharp on a 48px button, 96px profile card, or
 * 1080px share image without introducing a second asset pipeline.
 */
export default function WarRoomArsenalIcon({ kind, size = 48 }: { kind: ArsenalIconKind; size?: number }) {
  const rawId = useId().replace(/:/g, "");
  const metal = `arsenal-metal-${rawId}`;
  const glow = `arsenal-glow-${rawId}`;
  const common = { width: size, height: size, viewBox: "0 0 120 120", fill: "none", xmlns: "http://www.w3.org/2000/svg", role: "img" } as const;
  const defs = <defs><linearGradient id={metal} x1="18" y1="12" x2="101" y2="108"><stop stopColor="#fff"/><stop offset=".2" stopColor="#cbd5e1"/><stop offset=".52" stopColor="#475569"/><stop offset=".78" stopColor="#e2e8f0"/><stop offset="1" stopColor="#334155"/></linearGradient><radialGradient id={glow}><stop stopColor="#fff" stopOpacity=".95"/><stop offset=".28" stopColor="#fb923c" stopOpacity=".85"/><stop offset="1" stopColor="#7f1d1d" stopOpacity="0"/></radialGradient></defs>;
  const frame = <><path d="M60 4 97 18l19 34-8 39-31 24H43L12 91 4 52l19-34Z" fill="#05070b" stroke="#64748b" strokeWidth="3"/><circle cx="60" cy="60" r="48" stroke="#1e293b" strokeWidth="2"/><path d="M22 31 31 22M89 22l9 9M22 89l9 9M89 98l9-9" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round"/></>;

  if (kind === "maps") return <svg {...common} aria-label="M.A.P.'s insignia">{defs}{frame}<circle cx="60" cy="60" r="42" fill="#111827" stroke="#f59e0b" strokeWidth="3"/><path d="m27 38 21-9 24 9 21-9v54l-21 9-24-9-21 9Z" fill={`url(#${metal})`} stroke="#f8fafc" strokeWidth="2"/><path d="M48 29v54M72 38v54" stroke="#111827" strokeWidth="3"/><path d="m35 67 14-16 12 10 19-22" stroke="#ef4444" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="80" cy="39" r="7" fill="#ef4444" stroke="#fecaca" strokeWidth="2"/><text x="60" y="108" fill="#fbbf24" fontSize="10" fontWeight="900" textAnchor="middle">M.A.P.&apos;s</text></svg>;

  if (kind === "dead_hand") return <svg {...common} aria-label="Dead Hand Protocol insignia">{defs}{frame}<circle cx="60" cy="58" r="43" fill="#190303" stroke="#ef4444" strokeWidth="3"/><path d="M35 57 29 36q-2-8 5-9 6-1 9 8l5 13-2-25q0-9 8-9 7 0 7 9v23l5-25q2-8 9-6 6 2 4 10l-3 24 10-18q4-8 10-4 6 4 1 12L84 70q-5 10-15 15v10H44V83Q34 75 32 67Z" fill={`url(#${metal})`} stroke="#fecaca" strokeWidth="2"/><circle cx="61" cy="68" r="13" fill="#160101" stroke="#f97316" strokeWidth="3"/><path d="M61 58v20M51 68h20" stroke="#ef4444" strokeWidth="3"/><path d="M46 94h30" stroke="#ef4444" strokeWidth="7" strokeLinecap="round"/></svg>;

  if (kind === "jdam") return <svg {...common} aria-label="JDAM Protocol insignia">{defs}{frame}<circle cx="60" cy="60" r="43" fill="#061226" stroke="#60a5fa" strokeWidth="3"/><circle cx="60" cy="60" r="31" stroke="#93c5fd" strokeWidth="2" strokeDasharray="5 5"/><path d="M60 13v25M60 82v25M13 60h25M82 60h25" stroke="#dbeafe" strokeWidth="3"/><path d="M60 24q15 28 7 56l-7 15-7-15q-8-28 7-56Z" fill={`url(#${metal})`} stroke="#f8fafc" strokeWidth="2"/><path d="m53 70-16 18 19-7m11-11 16 18-19-7" fill="#334155" stroke="#bfdbfe" strokeWidth="2"/><circle cx="60" cy="60" r="7" fill="#ef4444" stroke="#fecaca" strokeWidth="2"/><circle cx="60" cy="60" r="17" stroke="#ef4444" strokeWidth="1.5"/></svg>;

  if (kind === "hellfire") return <svg {...common} aria-label="Hellfire Mode insignia">{defs}{frame}<circle cx="60" cy="60" r="43" fill="#250b02" stroke="#f97316" strokeWidth="3"/><path d="M21 93q12-29 35-34l10 9Q54 92 27 103Z" fill="#ea580c"/><path d="M25 93q14-19 28-21" stroke="#fef08a" strokeWidth="6" strokeLinecap="round"/><path d="m49 67 33-43q9-11 18-3 9 8 0 18L60 77Z" fill={`url(#${metal})`} stroke="#fff" strokeWidth="2"/><path d="m76 33-7-20 20 13m-1 25 20 4-14-17" fill="#475569" stroke="#e2e8f0" strokeWidth="2"/><path d="M61 57 87 31" stroke="#ef4444" strokeWidth="3"/><circle cx="88" cy="31" r="6" fill="#ef4444" stroke="#fecaca" strokeWidth="2"/><circle cx="88" cy="31" r="14" fill={`url(#${glow})`}/></svg>;

  return <svg {...common} aria-label="Tactical Nuclear Button insignia">{defs}{frame}<circle cx="60" cy="60" r="43" fill="#07140a" stroke="#bef264" strokeWidth="3"/><path d="M60 18 76 51l-7 35H51l-7-35Z" fill={`url(#${metal})`} stroke="#fff" strokeWidth="2"/><path d="m51 85-16 17h17l8-10 8 10h17L69 85" fill="#334155" stroke="#94a3b8" strokeWidth="2"/><circle cx="60" cy="59" r="15" fill="#bef264" stroke="#ecfccb" strokeWidth="2"/><circle cx="60" cy="59" r="5" fill="#17220c"/><path d="M60 44v30M45 59h30" stroke="#17220c" strokeWidth="3"/><path d="M28 73a35 35 0 0 1 0-28M92 45a35 35 0 0 1 0 28" stroke="#a3e635" strokeWidth="3" strokeDasharray="5 5"/></svg>;
}
