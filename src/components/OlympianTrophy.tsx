"use client";

export default function OlympianTrophy({
  size = 48,
  muted = false,
}: {
  size?: number;
  muted?: boolean;
}) {
  const gold = muted ? "#78716c" : "#f6c453";
  const fire = muted ? "#57534e" : "#ef4444";
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="1996 Olympian torch and laurel trophy">
      <path d="M28 76C12 61 12 38 26 24M72 76C88 61 88 38 74 24" fill="none" stroke={gold} strokeWidth="6" strokeLinecap="round" />
      <path d="M23 65l-10-1m12-10-11-5m15-5-9-8m57 29 10-1M75 54l11-5m-15-5 9-8" fill="none" stroke={gold} strokeWidth="4" strokeLinecap="round" />
      <path d="M44 43h12l-4 38h-4z" fill={gold} />
      <path d="M50 44c-15-8-9-23 2-31-2 9 11 11 6 23-2 5-5 7-8 8z" fill={fire} />
      <path d="M37 83h26v7H37z" rx="2" fill={gold} />
      <text x="50" y="98" textAnchor="middle" fontSize="10" fontWeight="900" fill={gold}>1996</text>
    </svg>
  );
}
