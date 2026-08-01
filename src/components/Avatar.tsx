"use client";

import { useSyncExternalStore } from "react";
import { initialsFromName } from "@/lib/profile";
import {
  borderWrapperClass,
  defaultProfileBorderId,
  resolveCreatorEffect,
  resolveDisplayBorderId,
} from "@/lib/profile-borders";
import {
  getEquippedBorderId,
  subscribeProfileBorders,
} from "@/lib/profile-border-store";
import CreatorBorderFx from "@/components/CreatorBorderFx";

type Props = {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  /** User id — loads equipped border from store */
  userId?: string | null;
  /** Force a border id (Account preview) */
  borderId?: string | null;
  /** Skip ring (tiny nav chrome) */
  plain?: boolean;
};

const sizeClass = {
  sm: "w-7 h-7 text-[10px]",
  md: "w-10 h-10 text-xs",
  lg: "w-20 h-20 text-xl",
  xl: "w-24 h-24 sm:w-28 sm:h-28 text-2xl",
};

export default function Avatar({
  name,
  avatarUrl,
  size = "md",
  className = "",
  userId,
  borderId,
  plain = false,
}: Props) {
  const initials = initialsFromName(name);

  const storeBorder = useSyncExternalStore(
    subscribeProfileBorders,
    () => (userId ? getEquippedBorderId(userId) : null),
    () => null
  );

  const rawBorder =
    borderId ||
    storeBorder ||
    (plain ? null : defaultProfileBorderId());

  // Holiday borders only paint while that season theme is live
  const resolvedBorder = plain
    ? null
    : resolveDisplayBorderId(rawBorder);

  const creatorFx =
    !plain && resolvedBorder ? resolveCreatorEffect(resolvedBorder) : null;

  const ring =
    !plain && resolvedBorder && !creatorFx
      ? borderWrapperClass(resolvedBorder)
      : plain
        ? "rounded-full border border-border"
        : creatorFx
          ? ""
          : "rounded-full border border-border";

  const inner = avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarUrl}
      alt={name}
      className={`${sizeClass[size]} rounded-full object-cover shrink-0 ${className}`}
    />
  ) : (
    <div
      className={`${sizeClass[size]} rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center shrink-0 ${className}`}
      aria-label={name}
    >
      {initials}
    </div>
  );

  if (creatorFx) {
    return (
      <CreatorBorderFx effect={creatorFx} size={size}>
        {inner}
      </CreatorBorderFx>
    );
  }

  return (
    <div className={`inline-flex p-0.5 shrink-0 ${ring}`}>{inner}</div>
  );
}
