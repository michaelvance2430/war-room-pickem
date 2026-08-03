"use client";

/**
 * Legacy multi-league strip — superseded by the Home League Hub
 * (HomeSportSwitcher in HomeSportHeader).
 *
 * NFL / CFB at the top of Home open every league for that sport with
 * sequential next-action CTAs. This secondary hub is intentionally
 * disabled so we never show two competing switchers.
 */

type Props = {
  onSwitched?: () => void;
};

export default function MultiLeagueHomeHub(_props: Props) {
  return null;
}
