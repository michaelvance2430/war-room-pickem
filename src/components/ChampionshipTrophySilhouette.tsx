import type { ChampionshipTrophyDesign } from "@/lib/championship-trophy-catalog";

export default function ChampionshipTrophySilhouette({
  design,
  size,
  threePeat = false,
}: {
  design: ChampionshipTrophyDesign;
  size: number;
  threePeat?: boolean;
}) {
  const id = `wr-${design.id}-${size}`;
  return <svg width={size} height={size} viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={`${design.name} championship trophy`}>
    <defs>
      <linearGradient id={`${id}-metal`} x1="35" y1="15" x2="105" y2="115" gradientUnits="userSpaceOnUse"><stop stopColor={design.colors[0]} /><stop offset=".48" stopColor={design.colors[1]} /><stop offset="1" stopColor={design.colors[2]} /></linearGradient>
      <linearGradient id={`${id}-shine`} x1="35" y1="20" x2="100" y2="100" gradientUnits="userSpaceOnUse"><stop stopColor="#fff" stopOpacity=".9" /><stop offset=".3" stopColor={design.colors[0]} /><stop offset="1" stopColor={design.colors[1]} /></linearGradient>
      <radialGradient id={`${id}-glow`}><stop stopColor={design.colors[1]} stopOpacity=".48" /><stop offset="1" stopColor={design.colors[2]} stopOpacity="0" /></radialGradient>
      <filter id={`${id}-shadow`} x="-30%" y="-20%" width="160%" height="170%"><feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#000" floodOpacity=".65" /></filter>
    </defs>
    <ellipse cx="70" cy="72" rx="57" ry="57" fill={`url(#${id}-glow)`} />
    <g filter={`url(#${id}-shadow)`}>{renderShape(design.id, id)}</g>
    <rect x="29" y="116" width="82" height="14" rx="4" fill={`url(#${id}-metal)`} stroke={design.colors[0]} strokeWidth="1" />
    <rect x="38" y="106" width="64" height="12" rx="3" fill={design.colors[2]} stroke={design.colors[1]} strokeWidth="1.5" />
    <text x="70" y="125" textAnchor="middle" fill={design.colors[0]} fontSize="5.5" fontWeight="900" fontFamily="system-ui">{design.name.toUpperCase()}</text>
    {threePeat && <text x="70" y="137" textAnchor="middle" fill="#fbbf24" fontSize="7" fontWeight="900">★ ★ ★</text>}
  </svg>;
}

function renderShape(id: ChampionshipTrophyDesign["id"], gid: string) {
  const metal = `url(#${gid}-metal)`;
  const shine = `url(#${gid}-shine)`;
  if (id === "golden_gut") return <>
    <path d="M47 34 C36 48 38 82 49 96 C58 107 82 107 91 95 C102 80 103 51 91 35 C80 21 58 21 47 34Z" fill={metal} stroke="#fff3" strokeWidth="2" />
    <ellipse cx="70" cy="66" rx="24" ry="29" fill={shine} opacity=".8" />
    <path d="M43 76 H97 L91 90 H49Z" fill="#3f1d0b" stroke="#fbbf24" strokeWidth="3" />
    <circle cx="70" cy="83" r="9" fill="#fbbf24" stroke="#fff0a8" strokeWidth="2" /><text x="70" y="86" textAnchor="middle" fontSize="8" fontWeight="900" fill="#431407">GUT</text>
    <path d="M55 27 Q70 15 85 27" stroke="#fef3c7" strokeWidth="4" strokeLinecap="round" />
  </>;
  if (id === "the_receipt") return <>
    <path d="M46 17 H94 V99 L88 95 L82 101 L76 95 L70 101 L64 95 L58 101 L52 95 L46 101Z" fill="#f8fafc" stroke="#94a3b8" strokeWidth="2" />
    <path d="M53 31 H87 M53 40 H82 M53 49 H90 M53 62 H75 M53 71 H88" stroke="#64748b" strokeWidth="3" strokeLinecap="round" />
    <rect x="52" y="78" width="36" height="13" rx="2" fill="#334155" /><text x="70" y="87" textAnchor="middle" fontSize="6" fontWeight="900" fill="#f8fafc">VERIFIED</text>
    <path d="M46 17 Q70 8 94 17" fill={shine} />
  </>;
  if (id === "insufferable_crown") return <>
    <path d="M35 43 L48 72 L57 35 L70 69 L83 31 L92 72 L106 42 L99 95 H42Z" fill={metal} stroke="#fef08a" strokeWidth="2.5" />
    <path d="M42 80 H99" stroke="#fef08a" strokeWidth="5" />
    <circle cx="57" cy="76" r="5" fill="#ef4444" /><circle cx="70" cy="76" r="5" fill="#38bdf8" /><circle cx="84" cy="76" r="5" fill="#a855f7" />
    <circle cx="83" cy="31" r="5" fill="#fff7ad" /><path d="M51 98 Q70 106 90 98" stroke="#713f12" strokeWidth="5" />
  </>;
  if (id === "brass_football") return <>
    <g transform="rotate(-12 70 61)"><ellipse cx="70" cy="59" rx="43" ry="27" fill={metal} stroke="#fed7aa" strokeWidth="2.5" /><path d="M36 59 Q70 38 104 59 Q70 80 36 59Z" fill={shine} opacity=".38" /><path d="M57 45 L83 73 M62 48 L58 55 M68 52 L64 59 M74 56 L70 63 M80 60 L76 67" stroke="#fff0d0" strokeWidth="3" strokeLinecap="round" /></g>
    <path d="M55 88 L45 107 M85 86 L95 107" stroke="#b45309" strokeWidth="7" /><path d="M41 104 H99" stroke="#fed7aa" strokeWidth="5" />
  </>;
  if (id === "last_one_standing") return <>
    <path d="M29 91 L48 73 M43 98 L62 79 M78 96 L97 73 M92 101 L110 84" stroke="#7f1d1d" strokeWidth="6" strokeLinecap="round" />
    <path d="M62 29 Q70 17 78 29 L82 52 L95 65 L87 75 L78 65 L79 103 H61 L62 65 L52 76 L44 67 L58 51Z" fill={metal} stroke="#fca5a5" strokeWidth="2" />
    <circle cx="70" cy="23" r="10" fill={shine} /><path d="M53 105 H87" stroke="#fca5a5" strokeWidth="4" />
  </>;
  if (id === "nfl_sunday_crown") return <><path d="M36 48 L50 72 L59 37 L70 69 L82 34 L92 72 L105 47 L98 92 H42Z" fill={metal} stroke="#fff" strokeWidth="2"/><path d="M48 91 H92 V105 H48Z" fill={shine}/><path d="M58 78 Q70 65 82 78" stroke="#172554" strokeWidth="5"/><text x="70" y="89" textAnchor="middle" fontSize="9" fontWeight="900" fill="#172554">SUN</text></>;
  if (id === "nfl_fourth_and_regret") return <><path d="M48 24 H92 V100 H48Z" fill={metal} stroke="#fecaca" strokeWidth="2"/><path d="M55 38 H85 M55 50 H79 M55 62 H86" stroke="#450a0a" strokeWidth="4"/><circle cx="70" cy="82" r="13" fill="#450a0a"/><text x="70" y="86" textAnchor="middle" fontSize="12" fontWeight="900" fill="#fff">4?</text></>;
  if (id === "nfl_red_zone_throne") return <><path d="M40 31 H100 V91 H91 V105 H79 V91 H61 V105 H49 V91 H40Z" fill={metal} stroke="#fee2e2" strokeWidth="2"/><path d="M51 42 H89 V70 H51Z" fill="#450a0a"/><path d="M55 79 H85" stroke="#fff" strokeWidth="5"/><text x="70" y="60" textAnchor="middle" fontSize="14" fontWeight="900" fill="#fff">20</text></>;
  if (id === "nfl_monday_expert") return <><path d="M37 29 Q70 12 103 29 V92 Q70 108 37 92Z" fill={metal} stroke="#e0f2fe" strokeWidth="2"/><path d="M49 45 H91 M49 58 H84 M49 71 H94" stroke="#0c4a6e" strokeWidth="4"/><path d="M82 26 L96 40" stroke="#fff" strokeWidth="6"/><text x="70" y="88" textAnchor="middle" fontSize="8" fontWeight="900" fill="#0c4a6e">TOLD YA</text></>;
  if (id === "nfl_clipboard_destiny") return <><rect x="43" y="26" width="54" height="75" rx="5" fill={metal} stroke="#fef3c7" strokeWidth="2"/><rect x="57" y="19" width="26" height="14" rx="5" fill={shine}/><path d="M53 47 Q71 34 86 49 M53 63 Q72 80 87 62 M69 43 V83" stroke="#292524" strokeWidth="3"/><circle cx="53" cy="47" r="3" fill="#fff"/><circle cx="87" cy="62" r="3" fill="#fff"/></>;
  if (id === "nfl_very_legal_football") return <><g transform="rotate(-18 70 62)"><path d="M30 62 Q43 29 70 28 Q97 29 110 62 Q97 95 70 96 Q43 95 30 62Z" fill={metal} stroke="#fff" strokeWidth="2"/><path d="M55 46 L85 78 M61 49 L57 56 M68 54 L64 61 M75 59 L71 66 M82 64 L78 71" stroke="#111827" strokeWidth="3"/></g><text x="70" y="107" textAnchor="middle" fontSize="6" fontWeight="900" fill="#fff">LEGALLY DISTINCT</text></>;
  if (id === "cbb_busted_bracket") return <><path d="M31 30 H50 V48 H64 M109 30 H90 V48 H76 M31 91 H50 V73 H64 M109 91 H90 V73 H76" stroke={metal} strokeWidth="7" strokeLinecap="round"/><path d="M61 28 L78 51 L64 65 L82 98" stroke="#f8fafc" strokeWidth="6"/><circle cx="70" cy="61" r="15" fill={shine}/></>;
  if (id === "cbb_chalk_goblet") return <><path d="M43 25 H97 L90 71 Q84 91 70 98 Q56 91 50 71Z" fill={metal} stroke="#fff" strokeWidth="2"/><path d="M70 97 V108 M52 109 H88" stroke="#cbd5e1" strokeWidth="7"/><path d="M51 45 H89 M54 57 H86" stroke="#334155" strokeWidth="5"/><text x="70" y="74" textAnchor="middle" fontSize="9" fontWeight="900" fill="#334155">#1</text></>;
  if (id === "cbb_glass_slipper") return <><path d="M39 74 Q55 65 62 31 Q72 54 101 72 Q108 78 99 87 H48 Q35 87 39 74Z" fill={shine} fillOpacity=".8" stroke="#ecfeff" strokeWidth="3"/><path d="M63 31 Q78 22 87 37" stroke="#67e8f9" strokeWidth="5"/><circle cx="98" cy="82" r="5" fill="#fff"/></>;
  if (id === "cbb_net_results") return <><circle cx="70" cy="45" r="25" fill={metal} stroke="#dcfce7" strokeWidth="3"/><path d="M49 55 L56 101 M58 65 L64 104 M70 69 V106 M82 65 L76 104 M91 55 L84 101 M52 76 H88 M54 91 H86" stroke="#f8fafc" strokeWidth="2"/><path d="M43 32 H97" stroke="#14532d" strokeWidth="5"/></>;
  if (id === "cbb_full_court_oracle") return <><circle cx="70" cy="55" r="36" fill={shine} stroke="#fef3c7" strokeWidth="3"/><path d="M70 19 V91 M34 55 H106 M44 30 Q70 55 44 80 M96 30 Q70 55 96 80" stroke="#7c2d12" strokeWidth="3"/><circle cx="70" cy="55" r="12" fill="#fff" fillOpacity=".35"/><path d="M52 101 H88" stroke="#f97316" strokeWidth="7"/></>;
  if (id === "cbb_last_bracket_breathing") return <><path d="M31 37 H50 L59 51 M109 37 H90 L81 51 M31 87 H50 L59 73 M109 87 H90 L81 73" stroke={metal} strokeWidth="6"/><path d="M43 62 H56 L61 48 L69 83 L77 57 L82 68 H98" stroke="#fce7f3" strokeWidth="4"/><circle cx="70" cy="62" r="31" stroke="#ec4899" strokeWidth="3"/></>;
  if (id === "command_cup") return <>
    <path d="M47 27 H93 V45 C93 69 84 87 70 97 C56 87 47 69 47 45Z" fill={metal} stroke="#fff4bd" strokeWidth="2" />
    <path d="M47 38 H31 C29 62 39 76 55 78 M93 38 H109 C111 62 101 76 85 78" stroke="#e2a91f" strokeWidth="7" strokeLinecap="round" />
    <path d="M57 25 L60 15 M70 25 V11 M83 25 L80 15" stroke="#fff4bd" strokeWidth="3" /><circle cx="60" cy="14" r="3" fill="#ef4444" /><circle cx="70" cy="10" r="3" fill="#38bdf8" /><circle cx="80" cy="14" r="3" fill="#22c55e" />
    <path d="M60 97 V108 H80 V97" fill={metal} /><text x="70" y="63" textAnchor="middle" fontSize="20" fontWeight="900" fill="#6f4305">★</text>
  </>;
  const exhaustive: never = id;
  return exhaustive;
}
