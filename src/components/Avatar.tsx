"use client";

import { initialsFromName } from "@/lib/profile";

type Props = {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClass = {
  sm: "w-7 h-7 text-[10px]",
  md: "w-10 h-10 text-xs",
  lg: "w-20 h-20 text-xl",
};

export default function Avatar({
  name,
  avatarUrl,
  size = "md",
  className = "",
}: Props) {
  const initials = initialsFromName(name);

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        className={`${sizeClass[size]} rounded-full object-cover border border-border shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass[size]} rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center shrink-0 border border-primary/30 ${className}`}
      aria-label={name}
    >
      {initials}
    </div>
  );
}
